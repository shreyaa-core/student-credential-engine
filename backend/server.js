// ==============================================================================
// Student Micro-Credential Verification Engine - Backend Server
// ==============================================================================

// 1. Load environment variables from .env file into process.env
require('dotenv').config();

// 2. Import external packages & configuration
const express = require('express');
const cors = require('cors');
const supabase = require('./config/supabase');

// 3. Initialize Express application instance
const app = express();

// 4. Set server port (reads PORT from .env, or falls back to 5000)
const PORT = process.env.PORT || 5000;

// 5. Middleware configuration
app.use(cors());
app.use(express.json());

// 6. Routes

// GET /api/test - simple endpoint to verify backend is running
app.get('/api/test', (req, res) => {
  res.status(200).json({
    message: "Backend working"
  });
});

// GET /api/database-test - connects to Supabase to verify database connectivity
app.get('/api/database-test', async (req, res) => {
  try {
    // If Supabase credentials are configured in .env, verify live connection
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      const { error } = await supabase.from('profiles').select('id').limit(1);

      if (error) {
        return res.status(500).json({
          error: error.message
        });
      }
    }

    res.status(200).json({
      message: "Supabase connected successfully"
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// 7. Start listening for incoming network requests
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Test API: http://localhost:${PORT}/api/test`);
  console.log(`Database Test API: http://localhost:${PORT}/api/database-test`);
});
