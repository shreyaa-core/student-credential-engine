// ==============================================================================
// Student Micro-Credential Verification Engine - Certificate Upload Controller
// ==============================================================================

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { parseCertificate } = require('../services/certificateParser');
const { extractCertificateInfo } = require('../services/informationExtractor');
const { verifyCertificate } = require('../services/verificationService');

/**
 * Regex to detect URLs in extracted certificate text
 */
const URL_REGEX = /(https?:\/\/[^\s"'<>]+)/i;

/**
 * Controller: uploadCertificate
 * 
 * Flow:
 * 1. Receives uploaded certificate file (PDF, PNG, JPG) or fallback text
 * 2. Parses text using certificateParser.parseCertificate (PDF extraction or OCR)
 * 3. Extracts structured metadata using informationExtractor.extractCertificateInfo
 * 4. Runs point-based verification using verificationService.verifyCertificate
 * 5. Returns certificateData and verification results (without saving to database)
 */
async function uploadCertificate(req, res) {
  let tempFilePath = null;

  try {
    const uploadedFile = req.file || (req.files && req.files[0]);
    let extractedText = '';

    if (uploadedFile) {
      const fileExt = path.extname(uploadedFile.originalname || '').toLowerCase() || '.pdf';
      const fileType = uploadedFile.mimetype || fileExt;

      // Handle file path (diskStorage) or memory buffer (memoryStorage)
      if (uploadedFile.path) {
        tempFilePath = uploadedFile.path;
      } else if (uploadedFile.buffer) {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        tempFilePath = path.join(uploadDir, `temp-${uuidv4()}${fileExt}`);
        fs.writeFileSync(tempFilePath, uploadedFile.buffer);
      }

      // 1. Parse text from certificate (PDF or Image OCR)
      try {
        const parsedResult = await parseCertificate(tempFilePath, fileType);
        extractedText = parsedResult.text || '';
      } catch (parseErr) {
        console.warn('Notice: Text extraction warning:', parseErr.message);
        extractedText = '';
      }
    } else if (req.body.text) {
      // Support raw text directly in request body
      extractedText = req.body.text;
    } else if (req.body.certificateData) {
      // Support pre-extracted certificate data directly
      const certificateData = req.body.certificateData;
      const verification = verifyCertificate(certificateData);

      return res.status(200).json({
        success: true,
        certificateData,
        verification: {
          score: verification.score,
          status: verification.status,
          checks: verification.checks,
        },
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'No certificate file or text provided.',
      });
    }

    // 2. Extract structured certificate information from text
    const extractedInfo = extractCertificateInfo(extractedText);

    // Check for verification URL in extracted text
    const urlMatch = extractedText.match(URL_REGEX);
    const textUrl = urlMatch ? urlMatch[1] : '';

    // 3. Assemble structured certificate data with form fallbacks
    const certificateData = {
      studentName: extractedInfo.studentName || req.body.studentName || req.body.student_name || '',
      courseName: extractedInfo.courseName || req.body.certificate_name || req.body.courseName || '',
      issuer: extractedInfo.issuer || req.body.issuer || '',
      certificateId: extractedInfo.certificateId || req.body.certificateId || req.body.certificate_id || '',
      issueDate: extractedInfo.issueDate || req.body.issueDate || req.body.issue_date || '',
      verificationUrl: textUrl || req.body.verificationUrl || req.body.verification_url || '',
    };

    // 4. Send extracted certificate data to verificationService
    const verification = verifyCertificate(certificateData);

    // 5. Return JSON response (no database saving yet)
    return res.status(200).json({
      success: true,
      certificateData,
      verification: {
        score: verification.score,
        status: verification.status,
        checks: verification.checks,
      },
    });
  } catch (error) {
    console.error('Error processing certificate upload:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process certificate.',
    });
  } finally {
    // Clean up temporary file if written to disk
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupErr) {
        console.error('Failed to cleanup temporary file:', cleanupErr.message);
      }
    }
  }
}

module.exports = {
  uploadCertificate,
};
