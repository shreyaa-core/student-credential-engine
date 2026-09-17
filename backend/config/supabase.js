// ==============================================================================
// Supabase Database Connection Configuration
// ==============================================================================

// 1. Ensure environment variables from .env are loaded into process.env
require('dotenv').config();

// 2. Import createClient from official Supabase JavaScript SDK
const { createClient } = require('@supabase/supabase-js');

// 3. Read Supabase URL and Key from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// 4. Log warning if credentials are not configured in .env yet
if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '⚠️  [Supabase Warning]: SUPABASE_URL or SUPABASE_KEY is missing in your .env file.'
  );
}

// 5. Initialize Supabase client
// (Uses placeholders as fallback so the server can boot even before real credentials are added)
const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key'
);

// 6. Export the initialized Supabase client
module.exports = supabase;
