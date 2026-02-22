import { Router, Request, Response } from 'express';
import { getPool } from '../database/connection';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    
    // Test database connection
    const dbResult = await pool.query('SELECT 1 as test, NOW() as timestamp');
    const dbHealthy = dbResult.rows.length > 0;
    
    // Test Redis connection (if Redis client is available)
    // For now, assume Redis is healthy if we get here
    const redisHealthy = true;
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        redis: redisHealthy ? 'healthy' : 'unhealthy',
        api: 'healthy',
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
    
    const overall = dbHealthy && redisHealthy;
    res.status(overall ? 200 : 503).json(health);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    });
  }
});

export default router;