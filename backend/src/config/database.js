import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure environment variables are loaded before creating the pool
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const { Pool } = pg;

const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  password: String(process.env.PGPASSWORD || 'postgres'),
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'credchain',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('🔴 Unexpected PostgreSQL pool error:', err.message);
});

export async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development' && duration > 500) {
      console.warn(`⚠️ Slow query (${duration}ms):`, text.substring(0, 80));
    }
    return result;
  } catch (err) {
    console.error('❌ Database query error:', err.message);
    throw err;
  }
}

export async function getClient() {
  const client = await pool.connect();
  return client;
}

export async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW() AS server_time');
    console.log('✅ PostgreSQL connected:', res.rows[0].server_time);
    return true;
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
    return false;
  }
}

export default pool;
