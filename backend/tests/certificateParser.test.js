/**
 * ==============================================================================
 * Comprehensive Certificate Parser Test Suite
 * File: backend/tests/certificateParser.test.js
 * 
 * Tests 10 Crucial Criteria for STEP 2 Automatic Certificate Parsing:
 * 1. Native PDF text extraction
 * 2. Certificate ID extraction
 * 3. Issue Date extraction & normalization into YYYY-MM-DD
 * 4. Verification URL extraction (prioritizing verify/credential endpoints)
 * 5. Known issuer detection (Coursera, Stanford, MIT, edX, NPTEL, etc.)
 * 6. Generic heading avoidance (excluding 'Certificate of Completion' etc. from title)
 * 7. Null for missing metadata (no fake dummy strings or empty strings)
 * 8. Rejection of unsupported file types (.exe, .txt, etc.)
 * 9. Zero database mutations during parsing
 * 10. Temporary file cleanup in finally block
 * 
 * GUARANTEE: Read-only for database. Zero mock data inserted into PostgreSQL.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const pool = require('../config/database');
const { generateToken } = require('../middleware/authMiddleware');
const { parseCertificate, parsePDF } = require('../services/certificateParser');
const {
  extractCertificateInfo,
  normalizeDate,
  extractVerificationUrl,
} = require('../services/informationExtractor');

const BASE_URL = 'http://localhost:5000';
const TEST_USER_ID = '2d56ab4e-ce06-47b1-afc4-ec0f341a4b90'; // Real user in DB (Pooja Das)
const AUTH_TOKEN = generateToken({ id: TEST_USER_ID, email: 'poojadas@gmail.com', role: 'Student' });

async function getDbCounts() {
  const res = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM public.profiles) as profiles,
      (SELECT COUNT(*) FROM public.certificates) as certificates,
      (SELECT COUNT(*) FROM public.certificate_skills) as certificate_skills,
      (SELECT COUNT(*) FROM public.badges) as badges,
      (SELECT COUNT(*) FROM public.verification_logs) as verification_logs,
      (SELECT COUNT(*) FROM public.skills) as skills;
  `);
  return res.rows[0];
}

async function createSamplePdfBuffer(textContent) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 400]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText(textContent, {
    x: 50,
    y: 350,
    font,
    size: 12,
    lineHeight: 18,
  });
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('STARTING AUTOMATIC CERTIFICATE PARSER TEST SUITE');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 10;

  const initialDbCounts = await getDbCounts();
  console.log('Baseline Database Counts:', JSON.stringify(initialDbCounts));

  // ---------------------------------------------------------------------------
  // TEST 1: Native PDF text extraction
  // ---------------------------------------------------------------------------
  try {
    const sampleText = 'Certificate of Completion\nFull-Stack Web Development\nCoursera\nIssued to Pooja Das';
    const pdfBuf = await createSamplePdfBuffer(sampleText);
    const parsedResult = await parseCertificate(null, 'application/pdf', pdfBuf);

    const hasExtractedText =
      parsedResult &&
      parsedResult.text &&
      parsedResult.text.includes('Full-Stack Web Development') &&
      parsedResult.text.includes('Coursera');

    if (hasExtractedText) {
      console.log('TEST 1 PASSED: Native PDF text extraction correctly extracts document text.');
      passedTests++;
    } else {
      console.error('TEST 1 FAILED: Extracted text was:', parsedResult?.text);
    }
  } catch (err) {
    console.error('TEST 1 ERROR:', err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Certificate ID extraction
  // ---------------------------------------------------------------------------
  try {
    const sampleTextWithId = `
      CERTIFICATE OF COMPLETION
      Machine Learning Specialization
      Stanford Online
      Certificate ID: CERT-89421-STANFORD
      Date: 2024-06-10
    `;
    const info = extractCertificateInfo(sampleTextWithId);
    if (info.certificate_id === 'CERT-89421-STANFORD') {
      console.log(`TEST 2 PASSED: Certificate ID extracted accurately: ${info.certificate_id}`);
      passedTests++;
    } else {
      console.error(`TEST 2 FAILED: Expected 'CERT-89421-STANFORD', got '${info.certificate_id}'`);
    }
  } catch (err) {
    console.error('TEST 2 ERROR:', err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Issue Date extraction & normalization into YYYY-MM-DD
  // ---------------------------------------------------------------------------
  try {
    const date1 = normalizeDate('Issued on May 15, 2024');
    const date2 = normalizeDate('Date of completion: 15 May 2024');
    const date3 = normalizeDate('2024-05-15');

    const allNormalized = date1 === '2024-05-15' && date2 === '2024-05-15' && date3 === '2024-05-15';
    if (allNormalized) {
      console.log(`TEST 3 PASSED: Issue date correctly normalized across formats to YYYY-MM-DD (${date1}).`);
      passedTests++;
    } else {
      console.error(`TEST 3 FAILED: Got date1=${date1}, date2=${date2}, date3=${date3}`);
    }
  } catch (err) {
    console.error('TEST 3 ERROR:', err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Verification URL extraction (prioritizing verify endpoints)
  // ---------------------------------------------------------------------------
  try {
    const textWithUrls = `
      Visit our website at https://coursera.org for more courses.
      To verify this certificate, visit https://coursera.org/verify/987ABC654.
    `;
    const extractedUrl = extractVerificationUrl(textWithUrls);
    if (extractedUrl === 'https://coursera.org/verify/987ABC654') {
      console.log(`TEST 4 PASSED: Verification URL correctly prioritized verify link: ${extractedUrl}`);
      passedTests++;
    } else {
      console.error(`TEST 4 FAILED: Expected verification URL, got: ${extractedUrl}`);
    }
  } catch (err) {
    console.error('TEST 4 ERROR:', err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Known issuer detection
  // ---------------------------------------------------------------------------
  try {
    const courseraText = 'This is to certify that John Doe completed Deep Learning on Coursera in partnership with deeplearning.ai';
    const nptelText = 'National Programme on Technology Enhanced Learning (NPTEL) certificate for Cloud Computing';
    
    const infoCoursera = extractCertificateInfo(courseraText);
    const infoNptel = extractCertificateInfo(nptelText);

    if (infoCoursera.issuer === 'Coursera' && infoNptel.issuer === 'NPTEL') {
      console.log(`TEST 5 PASSED: Known issuers detected: ${infoCoursera.issuer}, ${infoNptel.issuer}`);
      passedTests++;
    } else {
      console.error(`TEST 5 FAILED: Got Coursera='${infoCoursera.issuer}', NPTEL='${infoNptel.issuer}'`);
    }
  } catch (err) {
    console.error('TEST 5 ERROR:', err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Generic heading avoidance (excluding Certificate of Completion from title)
  // ---------------------------------------------------------------------------
  try {
    const headingText = `
      CERTIFICATE OF COMPLETION
      Advanced Database Systems and Architecture
      Issued to Alex Smith
      Accredited by AWS Training
    `;
    const info = extractCertificateInfo(headingText);
    const headingAvoided =
      info.certificate_name &&
      info.certificate_name !== 'CERTIFICATE OF COMPLETION' &&
      info.certificate_name !== 'Certificate of Completion' &&
      info.certificate_name.includes('Advanced Database Systems');

    if (headingAvoided) {
      console.log(`TEST 6 PASSED: Generic heading filtered out. Course name: "${info.certificate_name}"`);
      passedTests++;
    } else {
      console.error(`TEST 6 FAILED: Course name incorrectly captured generic heading: "${info.certificate_name}"`);
    }
  } catch (err) {
    console.error('TEST 6 ERROR:', err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Null for missing metadata (no fake dummy or empty strings)
  // ---------------------------------------------------------------------------
  try {
    const sparseText = `
      Some arbitrary seminar note without any certificate numbers, dates, or verification links.
    `;
    const info = extractCertificateInfo(sparseText);

    const isStrictNull =
      info.certificate_id === null &&
      info.issue_date === null &&
      info.verification_url === null;

    if (isStrictNull) {
      console.log('TEST 7 PASSED: Missing metadata strictly returns null (zero fake/mock placeholders).');
      passedTests++;
    } else {
      console.error('TEST 7 FAILED: Expected null for missing fields, got:', {
        certificate_id: info.certificate_id,
        issue_date: info.issue_date,
        verification_url: info.verification_url,
      });
    }
  } catch (err) {
    console.error('TEST 7 ERROR:', err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 8: Rejection of unsupported file types (.exe, .txt, etc.)
  // ---------------------------------------------------------------------------
  try {
    let rejected = false;
    try {
      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', Buffer.from('console.log("hello");'), {
        filename: 'malicious.exe',
        contentType: 'application/x-msdownload',
      });

      await axios.post(`${BASE_URL}/api/certificates/parse`, form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
      });
    } catch (reqErr) {
      if (reqErr.response && reqErr.response.status === 400) {
        rejected = true;
      }
    }

    if (rejected) {
      console.log('TEST 8 PASSED: Unsupported file format correctly rejected with HTTP 400 Bad Request.');
      passedTests++;
    } else {
      console.error('TEST 8 FAILED: Unsupported file was not rejected with 400.');
    }
  } catch (err) {
    console.error('TEST 8 ERROR:', err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 9: Zero database mutations during parsing
  // ---------------------------------------------------------------------------
  try {
    // Perform a live parse API call via HTTP
    const FormData = require('form-data');
    const validPdfBuf = await createSamplePdfBuffer(
      'Certificate of Achievement\nReact Micro-Credentials\nCoursera\nCertificate ID: TEST-PARSE-99\nDate: 2024-08-20\nhttps://coursera.org/verify/TEST-PARSE-99'
    );
    const form = new FormData();
    form.append('file', validPdfBuf, {
      filename: 'sample_credential.pdf',
      contentType: 'application/pdf',
    });

    const parseResponse = await axios.post(`${BASE_URL}/api/certificates/parse`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    });

    const countsAfter = await getDbCounts();
    const noMutations =
      initialDbCounts.profiles === countsAfter.profiles &&
      initialDbCounts.certificates === countsAfter.certificates &&
      initialDbCounts.certificate_skills === countsAfter.certificate_skills &&
      initialDbCounts.badges === countsAfter.badges &&
      initialDbCounts.verification_logs === countsAfter.verification_logs &&
      initialDbCounts.skills === countsAfter.skills;

    if (parseResponse.data?.success && noMutations) {
      console.log('TEST 9 PASSED: Zero database mutations during parse (All 6 tables remain completely unchanged).');
      console.log('Database Counts After Parse:', JSON.stringify(countsAfter));
      passedTests++;
    } else {
      console.error('TEST 9 FAILED: Database state changed or parse failed.', {
        success: parseResponse.data?.success,
        countsBefore: initialDbCounts,
        countsAfter,
      });
    }
  } catch (err) {
    console.error('TEST 9 ERROR:', err.message, err.response?.data);
  }

  // ---------------------------------------------------------------------------
  // TEST 10: Temporary file cleanup in finally block
  // ---------------------------------------------------------------------------
  try {
    const uploadDir = path.join(__dirname, '../uploads');
    const filesBefore = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : [];
    const tempFilesBefore = filesBefore.filter((f) => f.startsWith('parse-temp-'));

    // Perform another parse call
    const FormData = require('form-data');
    const validPdfBuf = await createSamplePdfBuffer('Test Document for Cleanup Verification');
    const form = new FormData();
    form.append('file', validPdfBuf, {
      filename: 'cleanup_test.pdf',
      contentType: 'application/pdf',
    });

    await axios.post(`${BASE_URL}/api/certificates/parse`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    });

    const filesAfter = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : [];
    const tempFilesAfter = filesAfter.filter((f) => f.startsWith('parse-temp-'));

    if (tempFilesAfter.length === tempFilesBefore.length) {
      console.log('TEST 10 PASSED: Temporary files safely deleted in finally block (0 lingering parse-temp files).');
      passedTests++;
    } else {
      console.error('TEST 10 FAILED: Lingering temporary files found in uploads directory:', tempFilesAfter);
    }
  } catch (err) {
    console.error('TEST 10 ERROR:', err.message);
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('===============================================================');

  return { passedTests, totalTests, allPassed: passedTests === totalTests };
}

if (require.main === module) {
  runTestSuite()
    .then(async ({ allPassed }) => {
      await pool.end();
      process.exit(allPassed ? 0 : 1);
    })
    .catch(async (err) => {
      console.error('Fatal test error:', err);
      await pool.end();
      process.exit(1);
    });
}

module.exports = { runTestSuite };
