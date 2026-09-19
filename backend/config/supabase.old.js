// ==============================================================================
// Supabase Database Connection Configuration
// ==============================================================================

const path = require('path');

// 1. Ensure environment variables from backend/.env are reliably loaded into process.env
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// 2. Import createClient from official Supabase JavaScript SDK
const { createClient } = require('@supabase/supabase-js');

// 3. Read Supabase URL and Key from environment variables
const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_KEY || '').trim();

// 4. Determine if valid credentials are provided
const isConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseUrl.includes('your-project-id') &&
  !supabaseKey.includes('placeholder')
);

// 5. Initialize Supabase client
let supabase;

if (isConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
    console.log('✅ Supabase client initialized with provided credentials.');
  } catch (initErr) {
    console.warn('⚠️  Supabase client initialization warning:', initErr.message);
    supabase = createClient('https://placeholder.supabase.co', 'placeholder-key');
  }
} else {
  console.log('ℹ️  [Supabase]: No live credentials in .env yet. Running in development mode.');
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key');
}

// 6. Attach connection status metadata
supabase.isConfigured = isConfigured;

// 7. Export the initialized Supabase client
module.exports = supabase;
