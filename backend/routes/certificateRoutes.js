// ==============================================================================
// Student Micro-Credential Verification Engine - Certificate Routes
// ==============================================================================

const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');

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
// Uploads file to Supabase Storage and inserts certificate record into Supabase PostgreSQL
router.post('/upload', (req, res) => {
  upload.any()(req, res, async (err) => {
    // Handle multer validation errors
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    // Ensure a file was provided
    const uploadedFile = req.files && req.files[0];
    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please select a PDF, PNG, or JPG certificate file.',
      });
    }

    try {
      // 1. Generate unique filename using UUID v4 preserving original extension
      const fileExt = path.extname(uploadedFile.originalname).toLowerCase();
      const uniqueFileName = `${uuidv4()}${fileExt}`;

      // 2. Upload file directly into Supabase Storage 'certificates' bucket
      const { data: storageData, error: storageError } = await supabase.storage
        .from('certificates')
        .upload(uniqueFileName, uploadedFile.buffer, {
          contentType: uploadedFile.mimetype,
          upsert: false,
        });

      if (storageError) {
        return res.status(500).json({
          success: false,
          message: `Storage upload failed: ${storageError.message}`,
        });
      }

      // 3. Retrieve public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('certificates')
        .getPublicUrl(storageData.path);

      const fileUrl = urlData.publicUrl;

      // 4. Extract form fields or use fallbacks
      const certificateName =
        req.body.certificate_name ||
        req.body.title ||
        uploadedFile.originalname;

      const issuer = req.body.issuer || 'Unknown Issuer';
      const fileType =
        uploadedFile.mimetype || fileExt.replace('.', '').toUpperCase();

      // Dummy student UUID (acts as placeholder until authentication is added)
      const dummyStudentId = '00000000-0000-0000-0000-000000000001';

      // 5. Insert certificate record into Supabase PostgreSQL 'certificates' table
      const { error: dbError } = await supabase
        .from('certificates')
        .insert([
          {
            student_id: dummyStudentId,
            certificate_name: certificateName,
            issuer: issuer,
            file_url: fileUrl,
            file_type: fileType,
            status: 'PENDING',
          },
        ]);

      if (dbError) {
        return res.status(500).json({
          success: false,
          message: `Database insert failed: ${dbError.message}`,
        });
      }

      // 6. Return expected success response
      res.status(200).json({
        success: true,
        message: 'Certificate saved',
      });
    } catch (uploadError) {
      res.status(500).json({
        success: false,
        message: uploadError.message,
      });
    }
  });
});

module.exports = router;
