// ==============================================================================
// Student Micro-Credential Verification Engine - Transcript Controller (Step 6)
// ==============================================================================

const { buildStudentTranscript } = require('../services/transcriptService');
const { generateTranscriptPdf } = require('../services/transcriptPdfService');

/**
 * GET /api/transcript/me
 * Retrieves the comprehensive co-curricular transcript for the authenticated student.
 * 
 * Strict Privacy & Security:
 * - Scoped strictly to req.user.id from verified JWT.
 * - Client-supplied student_id in query or body is strictly ignored.
 */
async function getMyTranscript(req, res) {
  try {
    const studentId = req.user?.id;
    if (!studentId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No student identity found in token.',
      });
    }

    const transcript = await buildStudentTranscript(studentId);
    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: 'Student profile not found in authoritative database.',
      });
    }

    return res.status(200).json({
      success: true,
      data: transcript,
    });
  } catch (err) {
    console.error('Error fetching transcript:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to assemble official transcript: ' + err.message,
    });
  }
}

/**
 * GET /api/transcript/me/pdf
 * Generates and streams an authoritative Co-Curricular Transcript PDF
 * using the exact same filtering rules as the web transcript.
 */
async function downloadMyTranscriptPdf(req, res) {
  try {
    const studentId = req.user?.id;
    if (!studentId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required to download transcript PDF.',
      });
    }

    const transcript = await buildStudentTranscript(studentId);
    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: 'Student profile not found in database.',
      });
    }

    const pdfBuffer = await generateTranscriptPdf(transcript);

    const safeName = (transcript.student?.full_name || 'Student')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `CoCurricular-Transcript-${safeName}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.status(200).end(pdfBuffer);
  } catch (err) {
    console.error('Error generating transcript PDF:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate transcript PDF: ' + err.message,
    });
  }
}

module.exports = {
  getMyTranscript,
  downloadMyTranscriptPdf,
};
