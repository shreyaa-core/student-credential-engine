// ==============================================================================
// Student Micro-Credential Verification Engine - Badge Service
// Standard: 1EdTech Open Badges 3.0 compatible wrapper
// ==============================================================================

const crypto = require('crypto');
const openBadgeService = require('./openBadgeService');

/**
 * Generates a cryptographically random UUID credential identifier.
 * NEVER uses Math.random().
 * 
 * @returns {string} - Secure UUID
 */
function generateCredentialId() {
  return crypto.randomUUID();
}

/**
 * Generates digital badge metadata aligned with Open Badges 3.0 definitions.
 * 
 * @param {object} certificateData - Verified certificate input data
 * @returns {object} Badge metadata object with secure credentialId
 */
function generateBadge(certificateData = {}) {
  const {
    studentName = '',
    courseName = '',
    issuer = '',
    skills = [],
  } = certificateData;

  const credentialId = generateCredentialId();
  const badgeName = courseName ? `${courseName} Badge` : 'Verified Credential Badge';
  const issuedDate = new Date().toISOString().split('T')[0];

  const metadata = {
    studentName,
    courseName,
    issuer: issuer || 'Credential Authority',
    skills: Array.isArray(skills) ? skills : [],
    format: 'Open Badges 3.0',
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
  openBadgeService,
};
