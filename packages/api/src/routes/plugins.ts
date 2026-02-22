import { Router, Request, Response, NextFunction } from 'express';
import { getPool } from '../database/connection';
import { createError } from '../middleware/errorHandler';
import Joi from 'joi';

const router = Router();

// Validation schemas
const pluginCreateSchema = Joi.object({
  name: Joi.string().required().max(255),
  vendor_id: Joi.number().integer().required(),
  description: Joi.string().allow('', null),
  price: Joi.number().precision(2).allow(null),
  currency: Joi.string().max(3).allow(null),
  is_free: Joi.boolean().default(false),
  is_discontinued: Joi.boolean().default(false),
  website_url: Joi.string().uri().allow('', null),
  download_url: Joi.string().uri().allow('', null),
  supported_os: Joi.array().items(Joi.string().valid('Windows', 'macOS', 'Linux')),
  system_requirements: Joi.string().allow('', null),
  average_rating: Joi.number().min(0).max(5).allow(null),
  total_ratings: Joi.number().integer().min(0).allow(null),
  download_count: Joi.number().integer().min(0).allow(null),
  release_date: Joi.date().allow(null),
  last_updated: Joi.date().allow(null),
  version: Joi.string().allow('', null),
  category_ids: Joi.array().items(Joi.number().integer()),
  format_ids: Joi.array().items(Joi.number().integer()),
});

const pluginUpdateSchema = pluginCreateSchema.fork(['name', 'vendor_id'], (schema) => 
  schema.optional()
);

