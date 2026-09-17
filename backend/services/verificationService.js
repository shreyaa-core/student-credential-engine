// ==============================================================================
// Student Micro-Credential Verification Engine - Verification Service
// ==============================================================================

// Recognized issuers/institutions for the "Known issuer" rule
const KNOWN_ISSUERS = [
  'MIT Open Learning',
  'Stanford Online',
  'Harvard University',
  'Coursera',
  'edX',
  'Udacity',
  'Udemy',
  'freeCodeCamp',
  'Google',
  'Microsoft',
  'IBM',
  'AWS',
  'Amazon Web Services',
  'Blockchain Academy',
  'Database Academy',
  'University',
  'Institute of Technology',
  'College',
];

// In-memory set to simulate duplicate certificate ID detection without a database
const existingCertificateIds = new Set([
  'DUPLICATE_SAMPLE_001',
  'REVOKED_HASH_999',
]);

/**
 * Verifies extracted certificate information using point-based rules.
 * 
 * @param {object} certificate - Certificate details to verify
 * @param {string} certificate.studentName - Full name of the student
 * @param {string} certificate.courseName - Name of the course or program
 * @param {string} certificate.issuer - Issuing organization or authority
 * @param {string} certificate.certificateId - Unique certificate ID or hash
 * @param {string} certificate.issueDate - Date of issuance
 * @param {string} certificate.verificationUrl - Verification link or portal URL
 * 
 * @returns {{
 *   score: number,
 *   status: string,
 *   checks: Array<{ rule: string, points: number, passed: boolean, message: string }>
 * }}
 */
function verifyCertificate(certificate = {}) {
  let score = 0;
  const checks = [];

  const {
    studentName = '',
    courseName = '',
    issuer = '',
    certificateId = '',
    issueDate = '',
    verificationUrl = '',
  } = certificate;

  // 1. Rule: Known issuer (20 points)
  const isKnownIssuer =
    Boolean(issuer) &&
    KNOWN_ISSUERS.some((known) =>
      issuer.toLowerCase().includes(known.toLowerCase())
    );

  if (isKnownIssuer) {
    score += 20;
    checks.push({
      rule: 'Known issuer',
      points: 20,
      passed: true,
      message: `Issuer "${issuer}" is recognized as a known accredited authority.`,
    });
  } else {
    checks.push({
      rule: 'Known issuer',
      points: 0,
      passed: false,
      message: issuer
        ? `Issuer "${issuer}" is not in the recognized accredited list.`
        : 'Issuer is missing.',
    });
  }

  // 2. Rule: Certificate ID exists (20 points)
  const hasCertificateId = Boolean(certificateId && certificateId.trim().length > 0);

  if (hasCertificateId) {
    score += 20;
    checks.push({
      rule: 'Certificate ID exists',
      points: 20,
      passed: true,
      message: `Certificate ID "${certificateId}" is present.`,
    });
  } else {
    checks.push({
      rule: 'Certificate ID exists',
      points: 0,
      passed: false,
      message: 'Certificate ID is missing.',
    });
  }

  // 3. Rule: Student name exists (10 points)
  const hasStudentName = Boolean(studentName && studentName.trim().length > 0);

  if (hasStudentName) {
    score += 10;
    checks.push({
      rule: 'Student name exists',
      points: 10,
      passed: true,
      message: `Student name "${studentName}" is present.`,
    });
  } else {
    checks.push({
      rule: 'Student name exists',
      points: 0,
      passed: false,
      message: 'Student name is missing.',
    });
  }

  // 4. Rule: Course name exists (10 points)
  const hasCourseName = Boolean(courseName && courseName.trim().length > 0);

  if (hasCourseName) {
    score += 10;
    checks.push({
      rule: 'Course name exists',
      points: 10,
      passed: true,
      message: `Course name "${courseName}" is present.`,
    });
  } else {
    checks.push({
      rule: 'Course name exists',
      points: 0,
      passed: false,
      message: 'Course name is missing.',
    });
  }

  // 5. Rule: Issue date exists (10 points)
  const hasIssueDate = Boolean(issueDate && issueDate.trim().length > 0);

  if (hasIssueDate) {
    score += 10;
    checks.push({
      rule: 'Issue date exists',
      points: 10,
      passed: true,
      message: `Issue date "${issueDate}" is present.`,
    });
  } else {
    checks.push({
      rule: 'Issue date exists',
      points: 0,
      passed: false,
      message: 'Issue date is missing.',
    });
  }

  // 6. Rule: Verification URL exists (20 points)
  const hasVerificationUrl = Boolean(
    verificationUrl &&
      verificationUrl.trim().length > 0 &&
      /^https?:\/\//i.test(verificationUrl.trim())
  );

  if (hasVerificationUrl) {
    score += 20;
    checks.push({
      rule: 'Verification URL exists',
      points: 20,
      passed: true,
      message: `Verification URL "${verificationUrl}" is valid and reachable.`,
    });
  } else {
    checks.push({
      rule: 'Verification URL exists',
      points: 0,
      passed: false,
      message: verificationUrl
        ? 'Verification URL is not a valid HTTP/HTTPS link.'
        : 'Verification URL is missing.',
    });
  }

  // 7. Rule: No duplicate (10 points)
  const isDuplicate = hasCertificateId && existingCertificateIds.has(certificateId.trim());

  if (!isDuplicate) {
    score += 10;
    checks.push({
      rule: 'No duplicate',
      points: 10,
      passed: true,
      message: 'Certificate ID is unique and not registered previously.',
    });
  } else {
    checks.push({
      rule: 'No duplicate',
      points: 0,
      passed: false,
      message: `Certificate ID "${certificateId}" already exists in the registry.`,
    });
  }

  // Determine verification status from total score
  let status = 'SUSPICIOUS';

  if (score >= 80) {
    status = 'VERIFIED';
  } else if (score >= 50) {
    status = 'MANUAL REVIEW';
  } else {
    status = 'SUSPICIOUS';
  }

  return {
    score,
    status,
    checks,
  };
}

module.exports = {
  verifyCertificate,
  KNOWN_ISSUERS,
};
