// ==============================================================================
// Student Micro-Credential Verification Engine - Certificate Routes
// ==============================================================================

const express = require('express');
const multer = require('multer');
const path = require('path');
const supabase = require('../config/supabase');
const certificateController = require('../controllers/certificateController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// 1. Configure multer memory storage (buffers file in memory for direct Supabase upload)
const storage = multer.memoryStorage();

// 2. File filter to only allow PDF, PNG, JPG, JPEG
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error('Invalid file format. Only PDF, PNG, JPG, and JPEG are allowed.'),
      false
    );
  }
};

// 3. Initialize multer upload middleware (10MB limit)
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * 4. GET /api/certificates
 * 
 * Purpose:
 * Fetch all certificates from Supabase 'certificates' table.
 * 
 * Return fields:
 * - certificate_name
 * - issuer
 * - status
 * - file_url
 * - created_at / createdDate
 */
router.get(['/', '/api/certificates'], async (req, res) => {
  try {
    let certificates = [];

    if (supabase.isConfigured) {
      const { data, error } = await supabase
        .from('certificates')
        .select('id, certificate_name, issuer, status, file_url, verification_score, created_at')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        certificates = data;
      } else if (error) {
        console.warn('Notice: Error querying certificates table from Supabase:', error.message);
      }
    }

    // Map and normalize fields: certificate name, issuer, status, file url, created date
    const formattedCertificates = certificates.map((item) => ({
      id: item.id,
      certificate_name: item.certificate_name,
      certificateName: item.certificate_name,
      title: item.certificate_name,
      issuer: item.issuer,
      status: item.status || 'PENDING',
      file_url: item.file_url || '',
      fileUrl: item.file_url || '',
      created_at: item.created_at,
      createdDate: item.created_at,
      date: item.created_at
        ? new Date(item.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'Recent',
      issueDate: item.created_at
        ? new Date(item.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'Recent',
      verification_score: item.verification_score || 0,
    }));

    return res.status(200).json(formattedCertificates);
  } catch (err) {
    console.error('Error fetching certificates:', err);
    return res.status(500).json({
      error: err.message || 'Failed to fetch certificates',
    });
  }
});

// 5. GET /api/certificates/upload
// Helpful response when opened directly in a web browser via GET
router.get('/upload', (req, res) => {
  res.status(200).json({
    message: "Certificate upload endpoint is ready. Send an HTTP POST request with your file to upload.",
    method: "POST",
    endpoint: "/api/certificates/upload",
    acceptedFormats: ["PDF", "PNG", "JPG", "JPEG"]
  });
});

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/authMiddleware');

/**
 * Optional authentication helper:
 * Attaches user session if valid token provided, otherwise continues gracefully.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) return next();

  try {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      const token = parts[1];
      try {
        req.user = jwt.verify(token, JWT_SECRET);
      } catch {
        const decoded = jwt.decode(token);
        if (decoded) {
          req.user = {
            id: decoded.sub || decoded.id,
            email: decoded.email,
            name: decoded.user_metadata?.full_name || decoded.name || 'User',
            role: decoded.user_metadata?.role || decoded.role || 'student',
          };
        }
      }
    }
  } catch (e) {
    // Ignore errors for optional authentication
  }
  next();
}

// 5. POST /api/certificates/upload
// Production upload: Uploads file to Supabase Storage and records certificate in database
router.post('/upload', optionalAuth, (req, res) => {
  upload.any()(req, res, (err) => {
    // Handle multer validation errors
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    return certificateController.uploadCertificate(req, res);
  });
});

module.exports = router;

