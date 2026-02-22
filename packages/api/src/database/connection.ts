import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'gearshelf_production',
  user: process.env.DB_USER || 'gearshelf_api',
  password: process.env.DB_PASSWORD || 'gs_prod_2026!',
  ssl: false, // Local development/production
  max: 20, // Maximum number of clients
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create connection pool
let pool: Pool;

export async function setupDatabase(): Promise<Pool> {
  if (!pool) {
    pool = new Pool(dbConfig);
    
    // Test connection
    try {
      const client = await pool.connect();
      console.log('✅ Database connected successfully');
      const result = await client.query('SELECT NOW() as current_time');
      console.log('📅 Database time:', result.rows[0].current_time);
      client.release();
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }
  
  return pool;
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database pool not initialized. Call setupDatabase() first.');
  }
  return pool;
}

// Graceful shutdown
process.on('SIGINT', async () => {
  if (pool) {
    await pool.end();
    console.log('Database pool closed');
  }
  process.exit(0);
});

export { pool };