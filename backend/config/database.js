// ==============================================================================
// PostgreSQL Database Connection Configuration
// Student Micro-Credential & Skill Verification Engine
// ==============================================================================

const path = require('path');
const { Pool } = require('pg');

// 1. Ensure environment variables from backend/.env are loaded
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// 2. Initialize PostgreSQL Pool using environment variables
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'student_credential_engine',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
});

// 3. Optional connect event listener
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

// 4. Connection error handler on idle clients
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

// 5. Export the pool instance
module.exports = pool;
