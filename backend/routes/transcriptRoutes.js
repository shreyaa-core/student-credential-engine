// ==============================================================================
// Student Micro-Credential Verification Engine - Transcript Routes (Step 6)
// ==============================================================================

const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const transcriptController = require('../controllers/transcriptController');

const router = express.Router();

/**
 * GET /api/transcript/me
 * Retrieves the authenticated student's official co-curricular transcript.
 */
router.get(['/me', '/api/transcript/me'], requireAuth, transcriptController.getMyTranscript);

/**
 * GET /api/transcript/me/pdf
 * Streams a publication-quality Co-Curricular Transcript PDF for the authenticated student.
 */
router.get(['/me/pdf', '/api/transcript/me/pdf'], requireAuth, transcriptController.downloadMyTranscriptPdf);

module.exports = router;
