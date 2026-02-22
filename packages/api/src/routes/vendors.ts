import { Router, Request, Response, NextFunction } from 'express';
import { getPool } from '../database/connection';
import { createError } from '../middleware/errorHandler';
import Joi from 'joi';

const router = Router();

// Validation schema
const vendorSchema = Joi.object({
  name: Joi.string().required().max(255),
  website_url: Joi.string().uri().allow('', null),
  description: Joi.string().allow('', null),
});

// GET /api/vendors - List all vendors
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();
    const { include_counts = 'false', search } = req.query;

    let query = `
      SELECT v.*
      FROM vendors v
    `;

    let queryParams: any[] = [];

    // Add search if provided
    if (search) {
      query += ` WHERE v.name ILIKE $1 OR v.description ILIKE $1`;
      queryParams.push(`%${search}%`);
    }

    // Add plugin counts if requested
    if (include_counts === 'true') {
      query = query.replace(
        'SELECT v.*',
        'SELECT v.*, COUNT(DISTINCT p.id) as plugin_count'
      );
      query += `
        LEFT JOIN plugins p ON v.id = p.vendor_id
        GROUP BY v.id
      `;
    }

    query += ` ORDER BY v.name ASC`;

    const result = await pool.query(query, queryParams);

    res.json({
      vendors: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/vendors/:id - Get single vendor with plugins
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    // Get vendor details
    const vendorQuery = `
      SELECT v.*, COUNT(DISTINCT p.id) as plugin_count
      FROM vendors v
      LEFT JOIN plugins p ON v.id = p.vendor_id
      WHERE v.id = $1
      GROUP BY v.id
    `;

    const vendorResult = await pool.query(vendorQuery, [id]);

    if (vendorResult.rows.length === 0) {
      throw createError('Vendor not found', 404);
    }

    // Get vendor's plugins
    const pluginsQuery = `
      SELECT 
        p.id, p.name, p.description, p.price, p.is_free, p.is_discontinued,
        p.average_rating, p.download_count,
        COALESCE(JSON_AGG(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL), '[]'::json) as categories,
        COALESCE(JSON_AGG(DISTINCT f.name) FILTER (WHERE f.name IS NOT NULL), '[]'::json) as formats
      FROM plugins p
      LEFT JOIN plugin_categories pc ON p.id = pc.plugin_id
      LEFT JOIN categories c ON pc.category_id = c.id
      LEFT JOIN plugin_plugin_formats ppf ON p.id = ppf.plugin_id
      LEFT JOIN plugin_formats f ON ppf.format_id = f.id
      WHERE p.vendor_id = $1
      GROUP BY p.id
      ORDER BY p.name ASC
    `;

    const pluginsResult = await pool.query(pluginsQuery, [id]);

    res.json({
      vendor: vendorResult.rows[0],
      plugins: pluginsResult.rows,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/vendors - Create new vendor
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = vendorSchema.validate(req.body);
    if (error) {
      throw createError(error.details[0].message, 400);
    }

    const pool = getPool();

    // Check if vendor name already exists
    const existingResult = await pool.query('SELECT id FROM vendors WHERE name = $1', [value.name]);
    if (existingResult.rows.length > 0) {
      throw createError('Vendor name already exists', 409);
    }

    const insertQuery = `
      INSERT INTO vendors (name, website_url, description, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      value.name,
      value.website_url,
      value.description,
    ]);

    res.status(201).json({
      message: 'Vendor created successfully',
      vendor: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/vendors/:id - Update vendor
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { error, value } = vendorSchema.validate(req.body);
    if (error) {
      throw createError(error.details[0].message, 400);
    }

    const pool = getPool();

    // Check if vendor exists
    const existingResult = await pool.query('SELECT id FROM vendors WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      throw createError('Vendor not found', 404);
    }

    // Check if new name conflicts (exclude current vendor)
    const nameResult = await pool.query(
      'SELECT id FROM vendors WHERE name = $1 AND id != $2', 
      [value.name, id]
    );
    if (nameResult.rows.length > 0) {
      throw createError('Vendor name already exists', 409);
    }

    const updateQuery = `
      UPDATE vendors 
      SET name = $2, website_url = $3, description = $4, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      id,
      value.name,
      value.website_url,
      value.description,
    ]);

    res.json({
      message: 'Vendor updated successfully',
      vendor: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/vendors/:id - Delete vendor
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    // Check if vendor has plugins
    const pluginsResult = await pool.query('SELECT id FROM plugins WHERE vendor_id = $1 LIMIT 1', [id]);
    if (pluginsResult.rows.length > 0) {
      throw createError('Cannot delete vendor with associated plugins', 409);
    }

    const result = await pool.query('DELETE FROM vendors WHERE id = $1 RETURNING id, name', [id]);

    if (result.rowCount === 0) {
      throw createError('Vendor not found', 404);
    }

    res.json({
      message: 'Vendor deleted successfully',
      deleted: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

export default router;