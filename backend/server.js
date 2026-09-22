// ==============================================================================
// Student Micro-Credential Verification Engine - Backend Server
// ==============================================================================

const path = require('path');

// 1. Load environment variables from .env file into process.env
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// 2. Import external packages & configuration
const express = require('express');
const cors = require('cors');
const pool = require('./config/database');
const certificateRoutes = require('./routes/certificateRoutes');
const badgeRoutes = require('./routes/badgeRoutes');
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const skillRoutes = require('./routes/skillRoutes');
const profileRoutes = require('./routes/profileRoutes');
const verifyRoutes = require('./routes/verifyRoutes');
const activityRoutes = require('./routes/activityRoutes');
const transcriptRoutes = require('./routes/transcriptRoutes');

// 3. Initialize Express application instance
const app = express();

// 4. Set server port (reads PORT from .env, or falls back to 5000)
const PORT = process.env.PORT || 5000;

// 5. Middleware configuration
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 6. Routes

// GET / - Root health check & API directory
app.get('/', (req, res) => {
  res.status(200).json({
    message: "Student Micro-Credential Verification Engine Backend is running",
    status: "online",
    endpoints: {
      test: "GET /api/test",
      databaseTest: "GET /api/database-test",
      dashboard: "GET /api/dashboard",
      skills: "GET /api/skills",
      profile: "GET /api/profile/:id",
      authLogin: "POST /api/auth/login",
      authRegister: "POST /api/auth/register",
      authMe: "GET /api/auth/me",
      getCertificates: "GET /api/certificates",
      uploadCertificate: "POST /api/certificates/upload",
      getBadges: "GET /api/badges",
      createBadge: "POST /api/badges/create",
      adminCertificates: "GET /api/admin/certificates",
      updateCertificateStatus: "PUT /api/admin/certificates/:id/status",
      activities: "GET /api/activities, POST /api/activities",
      transcript: "GET /api/transcript/me, GET /api/transcript/me/pdf"
    },
    frontendApp: "http://localhost:3000"
  });
});

// GET /api/test - simple endpoint to verify backend is running
app.get('/api/test', (req, res) => {
  res.status(200).json({
    message: "Backend working"
  });
});

// GET /api/database-test - connects to PostgreSQL to verify database connectivity
app.get('/api/database-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');

    return res.status(200).json({
      message: "PostgreSQL connected successfully",
      timestamp: result.rows[0]?.now
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
});

// Mount Dashboard Routes (handles GET /api/dashboard)
app.use('/api/dashboard', dashboardRoutes);

// Mount Auth Routes (handles POST /api/auth/login, POST /api/auth/register, GET /api/auth/me)
app.use('/api/auth', authRoutes);

// Mount Certificate Routes (handles POST /api/certificates/upload)
app.use('/api/certificates', certificateRoutes);

// Mount Skill Routes (handles GET /api/skills)
app.use('/api/skills', skillRoutes);

// Mount Profile Routes (handles GET /api/profile/:id)
app.use('/api/profile', profileRoutes);

// Mount Badge Routes (handles POST /api/badges/create)
app.use('/api/badges', badgeRoutes);

// Mount Admin Routes (handles GET /api/admin/certificates and PUT /api/admin/certificates/:id/status)
app.use('/api/admin', adminRoutes);

// Mount Public Verification Routes (handles GET /api/verify and GET /api/verify/:identifier)
app.use('/api/verify', verifyRoutes);

// Mount Activity Logs Routes (handles CRUD /api/activities with skill taxonomy mapping)
app.use('/api/activities', activityRoutes);

// Mount Transcript Routes (handles GET /api/transcript/me and GET /api/transcript/me/pdf)
app.use('/api/transcript', transcriptRoutes);

// 7. Start listening for incoming network requests
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Root API: http://localhost:${PORT}/`);
  console.log(`Test API: http://localhost:${PORT}/api/test`);
  console.log(`Database Test API: http://localhost:${PORT}/api/database-test`);
  console.log(`Dashboard API: GET http://localhost:${PORT}/api/dashboard`);
  console.log(`Skills API: GET http://localhost:${PORT}/api/skills`);
  console.log(`Profile API: GET http://localhost:${PORT}/api/profile/:id`);
  console.log(`Auth Login API: POST http://localhost:${PORT}/api/auth/login`);
  console.log(`Auth Register API: POST http://localhost:${PORT}/api/auth/register`);
  console.log(`Auth Me API: GET http://localhost:${PORT}/api/auth/me`);
  console.log(`Certificates API: GET http://localhost:${PORT}/api/certificates`);
  console.log(`Badges API: GET http://localhost:${PORT}/api/badges`);
  console.log(`Upload Certificate API: POST http://localhost:${PORT}/api/certificates/upload`);
  console.log(`Badge API: POST http://localhost:${PORT}/api/badges/create`);
  console.log(`Admin Certificates API: GET http://localhost:${PORT}/api/admin/certificates`);
  console.log(`Admin Status API: GET/PUT http://localhost:${PORT}/api/admin/certificates/:id/status`);
});
