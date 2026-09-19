// ==============================================================================
// Student Micro-Credential Verification Engine - Certificate Upload Controller
// ==============================================================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { parseCertificate } = require('../services/certificateParser');
const { extractCertificateInfo } = require('../services/informationExtractor');
const { verifyCertificate } = require('../services/verificationService');
const { verifyIssuerCertificate } = require('../services/issuerVerificationService');
const { mapSkillsFromCourse } = require('../services/skillMappingService');
const { analyzeCertificateSkills, saveCertificateSkills } = require('../services/skillAnalysisService');

/**
 * Regex to detect URLs in extracted certificate text
 */
const URL_REGEX = /(https?:\/\/[^\s"'<>]+)/i;

/**
 * Standard UUID v4 regex validator
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Controller: uploadCertificate
 * 
 * Production Flow:
 * 1. Authenticates student and validates profile
 * 2. Receives file (PDF, PNG, JPG) or fallback text
 * 3. Computes SHA-256 file hash and checks PostgreSQL certificates table for duplicates
 * 4. Parses text using certificateParser (PDF extraction or OCR)
 * 5. Extracts structured metadata using informationExtractor
 * 6. Verifies certificate authenticity via verificationService
 * 7. Saves certificate file locally to uploads directory
 * 8. Inserts complete record into PostgreSQL 'certificates' table (including file_hash)
 * 9. Links mapped skills in certificate_skills table
 * 10. Returns saved database certificate and verification details
 */
async function uploadCertificate(req, res) {
  let tempFilePath = null;

  try {
    // 1. Enforce authenticated student_id (must match req.user.id)
    if (!req.user || !req.user.id || !UUID_REGEX.test(req.user.id)) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in to upload a certificate.',
      });
    }

    const student_id = req.user.id;

    // Verify profile exists in PostgreSQL
    const profCheck = await pool.query('SELECT id FROM profiles WHERE id = $1', [student_id]);
    if (profCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Authenticated user profile not found in database.',
      });
    }

    const uploadedFile = req.file || (req.files && req.files[0]);
    let extractedText = '';
    let fileBuffer = null;
    let fileExt = '.pdf';
    let mimeType = 'application/pdf';
    let fileHash = null;

    if (uploadedFile) {
      fileExt = path.extname(uploadedFile.originalname || '').toLowerCase() || '.pdf';
      mimeType = uploadedFile.mimetype || 'application/pdf';

      // Read file buffer
      if (uploadedFile.buffer) {
        fileBuffer = uploadedFile.buffer;
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        tempFilePath = path.join(uploadDir, `temp-${uuidv4()}${fileExt}`);
        fs.writeFileSync(tempFilePath, fileBuffer);
      } else if (uploadedFile.path) {
        tempFilePath = uploadedFile.path;
        if (fs.existsSync(tempFilePath)) {
          fileBuffer = fs.readFileSync(tempFilePath);
        }
      }

      // Calculate SHA-256 hash and check for duplicates in PostgreSQL BEFORE parsing/OCR
      if (fileBuffer) {
        fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        const dupCheck = await pool.query(
          'SELECT id, student_id, certificate_name FROM certificates WHERE file_hash = $1 LIMIT 1',
          [fileHash]
        );

        if (dupCheck.rows.length > 0) {
          const existingCert = dupCheck.rows[0];

          // Clean up temp file immediately
          if (tempFilePath && fs.existsSync(tempFilePath)) {
            try {
              fs.unlinkSync(tempFilePath);
            } catch (_) {}
            tempFilePath = null;
          }

          if (existingCert.student_id === student_id) {
            return res.status(409).json({
              success: false,
              code: 'DUPLICATE_CERTIFICATE',
              message: 'This certificate file has already been uploaded.',
            });
          } else {
            return res.status(409).json({
              success: false,
              code: 'DUPLICATE_CERTIFICATE',
              message: 'This certificate file has already been registered and cannot be uploaded again.',
            });
          }
        }
      }

      // 2. Parse text from certificate (PDF or Image OCR)
      try {
        const parsedResult = await parseCertificate(tempFilePath, mimeType, fileBuffer);
        extractedText = parsedResult.text || '';
      } catch (parseErr) {
        console.warn('Notice: Text extraction warning:', parseErr.message);
        extractedText = '';
      }
    } else if (req.body.text) {
      extractedText = req.body.text;
    } else if (!req.body.certificate_name && !req.body.certificateData) {
      return res.status(400).json({
        success: false,
        message: 'No certificate file or details provided. Please select a PDF or image file.',
      });
    }

    // 2. Extract structured certificate information from text (preserving existing deterministic extractor)
    const extractedInfo = extractCertificateInfo(extractedText);

    // Check for verification URL in extracted text
    const urlMatch = extractedText.match(URL_REGEX);
    const textUrl = urlMatch ? urlMatch[1] : '';

    // 3. Assemble structured certificate data with form inputs taking priority
    const certificateName =
      (req.body.certificate_name || req.body.certificateName || extractedInfo.courseName || 'Micro-Credential Certificate').trim();
    const issuer =
      (req.body.issuer || extractedInfo.issuer || 'Accredited Institution').trim();
    const studentName =
      (req.body.studentName || req.body.student_name || req.user?.name || extractedInfo.studentName || '').trim();

    // Ensure safe date string for PostgreSQL DATE type
    let safeIssueDate = null;
    const rawDate = extractedInfo.issueDate || req.body.issueDate || req.body.issue_date;
    if (rawDate) {
      const parsedDate = new Date(rawDate);
      if (!isNaN(parsedDate.getTime())) {
        safeIssueDate = parsedDate.toISOString().split('T')[0];
      }
    }
    if (!safeIssueDate) {
      safeIssueDate = new Date().toISOString().split('T')[0];
    }

    const certificateData = {
      studentName,
      courseName: certificateName,
      issuer,
      certificateId: extractedInfo.certificateId || req.body.certificateId || req.body.certificate_id || '',
      issueDate: safeIssueDate,
      verificationUrl: textUrl || req.body.verificationUrl || req.body.verification_url || '',
      isDuplicate: false,
    };

    // 4. Run structural metadata checks (scores metadata completeness only, NEVER confers VERIFIED status)
    const verification = verifyCertificate(certificateData);

    // 5. Run official issuer verification (SSRF-protected, domain-whitelisted, defensive authenticity)
    let issuerVerification = null;
    try {
      issuerVerification = await verifyIssuerCertificate({
        issuer: certificateData.issuer,
        verificationUrl: certificateData.verificationUrl,
        certificateId: certificateData.certificateId,
      });
    } catch (issuerErr) {
      console.warn('Notice: Non-fatal issuer verification exception:', issuerErr.message);
      issuerVerification = {
        success: false,
        status: 'MANUAL_REVIEW',
        reason: `Issuer verification encountered internal exception: ${issuerErr.message}`,
        issuer: certificateData.issuer,
        method: 'OFFICIAL_URL',
        httpStatus: null,
        certificateIdMatched: false,
        latencyMs: 0,
      };
    }

    // 6. Map verification status and score according to strict authenticity rules:
    // - ONLY authoritative confirmation by issuer may produce VERIFIED (score = 100)
    // - Explicit issuer rejection produces REJECTED (score = 0)
    // - All others (UNSUPPORTED_ISSUER, VERIFICATION_UNCONFIRMED, TIMEOUT, NOT_REACHABLE, INVALID_URL, UNTRUSTED_ISSUER)
    //   safely map to MANUAL_REVIEW with neutral score capped at 60.
    let status = 'MANUAL_REVIEW';
    let verificationScore = Math.min(verification.score || 50, 60);

    if (issuerVerification.status === 'VERIFIED' && issuerVerification.success === true) {
      status = 'VERIFIED';
      verificationScore = 100;
    } else if (issuerVerification.status === 'REJECTED') {
      status = 'REJECTED';
      verificationScore = 0;
    } else if (issuerVerification.status === 'UNSUPPORTED_ISSUER') {
      status = 'MANUAL_REVIEW';
      verificationScore = Math.min(verification.score || 50, 60);
    } else {
      status = 'MANUAL_REVIEW';
      verificationScore = Math.min(verification.score || 50, 60);
    }

    // If text extraction failed completely, enforce MANUAL_REVIEW
    if (!extractedText || extractedText.trim().length === 0) {
      status = 'MANUAL_REVIEW';
      verificationScore = Math.min(verificationScore, 40);
    }

    // Prepare sanitized issuer verification evidence payload
    const issuerEvidencePayload = {
      issuer: issuerVerification.issuer,
      method: issuerVerification.method,
      status: issuerVerification.status,
      httpStatus: issuerVerification.httpStatus || null,
      certificateIdMatched: Boolean(issuerVerification.certificateIdMatched),
      latencyMs: issuerVerification.latencyMs || 0,
      verifiedAt: new Date().toISOString(),
      reason: issuerVerification.reason || (issuerVerification.status === 'VERIFIED' ? 'Authoritative confirmation received from issuer' : 'Manual verification required'),
      evidence: issuerVerification.evidence || null,
    };

    // Determine file_type (e.g. 'PDF', 'PNG', 'JPG')
    const fileTypeClean = fileExt ? fileExt.replace('.', '').toUpperCase() : 'PDF';

    // 7. Save file locally (backend/uploads/)
    const uniqueFileTag = `${Date.now()}-${uuidv4().substring(0, 8)}${fileExt}`;
    const localUploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(localUploadDir)) {
      fs.mkdirSync(localUploadDir, { recursive: true });
    }
    const localFileName = `cert-${uniqueFileTag}`;
    const localFilePath = path.join(localUploadDir, localFileName);
    let file_url = null;

    if (fileBuffer) {
      fs.writeFileSync(localFilePath, fileBuffer);
      file_url = `http://localhost:5000/uploads/${localFileName}`;
    } else {
      file_url = `http://localhost:5000/uploads/default-certificate.pdf`;
    }

    // 8. Save certificate into PostgreSQL 'certificates' table
    let savedRecord = null;

    try {
      const insertQuery = `
        INSERT INTO certificates (
          student_id,
          certificate_name,
          issuer,
          file_url,
          file_type,
          status,
          verification_score,
          file_hash,
          raw_text,
          certificate_id,
          issue_date,
          verification_url,
          verification_evidence,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        RETURNING *;
      `;
      const insertRes = await pool.query(insertQuery, [
        student_id,
        certificateName,
        issuer,
        file_url,
        fileTypeClean,
        status,
        verificationScore,
        fileHash,
        extractedText || null,
        certificateData.certificateId || null,
        certificateData.issueDate || null,
        certificateData.verificationUrl || null,
        JSON.stringify({ issuerVerification: issuerEvidencePayload }),
      ]);
      if (insertRes.rows.length > 0) {
        savedRecord = insertRes.rows[0];
      }

      // Step 4C requirement 7: Explicitly UPDATE raw_text for the authenticated user's certificate ID
      if (extractedText && savedRecord?.id) {
        await pool.query(
          'UPDATE certificates SET raw_text = $1 WHERE id = $2 AND student_id = $3',
          [extractedText, savedRecord.id, student_id]
        );
        savedRecord.raw_text = extractedText;
      }

      // Step 4D: Real Certificate Skill Analysis (evidence-based against PostgreSQL taxonomy)
      let skillAnalysis = {
        aiConfigured: false,
        aiStatus: 'NOT CONFIGURED',
        skills: [],
        unmatchedSkills: [],
        timing: { totalDurationMs: 0 },
      };

      if (extractedText && savedRecord?.id) {
        try {
          skillAnalysis = await analyzeCertificateSkills(extractedText, pool);
          await saveCertificateSkills(savedRecord.id, student_id, skillAnalysis.skills || [], pool, skillAnalysis);
        } catch (skillErr) {
          console.warn('Notice: Non-fatal skill analysis warning:', skillErr.message);
        }
      }

      savedRecord.skills = (skillAnalysis.skills || []).map((s) => s.skillName);
      savedRecord.skillAnalysis = skillAnalysis;
    } catch (dbErr) {
      console.error('PostgreSQL certificates table insert error:', dbErr.message, 'Code:', dbErr.code);
      let userMessage = 'Failed to record certificate in database.';
      if (dbErr.code === '23514') {
        userMessage = 'Certificate could not be saved because its verification status is not supported by database constraints.';
      }
      return res.status(500).json({
        success: false,
        message: userMessage,
      });
    }

    const detectedSkillNames = savedRecord.skills || [];

    // 9. Return actual upload and database registration response
    return res.status(201).json({
      success: true,
      message: 'Certificate uploaded and registered in PostgreSQL database successfully.',
      certificate: savedRecord,
      file_url: savedRecord.file_url,
      skills: detectedSkillNames,
      skillAnalysis: savedRecord.skillAnalysis || {
        aiConfigured: false,
        aiStatus: 'NOT CONFIGURED',
        skills: [],
        unmatchedSkills: [],
      },
      verification: {
        score: savedRecord.verification_score,
        status: savedRecord.status,
        checks: verification.checks,
        extractedData: certificateData,
        issuerVerification: issuerEvidencePayload,
      },
    });
  } catch (error) {
    console.error('Error processing certificate upload:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process certificate.',
    });
  } finally {
    // Clean up temporary file if written to disk for OCR
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

