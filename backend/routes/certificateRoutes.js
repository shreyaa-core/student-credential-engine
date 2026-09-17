// ==============================================================================
// Student Micro-Credential Verification Engine - Certificate Routes
// ==============================================================================

const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const certificateController = require('../controllers/certificateController');

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

// 4. GET /api/certificates/upload
// Helpful response when opened directly in a web browser via GET
router.get('/upload', (req, res) => {
  res.status(200).json({
    message: "Certificate upload endpoint is ready. Send an HTTP POST request with your file to upload.",
    method: "POST",
    endpoint: "/api/certificates/upload",
    acceptedFormats: ["PDF", "PNG", "JPG", "JPEG"]
  });
});

// 5. POST /api/certificates/upload
// Parses uploaded certificate, extracts information, and verifies with verificationService
router.post('/upload', (req, res) => {
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
