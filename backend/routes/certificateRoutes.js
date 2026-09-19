// ==============================================================================
// Student Micro-Credential Verification Engine - Certificate Routes
// ==============================================================================

const express = require('express');
const multer = require('multer');
const path = require('path');
const pool = require('../config/database');
const certificateController = require('../controllers/certificateController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// 1. Configure multer memory storage (buffers file in memory for direct processing)
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
 * Fetch all certificates from PostgreSQL 'certificates' table.
 * 
 * Return fields:
 * - certificate_name
 * - issuer
 * - status
 * - file_url
 * - created_at / createdDate
 */
router.get(['/', '/api/certificates'], requireAuth, async (req, res) => {
  try {
    let certificates = [];
    const isAdmin = (req.user?.role || '').toLowerCase() === 'admin';

    try {
      const query = isAdmin
        ? 'SELECT * FROM certificates ORDER BY created_at DESC'
        : 'SELECT * FROM certificates WHERE student_id = $1 ORDER BY created_at DESC';
      const params = isAdmin ? [] : [req.user.id];

      const result = await pool.query(query, params);
      certificates = result.rows || [];
    } catch (dbErr) {
      console.warn('Notice: Error querying certificates table from PostgreSQL:', dbErr.message);
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
        : null,
      issueDate: item.created_at
        ? new Date(item.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : null,
      verification_score: item.verification_score || 0,
      student_id: item.student_id,
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
router.get(['/upload', '/api/certificates/upload'], (req, res) => {
  return res.status(200).json({
    message: "Certificate upload endpoint is active. Send an HTTP POST (multipart/form-data) request with certificate file.",
    method: "POST",
    endpoint: "/api/certificates/upload",
    expectedFormData: {
      file: "PDF, PNG, JPG file binary",
      certificate_name: "Course / Micro-Credential Name",
      issuer: "Issuing Institution or Organization",
    },
    frontendUploadPage: "http://localhost:3000/upload"
  });
});

// 5. POST /api/certificates/upload
// Production upload: Uploads file locally and records certificate in database strictly for req.user.id
router.post(['/upload', '/api/certificates/upload'], requireAuth, (req, res) => {
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

