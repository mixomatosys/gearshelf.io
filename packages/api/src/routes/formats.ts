import { Router, Request, Response, NextFunction } from 'express';
import { getPool } from '../database/connection';
import { createError } from '../middleware/errorHandler';
import Joi from 'joi';

const router = Router();

// Validation schema
const formatSchema = Joi.object({
  name: Joi.string().required().max(50),
  extension: Joi.string().allow('', null).max(10),
  description: Joi.string().allow('', null),
});

// GET /api/formats - List all plugin formats
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();
    const { include_counts = 'false' } = req.query;

    let query = `
      SELECT f.*
      FROM plugin_formats f
      ORDER BY f.name ASC
    `;

    // Add plugin counts if requested
    if (include_counts === 'true') {
      query = `
        SELECT 
          f.*,
          COUNT(DISTINCT ppf.plugin_id) as plugin_count
        FROM plugin_formats f
        LEFT JOIN plugin_plugin_formats ppf ON f.id = ppf.format_id
        GROUP BY f.id
        ORDER BY f.name ASC
      `;
    }

    const result = await pool.query(query);

    res.json({
      formats: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/formats/:id - Get single format with plugins
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    // Get format details
    const formatQuery = `
      SELECT 
        f.*,
        COUNT(DISTINCT ppf.plugin_id) as plugin_count
      FROM plugin_formats f
      LEFT JOIN plugin_plugin_formats ppf ON f.id = ppf.format_id
      WHERE f.id = $1
      GROUP BY f.id
    `;

    const formatResult = await pool.query(formatQuery, [id]);

    if (formatResult.rows.length === 0) {
      throw createError('Format not found', 404);
    }

    // Get plugins using this format
    const pluginsQuery = `
      SELECT 
        p.id, p.name, p.description, p.price, p.is_free, p.is_discontinued,
        v.name as vendor_name,
        COALESCE(JSON_AGG(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL), '[]'::json) as categories
      FROM plugins p
      JOIN vendors v ON p.vendor_id = v.id
      JOIN plugin_plugin_formats ppf ON p.id = ppf.plugin_id
      LEFT JOIN plugin_categories pc ON p.id = pc.plugin_id
      LEFT JOIN categories c ON pc.category_id = c.id
      WHERE ppf.format_id = $1
      GROUP BY p.id, v.name
      ORDER BY p.name ASC
    `;

    const pluginsResult = await pool.query(pluginsQuery, [id]);

    res.json({
      format: formatResult.rows[0],
      plugins: pluginsResult.rows,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/formats - Create new format
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = formatSchema.validate(req.body);
    if (error) {
      throw createError(error.details[0].message, 400);
    }

    const pool = getPool();

    // Check if format name already exists
    const existingResult = await pool.query('SELECT id FROM plugin_formats WHERE name = $1', [value.name]);
    if (existingResult.rows.length > 0) {
      throw createError('Format name already exists', 409);
    }

    const insertQuery = `
      INSERT INTO plugin_formats (name, extension, description, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      value.name,
      value.extension,
      value.description,
    ]);

    res.status(201).json({
      message: 'Format created successfully',
      format: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/formats/:id - Update format
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { error, value } = formatSchema.validate(req.body);
    if (error) {
      throw createError(error.details[0].message, 400);
    }

    const pool = getPool();

    // Check if format exists
    const existingResult = await pool.query('SELECT id FROM plugin_formats WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      throw createError('Format not found', 404);
    }

    // Check if new name conflicts (exclude current format)
    const nameResult = await pool.query(
      'SELECT id FROM plugin_formats WHERE name = $1 AND id != $2', 
      [value.name, id]
    );
    if (nameResult.rows.length > 0) {
      throw createError('Format name already exists', 409);
    }

    const updateQuery = `
      UPDATE plugin_formats 
      SET name = $2, extension = $3, description = $4, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      id,
      value.name,
      value.extension,
      value.description,
    ]);

    res.json({
      message: 'Format updated successfully',
      format: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/formats/:id - Delete format
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    // Check if format has associated plugins
    const pluginsResult = await pool.query('SELECT plugin_id FROM plugin_plugin_formats WHERE format_id = $1 LIMIT 1', [id]);
    if (pluginsResult.rows.length > 0) {
      throw createError('Cannot delete format with associated plugins', 409);
    }

    const result = await pool.query('DELETE FROM plugin_formats WHERE id = $1 RETURNING id, name', [id]);

    if (result.rowCount === 0) {
      throw createError('Format not found', 404);
    }

    res.json({
      message: 'Format deleted successfully',
      deleted: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

export default router;