import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from database/.env, root .env, or backend/.env
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', 'backend', '.env') });

// Read DATABASE_URL or build from standard PG environment variables
const DB_USER = process.env.PGUSER || 'postgres';
const DB_PASSWORD = process.env.PGPASSWORD || 'postgres';
const DB_HOST = process.env.PGHOST || 'localhost';
const DB_PORT = process.env.PGPORT || 5432;
const DB_NAME = process.env.PGDATABASE || 'credchain';

async function runSetup() {
  console.log('🔄 [CredChain] Starting PostgreSQL Database Initialization...');
  console.log(`📡 Connecting to PostgreSQL at ${DB_HOST}:${DB_PORT} as user "${DB_USER}"...`);

  // Step 1: Connect to default 'postgres' maintenance database to ensure 'credchain' db exists
  const maintenanceClient = new Client({
    user: DB_USER,
    password: DB_PASSWORD,
    host: DB_HOST,
    port: DB_PORT,
    database: 'postgres',
  });

  try {
    await maintenanceClient.connect();
    const checkDb = await maintenanceClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [DB_NAME]
    );

    if (checkDb.rows.length === 0) {
      console.log(`📦 Database "${DB_NAME}" does not exist. Creating it now...`);
      await maintenanceClient.query(`CREATE DATABASE "${DB_NAME}"`);
      console.log(`✅ Database "${DB_NAME}" created successfully.`);
    } else {
      console.log(`ℹ️ Database "${DB_NAME}" already exists.`);
    }
  } catch (err) {
    console.error('❌ Failed to connect to maintenance database:', err.message);
    console.error('👉 Please ensure PostgreSQL service is running and credentials in environment are correct.');
    process.exit(1);
  } finally {
    await maintenanceClient.end();
  }

  // Step 2: Connect to the 'credchain' database and execute schema and seed scripts
  const targetClient = new Client({
    user: DB_USER,
    password: DB_PASSWORD,
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
  });

  try {
    await targetClient.connect();
    console.log(`Connected to target database "${DB_NAME}".`);

    // Execute Schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    console.log(`📄 Executing schema definitions from ${schemaPath}...`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await targetClient.query(schemaSql);
    console.log('✅ Schema tables, ENUMs, triggers, and indexes created successfully.');

    // Execute Seed
    const seedPath = path.join(__dirname, 'seed.sql');
    if (fs.existsSync(seedPath)) {
      console.log(`🌱 Seeding initial policy rules, test users, and application records...`);
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      await targetClient.query(seedSql);
      console.log('✅ Default policy rules and test accounts seeded successfully.');
    }

    console.log('\n🎉 [CredChain] Database setup completed successfully!');
    console.log('----------------------------------------------------');
    console.log('Authorized domain accounts initialized:');
    console.log('  👑 Admin:     nkocetadmin@gmail.com        / AdminOrchid@123');
    console.log('  💼 Lender:    nkocetaccount@gmail.com      / Orchid@123');
    console.log('  💼 Lender 2:  nkocetaccount2@gmail.com     / Orchid2@123');
    console.log('  👤 Applicant: shreemadgundi0111@gmail.com  / Shreyash@123');
    console.log('  👤 Applicant: sagarkukadal@gmail.com       / Sagar@123');
    console.log('  👤 Applicant: rahulkukadal@gmail.com       / Rahul@123');
    console.log('  👤 Applicant: vikas123@gmail.com           / Vikas@123');
    console.log('  👤 Applicant: ireshpatane@gmail.com        / Iresh@123');
    console.log('----------------------------------------------------\n');
  } catch (err) {
    console.error('❌ Error executing schema/seed queries:', err.message);
    process.exit(1);
  } finally {
    await targetClient.end();
  }
}

runSetup();
