// ==============================================================================
// Student Micro-Credential Verification Engine - Badge Service
// ==============================================================================

/**
 * Generates a random 6-digit credential ID matching the CRED-XXXXXX pattern.
 * Example: CRED-928374
 * 
 * @returns {string} - Formatted credential ID
 */
function generateCredentialId() {
  const randomSixDigits = Math.floor(100000 + Math.random() * 900000);
  return `CRED-${randomSixDigits}`;
}

/**
 * Generates digital badge information for a verified certificate.
 * 
 * @param {object} certificateData - Verified certificate input data
 * @param {string} certificateData.studentName - Full name of the student
 * @param {string} certificateData.courseName - Name of the course or credential
 * @param {string} certificateData.issuer - Name of the issuing organization
 * @param {string[]} certificateData.skills - Array of verified skills
 * 
 * @returns {{
 *   credentialId: string,
 *   badgeName: string,
 *   issuedDate: string,
 *   metadata: {
 *     studentName: string,
 *     courseName: string,
 *     issuer: string,
 *     skills: string[]
 *   }
 * }}
 */
function generateBadge(certificateData = {}) {
  const {
    studentName = '',
    courseName = '',
    issuer = '',
    skills = [],
  } = certificateData;

  // 1. Generate unique 6-digit credential identifier (CRED-XXXXXX)
  const credentialId = generateCredentialId();

  // 2. Generate descriptive badge name from course title
  const badgeName = courseName ? `${courseName} Badge` : 'Verified Credential Badge';

  // 3. Current date in YYYY-MM-DD format
  const issuedDate = new Date().toISOString().split('T')[0];

  // 4. Detailed metadata object preserving credential context
  const metadata = {
    studentName,
    courseName,
    issuer,
    skills: Array.isArray(skills) ? skills : [],
  };

  return {
    credentialId,
    badgeName,
    issuedDate,
    metadata,
  };
}

module.exports = {
  generateBadge,
  generateBadgeInfo: generateBadge,
  createBadge: generateBadge,
  generateCredentialId,
};