// GET /api/plugins - List plugins with filtering and search
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();
    
    // Query parameters
    const {
      search,
      vendor_id,
      category_id,
      format_id,
      is_free,
      is_discontinued,
      supported_os,
      limit = 50,
      offset = 0,
      sort_by = 'name',
      sort_order = 'ASC'
    } = req.query;

    // Build dynamic query
    let whereConditions: string[] = [];
    let queryParams: any[] = [];
    let paramCount = 0;

    // Search in name and description
    if (search) {
      paramCount++;
      whereConditions.push(`(p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`);
      queryParams.push(`%${search}%`);
    }

    // Filter by vendor
    if (vendor_id) {
      paramCount++;
      whereConditions.push(`p.vendor_id = $${paramCount}`);
      queryParams.push(vendor_id);
    }

    // Filter by category (via junction table)
    if (category_id) {
      paramCount++;
      whereConditions.push(`EXISTS (
        SELECT 1 FROM plugin_categories pc 
        WHERE pc.plugin_id = p.id AND pc.category_id = $${paramCount}
      )`);
      queryParams.push(category_id);
    }

    // Filter by format (via junction table)
    if (format_id) {
      paramCount++;
      whereConditions.push(`EXISTS (
        SELECT 1 FROM plugin_plugin_formats ppf 
        WHERE ppf.plugin_id = p.id AND ppf.format_id = $${paramCount}
      )`);
      queryParams.push(format_id);
    }

    // Filter by free/paid
    if (is_free !== undefined) {
      paramCount++;
      whereConditions.push(`p.is_free = $${paramCount}`);
      queryParams.push(is_free === 'true');
    }

    // Filter by discontinued
    if (is_discontinued !== undefined) {
      paramCount++;
      whereConditions.push(`p.is_discontinued = $${paramCount}`);
      queryParams.push(is_discontinued === 'true');
    }

    // Filter by supported OS
    if (supported_os) {
      paramCount++;
      whereConditions.push(`$${paramCount} = ANY(p.supported_os)`);
      queryParams.push(supported_os);
    }

    // Construct WHERE clause
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Validate sort columns
    const validSortColumns = ['name', 'vendor_name', 'price', 'average_rating', 'download_count', 'created_at'];
    const sortBy = validSortColumns.includes(sort_by as string) ? sort_by : 'name';
    const sortOrder = sort_order === 'DESC' ? 'DESC' : 'ASC';

    // Add pagination params
    paramCount++;
    queryParams.push(limit);
    paramCount++;
    queryParams.push(offset);

    const query = `
      SELECT 
        p.*,
        v.name as vendor_name,
        COALESCE(
          JSON_AGG(
            DISTINCT jsonb_build_object(
              'id', c.id,
              'name', c.name,
              'slug', c.slug
            )
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'::json
        ) as categories,
        COALESCE(
          JSON_AGG(
            DISTINCT jsonb_build_object(
              'id', f.id,
              'name', f.name,
              'extension', f.extension
            )
          ) FILTER (WHERE f.id IS NOT NULL),
          '[]'::json
        ) as formats
      FROM plugins p
      JOIN vendors v ON p.vendor_id = v.id
      LEFT JOIN plugin_categories pc ON p.id = pc.plugin_id
      LEFT JOIN categories c ON pc.category_id = c.id
      LEFT JOIN plugin_plugin_formats ppf ON p.id = ppf.plugin_id
      LEFT JOIN plugin_formats f ON ppf.format_id = f.id
      ${whereClause}
      GROUP BY p.id, v.name
      ORDER BY ${sortBy === 'vendor_name' ? 'v.name' : 'p.' + sortBy} ${sortOrder}
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;

    const result = await pool.query(query, queryParams);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM plugins p
      JOIN vendors v ON p.vendor_id = v.id
      LEFT JOIN plugin_categories pc ON p.id = pc.plugin_id
      LEFT JOIN plugin_plugin_formats ppf ON p.id = ppf.plugin_id
      ${whereClause}
    `;
    
    const countResult = await pool.query(countQuery, queryParams.slice(0, -2)); // Remove limit/offset
    const total = parseInt(countResult.rows[0].total);

    res.json({
      plugins: result.rows,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        page: Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
      filters: {
        search,
        vendor_id: vendor_id ? parseInt(vendor_id as string) : null,
        category_id: category_id ? parseInt(category_id as string) : null,
        format_id: format_id ? parseInt(format_id as string) : null,
        is_free: is_free ? is_free === 'true' : null,
        is_discontinued: is_discontinued ? is_discontinued === 'true' : null,
        supported_os,
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/plugins/:id - Get single plugin by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const query = `
      SELECT 
        p.*,
        v.name as vendor_name,
        v.website_url as vendor_website,
        COALESCE(
          JSON_AGG(
            DISTINCT jsonb_build_object(
              'id', c.id,
              'name', c.name,
              'slug', c.slug,
              'parent_id', c.parent_id
            )
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'::json
        ) as categories,
        COALESCE(
          JSON_AGG(
            DISTINCT jsonb_build_object(
              'id', f.id,
              'name', f.name,
              'extension', f.extension
            )
          ) FILTER (WHERE f.id IS NOT NULL),
          '[]'::json
        ) as formats
      FROM plugins p
      JOIN vendors v ON p.vendor_id = v.id
      LEFT JOIN plugin_categories pc ON p.id = pc.plugin_id
      LEFT JOIN categories c ON pc.category_id = c.id
      LEFT JOIN plugin_plugin_formats ppf ON p.id = ppf.plugin_id
      LEFT JOIN plugin_formats f ON ppf.format_id = f.id
      WHERE p.id = $1
      GROUP BY p.id, v.name, v.website_url
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      throw createError('Plugin not found', 404);
    }

    res.json({ plugin: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /api/plugins - Create new plugin
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = pluginCreateSchema.validate(req.body);
    if (error) {
      throw createError(error.details[0].message, 400);
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Insert plugin
      const {
        category_ids = [],
        format_ids = [],
        ...pluginData
      } = value;

      const insertQuery = `
        INSERT INTO plugins (
          name, vendor_id, description, price, currency, is_free, is_discontinued,
          website_url, download_url, supported_os, system_requirements,
          average_rating, total_ratings, download_count, release_date,
          last_updated, version, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
        RETURNING id
      `;

      const pluginResult = await client.query(insertQuery, [
        pluginData.name,
        pluginData.vendor_id,
        pluginData.description,
        pluginData.price,
        pluginData.currency,
        pluginData.is_free,
        pluginData.is_discontinued,
        pluginData.website_url,
        pluginData.download_url,
        pluginData.supported_os,
        pluginData.system_requirements,
        pluginData.average_rating,
        pluginData.total_ratings,
        pluginData.download_count,
        pluginData.release_date,
        pluginData.last_updated,
        pluginData.version,
      ]);

      const pluginId = pluginResult.rows[0].id;

      // Insert category relationships
      if (category_ids.length > 0) {
        for (const categoryId of category_ids) {
          await client.query(
            'INSERT INTO plugin_categories (plugin_id, category_id) VALUES ($1, $2)',
            [pluginId, categoryId]
          );
        }
      }

      // Insert format relationships
      if (format_ids.length > 0) {
        for (const formatId of format_ids) {
          await client.query(
            'INSERT INTO plugin_plugin_formats (plugin_id, format_id) VALUES ($1, $2)',
            [pluginId, formatId]
          );
        }
      }

      await client.query('COMMIT');

      // Fetch the created plugin with relationships
      const fetchQuery = `
        SELECT 
          p.*,
          v.name as vendor_name,
          COALESCE(JSON_AGG(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL), '[]'::json) as categories,
          COALESCE(JSON_AGG(DISTINCT f.name) FILTER (WHERE f.name IS NOT NULL), '[]'::json) as formats
        FROM plugins p
        JOIN vendors v ON p.vendor_id = v.id
        LEFT JOIN plugin_categories pc ON p.id = pc.plugin_id
        LEFT JOIN categories c ON pc.category_id = c.id
        LEFT JOIN plugin_plugin_formats ppf ON p.id = ppf.plugin_id
        LEFT JOIN plugin_formats f ON ppf.format_id = f.id
        WHERE p.id = $1
        GROUP BY p.id, v.name
      `;

      const created = await client.query(fetchQuery, [pluginId]);
      
      res.status(201).json({ 
        message: 'Plugin created successfully',
        plugin: created.rows[0] 
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// PUT /api/plugins/:id - Update plugin
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { error, value } = pluginUpdateSchema.validate(req.body);
    if (error) {
      throw createError(error.details[0].message, 400);
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const {
        category_ids,
        format_ids,
        ...pluginData
      } = value;

      // Update plugin data if provided
      if (Object.keys(pluginData).length > 0) {
        const setClause = Object.keys(pluginData)
          .map((key, index) => `${key} = $${index + 2}`)
          .join(', ');

        const updateQuery = `
          UPDATE plugins 
          SET ${setClause}, updated_at = NOW()
          WHERE id = $1
          RETURNING id
        `;

        const updateResult = await client.query(updateQuery, [
          id,
          ...Object.values(pluginData)
        ]);

        if (updateResult.rowCount === 0) {
          throw createError('Plugin not found', 404);
        }
      }

      // Update category relationships if provided
      if (category_ids) {
        await client.query('DELETE FROM plugin_categories WHERE plugin_id = $1', [id]);
        for (const categoryId of category_ids) {
          await client.query(
            'INSERT INTO plugin_categories (plugin_id, category_id) VALUES ($1, $2)',
            [id, categoryId]
          );
        }
      }

      // Update format relationships if provided
      if (format_ids) {
        await client.query('DELETE FROM plugin_plugin_formats WHERE plugin_id = $1', [id]);
        for (const formatId of format_ids) {
          await client.query(
            'INSERT INTO plugin_plugin_formats (plugin_id, format_id) VALUES ($1, $2)',
            [id, formatId]
          );
        }
      }

      await client.query('COMMIT');

      // Fetch updated plugin
      const fetchQuery = `
        SELECT 
          p.*,
          v.name as vendor_name,
          COALESCE(JSON_AGG(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL), '[]'::json) as categories,
          COALESCE(JSON_AGG(DISTINCT f.name) FILTER (WHERE f.name IS NOT NULL), '[]'::json) as formats
        FROM plugins p
        JOIN vendors v ON p.vendor_id = v.id
        LEFT JOIN plugin_categories pc ON p.id = pc.plugin_id
        LEFT JOIN categories c ON pc.category_id = c.id
        LEFT JOIN plugin_plugin_formats ppf ON p.id = ppf.plugin_id
        LEFT JOIN plugin_formats f ON ppf.format_id = f.id
        WHERE p.id = $1
        GROUP BY p.id, v.name
      `;

      const updated = await client.query(fetchQuery, [id]);
      
      res.json({ 
        message: 'Plugin updated successfully',
        plugin: updated.rows[0] 
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// DELETE /api/plugins/:id - Delete plugin
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const result = await pool.query('DELETE FROM plugins WHERE id = $1 RETURNING id, name', [id]);

    if (result.rowCount === 0) {
      throw createError('Plugin not found', 404);
    }

    res.json({ 
      message: 'Plugin deleted successfully',
      deleted: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

export default router;