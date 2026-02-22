import { Router, Request, Response, NextFunction } from 'express';
import { getPool } from '../database/connection';
import { createError } from '../middleware/errorHandler';
import Joi from 'joi';

const router = Router();

// Validation schemas
const categorySchema = Joi.object({
  name: Joi.string().required().max(100),
  slug: Joi.string().required().max(100),
  description: Joi.string().allow('', null),
  parent_id: Joi.number().integer().allow(null),
});

// GET /api/categories - List all categories with hierarchy
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();
    const { include_counts = 'false' } = req.query;

    let query = `
      SELECT 
        c.*,
        parent.name as parent_name,
        COALESCE(
          JSON_AGG(
            DISTINCT jsonb_build_object(
              'id', child.id,
              'name', child.name,
              'slug', child.slug
            )
          ) FILTER (WHERE child.id IS NOT NULL),
          '[]'::json
        ) as children
      FROM categories c
      LEFT JOIN categories parent ON c.parent_id = parent.id
      LEFT JOIN categories child ON child.parent_id = c.id
      GROUP BY c.id, parent.name
      ORDER BY c.parent_id ASC NULLS FIRST, c.name ASC
    `;

    // Add plugin counts if requested
    if (include_counts === 'true') {
      query = `
        SELECT 
          c.*,
          parent.name as parent_name,
          COALESCE(
            JSON_AGG(
              DISTINCT jsonb_build_object(
                'id', child.id,
                'name', child.name,
                'slug', child.slug
              )
            ) FILTER (WHERE child.id IS NOT NULL),
            '[]'::json
          ) as children,
          COUNT(DISTINCT pc.plugin_id) as plugin_count
        FROM categories c
        LEFT JOIN categories parent ON c.parent_id = parent.id
        LEFT JOIN categories child ON child.parent_id = c.id
        LEFT JOIN plugin_categories pc ON c.id = pc.category_id
        GROUP BY c.id, parent.name
        ORDER BY c.parent_id ASC NULLS FIRST, c.name ASC
      `;
    }

    const result = await pool.query(query);

    res.json({
      categories: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/categories/:id - Get single category with plugins
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    // Get category with parent/children info
    const categoryQuery = `
      SELECT 
        c.*,
        parent.name as parent_name,
        COALESCE(
          JSON_AGG(
            DISTINCT jsonb_build_object(
              'id', child.id,
              'name', child.name,
              'slug', child.slug
            )
          ) FILTER (WHERE child.id IS NOT NULL),
          '[]'::json
        ) as children
      FROM categories c
      LEFT JOIN categories parent ON c.parent_id = parent.id
      LEFT JOIN categories child ON child.parent_id = c.id
      WHERE c.id = $1
      GROUP BY c.id, parent.name
    `;

    const categoryResult = await pool.query(categoryQuery, [id]);

    if (categoryResult.rows.length === 0) {
      throw createError('Category not found', 404);
    }

    // Get plugins in this category
    const pluginsQuery = `
      SELECT 
        p.id, p.name, p.description, p.price, p.is_free, p.is_discontinued,
        v.name as vendor_name,
        COALESCE(JSON_AGG(DISTINCT f.name) FILTER (WHERE f.name IS NOT NULL), '[]'::json) as formats
      FROM plugins p
      JOIN vendors v ON p.vendor_id = v.id
      JOIN plugin_categories pc ON p.id = pc.plugin_id
      LEFT JOIN plugin_plugin_formats ppf ON p.id = ppf.plugin_id
      LEFT JOIN plugin_formats f ON ppf.format_id = f.id
      WHERE pc.category_id = $1
      GROUP BY p.id, v.name
      ORDER BY p.name ASC
    `;

    const pluginsResult = await pool.query(pluginsQuery, [id]);

    res.json({
      category: categoryResult.rows[0],
      plugins: pluginsResult.rows,
      plugin_count: pluginsResult.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/categories - Create new category
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = categorySchema.validate(req.body);
    if (error) {
      throw createError(error.details[0].message, 400);
    }

    const pool = getPool();

    // Check if slug already exists
    const existingResult = await pool.query('SELECT id FROM categories WHERE slug = $1', [value.slug]);
    if (existingResult.rows.length > 0) {
      throw createError('Category slug already exists', 409);
    }

    // Check parent exists if provided
    if (value.parent_id) {
      const parentResult = await pool.query('SELECT id FROM categories WHERE id = $1', [value.parent_id]);
      if (parentResult.rows.length === 0) {
        throw createError('Parent category not found', 400);
      }
    }

    const insertQuery = `
      INSERT INTO categories (name, slug, description, parent_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      value.name,
      value.slug,
      value.description,
      value.parent_id,
    ]);

    res.status(201).json({
      message: 'Category created successfully',
      category: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/categories/:id - Update category
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { error, value } = categorySchema.validate(req.body);
    if (error) {
      throw createError(error.details[0].message, 400);
    }

    const pool = getPool();

    // Check if category exists
    const existingResult = await pool.query('SELECT id FROM categories WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      throw createError('Category not found', 404);
    }

    // Check if new slug conflicts (exclude current category)
    const slugResult = await pool.query(
      'SELECT id FROM categories WHERE slug = $1 AND id != $2', 
      [value.slug, id]
    );
    if (slugResult.rows.length > 0) {
      throw createError('Category slug already exists', 409);
    }

    // Check parent exists if provided and isn't self
    if (value.parent_id) {
      if (value.parent_id === parseInt(id)) {
        throw createError('Category cannot be its own parent', 400);
      }
      const parentResult = await pool.query('SELECT id FROM categories WHERE id = $1', [value.parent_id]);
      if (parentResult.rows.length === 0) {
        throw createError('Parent category not found', 400);
      }
    }

    const updateQuery = `
      UPDATE categories 
      SET name = $2, slug = $3, description = $4, parent_id = $5, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      id,
      value.name,
      value.slug,
      value.description,
      value.parent_id,
    ]);

    res.json({
      message: 'Category updated successfully',
      category: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/categories/:id - Delete category
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    // Check if category has children
    const childrenResult = await pool.query('SELECT id FROM categories WHERE parent_id = $1', [id]);
    if (childrenResult.rows.length > 0) {
      throw createError('Cannot delete category with child categories', 409);
    }

    // Check if category has plugins
    const pluginsResult = await pool.query('SELECT plugin_id FROM plugin_categories WHERE category_id = $1 LIMIT 1', [id]);
    if (pluginsResult.rows.length > 0) {
      throw createError('Cannot delete category with associated plugins', 409);
    }

    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING id, name', [id]);

    if (result.rowCount === 0) {
      throw createError('Category not found', 404);
    }

    res.json({
      message: 'Category deleted successfully',
      deleted: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

export default router;