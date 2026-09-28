/**
 * Certificate Autofill & Information Extraction Test Suite
 * File: backend/tests/certificateAutofill.test.js
 * 
 * Verifies:
 * 1. Extraction of Course/Certificate Title
 * 2. Extraction of Issuer Name
 * 3. Extraction of Issue Date
 * 4. Extraction of Verification URL
 * 5. Extraction of Purpose / Description (and null when absent)
 * 6. Extraction of Certificate ID
 * 7. Parse API response payload shape containing all auto-fill fields
 */

const assert = require('assert');
const {
  extractCertificateInfo,
  extractCourseName,
  extractIssuer,
  extractIssueDate,
  extractVerificationUrl,
  extractPurpose,
} = require('../services/informationExtractor');

async function runAutofillTests() {
  console.log('===============================================================');
  console.log('STARTING CERTIFICATE AUTO-FILL EXTRACTION TESTS');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✅ PASSED: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAILED: ${name}`);
      console.error(`   Error: ${err.message}`);
    }
  }

  // 1. Title Extraction
  test('Extracts course/certificate title accurately', () => {
    const text = `Certificate of Completion
This is to certify that John Doe has completed
Machine Learning Specialization
Authorized by Stanford Online and Coursera`;
    const title = extractCourseName(text);
    assert.strictEqual(title, 'Machine Learning Specialization');
  });

  // 2. Issuer Extraction
  test('Extracts issuer name accurately', () => {
    const text = `Coursera Course Certificate
This is to certify that Jane Smith successfully completed
Deep Learning by DeepLearning.AI on Coursera`;
    const issuer = extractIssuer(text);
    assert.strictEqual(issuer, 'Coursera');
  });

  // 3. Issue Date Extraction & Normalization
  test('Extracts and normalizes issue date to YYYY-MM-DD', () => {
    const text = `Date of Issue: September 15, 2024
Certificate ID: CERT-12345`;
    const date = extractIssueDate(text);
    assert.strictEqual(date, '2024-09-15');
  });

  // 4. Verification URL Extraction
  test('Extracts verification URL', () => {
    const text = `Verify at: https://coursera.org/verify/ABC123XYZ456
Congratulations on your achievement!`;
    const url = extractVerificationUrl(text);
    assert.strictEqual(url, 'https://coursera.org/verify/ABC123XYZ456');
  });

  // 5. Purpose / Description Extraction
  test('Extracts purpose description when phrasing is present', () => {
    const text = `Certificate of Achievement
This certifies that John Doe
for successfully completing the online non-credit course
Python for Everybody
Coursera`;
    const purpose = extractPurpose(text);
    assert.ok(purpose && purpose.includes('for successfully completing the online non-credit course'));
  });

  test('Returns null for purpose when no description phrasing is present', () => {
    const text = `Certificate
John Doe
Python Mastery
2024-01-01`;
    const purpose = extractPurpose(text);
    assert.strictEqual(purpose, null);
  });

  // 6. Complete extractCertificateInfo integration
  test('extractCertificateInfo returns all 6 required autofill properties', () => {
    const text = `Certificate of Completion
This is to certify that Alex Mercer
has successfully completed the requirements for
Cloud Computing Architecture
Issuer: Amazon Web Services (AWS)
Issue Date: January 10, 2025
Verify at: https://aws.amazon.com/verify/AWS-98765-XYZ
Credential ID: AWS-98765-XYZ`;

    const info = extractCertificateInfo(text);

    assert.strictEqual(info.certificate_name, 'Cloud Computing Architecture');
    assert.strictEqual(info.issuer, 'Amazon Web Services');
    assert.strictEqual(info.certificate_id, 'AWS-98765-XYZ');
    assert.strictEqual(info.issue_date, '2025-01-10');
    assert.strictEqual(info.verification_url, 'https://aws.amazon.com/verify/AWS-98765-XYZ');
    assert.ok(info.purpose, 'Purpose should be present');
  });

  console.log('\n===============================================================');
  console.log(`AUTO-FILL TEST SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log('===============================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

if (require.main === module) {
  runAutofillTests();
}

module.exports = { runAutofillTests };
