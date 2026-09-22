// ==============================================================================
// Student Micro-Credential Verification Engine - Open Badges 3.0 Issuer Service
// Implements 1EdTech Open Badges 3.0 & W3C Verifiable Credentials Data Integrity
// Cryptosuite: eddsa-rdfc-2022 with Ed25519 Multikey
// ==============================================================================

const crypto = require('crypto');
const pool = require('../config/database');
const { ensureBadgeSigningKey } = require('../scripts/generateBadgeSigningKey');
const { createDocumentLoader } = require('./documentLoader');
const { generateQRCode } = require('./qrService');

// Dynamic ESM package loader cache
let _modules = null;
async function getCryptoModules() {
  if (!_modules) {
    const { DataIntegrityProof } = await import('@digitalbazaar/data-integrity');
    const { cryptosuite } = await import('@digitalbazaar/eddsa-rdfc-2022-cryptosuite');
    const Ed25519Multikey = await import('@digitalbazaar/ed25519-multikey');
    const jsigs = (await import('jsonld-signatures')).default;
    _modules = {
      DataIntegrityProof,
      cryptosuite,
      Ed25519Multikey,
      jsigs,
      AssertionProofPurpose: jsigs.purposes.AssertionProofPurpose,
    };
  }
  return _modules;
}

/**
 * Issuer profile and application URI configuration.
 */
function getIssuerConfig() {
  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5000';
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const issuerName = process.env.BADGE_ISSUER_NAME || 'Student Micro-Credential Verification Engine';
  const issuerUrl = process.env.BADGE_ISSUER_URL || `${appBaseUrl}/api/badges/issuer`;
  const keyId = `${issuerUrl}/keys/key-1`;

  return {
    appBaseUrl,
    clientUrl,
    issuerName,
    issuerUrl,
    keyId,
  };
}

/**
 * Returns the public Issuer Profile document (compatible with W3C DID & Verifiable Credentials).
 */
async function getPublicIssuerProfile() {
  const config = getIssuerConfig();
  return {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/multikey/v1',
    ],
    id: config.issuerUrl,
    type: 'Profile',
    name: config.issuerName,
    url: config.appBaseUrl,
    assertionMethod: [config.keyId],
    verificationMethod: [config.keyId],
    publicKey: [{ id: config.keyId, type: 'Multikey', controller: config.issuerUrl }],
  };
}

/**
 * Returns the public verification method (Multikey) document.
 * NEVER exposes the secret key.
 */
async function getPublicKeyDocument(requestedKeyId) {
  const config = getIssuerConfig();
  const keyPairData = await ensureBadgeSigningKey();

  return {
    '@context': 'https://w3id.org/security/multikey/v1',
    id: config.keyId,
    type: 'Multikey',
    controller: config.issuerUrl,
    publicKeyMultibase: keyPairData.publicKeyMultibase,
  };
}

/**
 * Builds an Open Badges 3.0 OpenBadgeCredential compliant with 1EdTech and W3C VC v2.
 * 
 * @param {object} params
 * @param {string} params.credentialId - UUID identifier
 * @param {object} params.certificate - Database certificate row
 * @param {object} params.student - Database profile row
 * @param {Array} params.skills - Mapped skills from certificate_skills
 * @returns {object} Unsigned OpenBadgeCredential JSON-LD
 */
function buildOpenBadgeCredential({ credentialId, certificate, student, skills = [] }) {
  const config = getIssuerConfig();

  // ValidFrom date: certificate issue date or created_at timestamp
  let validFrom = new Date().toISOString();
  if (certificate.issue_date) {
    try {
      validFrom = new Date(certificate.issue_date).toISOString();
    } catch {
      validFrom = new Date().toISOString();
    }
  } else if (certificate.created_at) {
    try {
      validFrom = new Date(certificate.created_at).toISOString();
    } catch {
      validFrom = new Date().toISOString();
    }
  }

  // Skills tag list (standards-compliant, no fabricated external standards URIs)
  const skillTags = skills
    .map((s) => (typeof s === 'string' ? s : s.name))
    .filter(Boolean);

  const criteriaNarrative =
    'This badge is issued after the submitted third-party certificate has been automatically verified against authoritative issuer evidence or explicitly approved by an administrator.';

  const unsigned = {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
    ],
    id: `${config.appBaseUrl}/api/badges/public/${credentialId}`,
    type: [
      'VerifiableCredential',
      'OpenBadgeCredential',
    ],
    name: `${certificate.certificate_name} Badge`,
    description: `Digital micro-credential awarded for verified achievement in ${certificate.certificate_name}.`,
    issuer: {
      id: config.issuerUrl,
      type: 'Profile',
      name: config.issuerName,
      url: config.appBaseUrl,
    },
    validFrom,
    credentialSubject: {
      id: `${config.appBaseUrl}/api/profiles/public/${student.id}`,
      type: 'AchievementSubject',
      name: student.full_name || 'Student',
      achievement: {
        id: `${config.appBaseUrl}/api/badges/achievements/${certificate.id}`,
        type: 'Achievement',
        name: certificate.certificate_name,
        description: `Cryptographically verified academic or professional credential issued by ${certificate.issuer || 'Credential Authority'}.`,
        achievementType: 'Certification',
        criteria: {
          narrative: criteriaNarrative,
        },
        creator: {
          type: 'Profile',
          name: certificate.issuer || 'Credential Authority',
        },
        ...(skillTags.length > 0 ? { tag: skillTags } : {}),
      },
    },
  };

  return unsigned;
}

/**
 * Cryptographically signs an OpenBadgeCredential using DataIntegrityProof and eddsa-rdfc-2022.
 * 
 * @param {object} unsignedCredential
 * @returns {Promise<object>} Signed OpenBadgeCredential with proof
 */
async function signOpenBadgeCredential(unsignedCredential) {
  const config = getIssuerConfig();
  const { DataIntegrityProof, cryptosuite, Ed25519Multikey, jsigs, AssertionProofPurpose } = await getCryptoModules();

  const keyData = await ensureBadgeSigningKey();
  const keyPair = await Ed25519Multikey.from(keyData);

  const publicKeyDoc = await getPublicKeyDocument(config.keyId);
  const issuerDoc = await getPublicIssuerProfile();

  const documentLoader = createDocumentLoader({
    issuerId: config.issuerUrl,
    keyId: config.keyId,
    publicKeyDocument: publicKeyDoc,
    issuerDocument: issuerDoc,
  });

  const suite = new DataIntegrityProof({
    signer: keyPair.signer(),
    cryptosuite,
  });

  const signedCredential = await jsigs.sign(unsignedCredential, {
    suite,
    purpose: new AssertionProofPurpose(),
    documentLoader,
  });

  return signedCredential;
}

/**
 * Verifies the cryptographic proof and structural integrity of an OpenBadgeCredential.
 * 
 * @param {object} credentialJson
 * @returns {Promise<{ verified: boolean, error: string | null }>}
 */
async function verifyOpenBadgeCredential(credentialJson) {
  try {
    if (!credentialJson || typeof credentialJson !== 'object') {
      return { verified: false, error: 'Credential must be a valid JSON object' };
    }

    // 1. Structural checks
    const context = credentialJson['@context'];
    const types = credentialJson.type;
    const proof = credentialJson.proof;

    const hasVcContext = Array.isArray(context) && context.some((c) => typeof c === 'string' && c.includes('credentials'));
    const hasObContext = Array.isArray(context) && context.some((c) => typeof c === 'string' && c.includes('ob/v3p0'));
    const hasVcType = Array.isArray(types) && types.includes('VerifiableCredential');
    const hasObType = Array.isArray(types) && types.includes('OpenBadgeCredential');

    if (!hasVcContext || !hasObContext || !hasVcType || !hasObType) {
      return {
        verified: false,
        error: 'Invalid OpenBadgeCredential structure or context.',
      };
    }

    if (!proof || proof.type !== 'DataIntegrityProof' || proof.cryptosuite !== 'eddsa-rdfc-2022') {
      return {
        verified: false,
        error: 'Missing or unsupported DataIntegrityProof cryptosuite (expected eddsa-rdfc-2022).',
      };
    }

    // 2. Cryptographic proof verification
    const config = getIssuerConfig();
    const { DataIntegrityProof, cryptosuite, jsigs, AssertionProofPurpose } = await getCryptoModules();

    const publicKeyDoc = await getPublicKeyDocument(config.keyId);
    const issuerDoc = await getPublicIssuerProfile();

    const documentLoader = createDocumentLoader({
      issuerId: config.issuerUrl,
      keyId: config.keyId,
      publicKeyDocument: publicKeyDoc,
      issuerDocument: issuerDoc,
    });

    const suite = new DataIntegrityProof({ cryptosuite });

    const result = await jsigs.verify(credentialJson, {
      suite,
      purpose: new AssertionProofPurpose(),
      documentLoader,
    });

    if (result.verified) {
      return { verified: true, valid: true, error: null };
    }

    return {
      verified: false,
      valid: false,
      error: result.error?.message || 'Cryptographic proof signature verification failed.',
    };
  } catch (err) {
    return { verified: false, valid: false, error: err.message };
  }
}

/**
 * Issues a digital badge for a certificate.
 * Enforces strict verification status, ownership, and idempotency.
 * 
 * @param {string} certificateId
 * @param {string} studentId
 * @param {object} [dbClient=pool]
 * @returns {Promise<{ success: boolean, badge: object, qrCode: string, alreadyExists: boolean }>}
 */
async function issueBadgeForCertificate(certificateId, studentId, dbClient = pool) {
  // 1. Fetch certificate and student details
  const certRes = await dbClient.query(
    `SELECT c.*, p.full_name, p.id AS student_uuid
     FROM certificates c
     JOIN profiles p ON c.student_id = p.id
     WHERE c.id = $1`,
    [certificateId]
  );

  if (certRes.rows.length === 0) {
    const notFoundErr = new Error('Certificate not found.');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  const cert = certRes.rows[0];

  // 2. Enforce ownership: student can only request badge for their own certificate
  if (studentId && cert.student_id !== studentId) {
    const authErr = new Error('Access denied. You can only request badges for your own certificates.');
    authErr.statusCode = 403;
    throw authErr;
  }

  // 3. Status rule: Only VERIFIED or APPROVED certificates can receive a badge
  const statusUpper = (cert.status || '').toUpperCase();
  const isAllowedStatus = ['VERIFIED', 'APPROVED'].includes(statusUpper);
  if (!isAllowedStatus) {
    const statusErr = new Error(
      `Badge cannot be issued for certificate with status "${cert.status}". Status must be VERIFIED or APPROVED.`
    );
    statusErr.statusCode = 400;
    throw statusErr;
  }

  // 4. Check for existing badge (idempotent duplicate prevention)
  const existingBadgeRes = await dbClient.query(
    'SELECT * FROM badges WHERE certificate_id = $1',
    [certificateId]
  );

  const config = getIssuerConfig();

  if (existingBadgeRes.rows.length > 0) {
    const existing = existingBadgeRes.rows[0];
    const qrUrl = `${config.clientUrl}/verify/badge/${existing.credential_id}`;
    const qrCode = await generateQRCode(qrUrl);

    return {
      success: true,
      alreadyExists: true,
      badge: existing,
      qrCode,
      verificationUrl: qrUrl,
    };
  }

  // 5. Fetch associated skills
  const skillsRes = await dbClient.query(
    `SELECT s.name, s.category, cs.proficiency_level
     FROM certificate_skills cs
     JOIN skills s ON cs.skill_id = s.id
     WHERE cs.certificate_id = $1
     ORDER BY s.name ASC`,
    [certificateId]
  );
  const skills = skillsRes.rows || [];

  // 6. Generate cryptographically secure UUID for credential_id
  const credentialId = crypto.randomUUID();

  // 7. Build and sign OpenBadgeCredential
  const studentProfile = { id: cert.student_uuid, full_name: cert.full_name };
  const unsigned = buildOpenBadgeCredential({
    credentialId,
    certificate: cert,
    student: studentProfile,
    skills,
  });

  const signedCredential = await signOpenBadgeCredential(unsigned);

  // 8. Persist into PostgreSQL inside transaction
  const badgeTitle = `${cert.certificate_name} Badge`;
  const criteriaText = unsigned.credentialSubject.achievement.criteria.narrative;
  const issuedAt = unsigned.validFrom;

  const insertRes = await dbClient.query(
    `INSERT INTO badges (
       student_id, certificate_id, credential_id, name, criteria, credential_json, issued_at, image_url, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     RETURNING *`,
    [
      cert.student_id,
      cert.id,
      credentialId,
      badgeTitle,
      criteriaText,
      JSON.stringify(signedCredential),
      issuedAt,
      '🏅',
    ]
  );

  const savedBadge = insertRes.rows[0];

  // 9. Generate QR code encoding the persisted credential_id verification URL
  const verificationUrl = `${config.clientUrl}/verify/badge/${credentialId}`;
  const qrCode = await generateQRCode(verificationUrl);

  return {
    success: true,
    alreadyExists: false,
    badge: savedBadge,
    qrCode,
    verificationUrl,
  };
}

/**
 * Publicly verifies a badge by its persisted credential_id.
 * Evaluates:
 * 1. Existence in PostgreSQL
 * 2. Cryptographic proof validity
 * 3. Current source certificate status
 * 
 * @param {string} credentialId
 * @param {object} [dbClient=pool]
 * @returns {Promise<object>} Verification report
 */
async function verifyBadgeByCredentialId(credentialId, dbClient = pool) {
  if (!credentialId || typeof credentialId !== 'string') {
    return {
      success: false,
      valid: false,
      error: 'Invalid credential ID format.',
    };
  }

  // 1. Lookup badge by exact credential_id
  const badgeRes = await dbClient.query(
    'SELECT * FROM badges WHERE credential_id = $1',
    [credentialId.trim()]
  );

  if (badgeRes.rows.length === 0) {
    return {
      success: false,
      valid: false,
      error: `Badge credential "${credentialId}" not found in database registry.`,
      notFound: true,
    };
  }

  const badge = badgeRes.rows[0];
  const credentialJson = badge.credential_json;

  // 2. Cryptographic proof verification
  const cryptoResult = await verifyOpenBadgeCredential(credentialJson);
  const isProofValid = cryptoResult.verified;

  // 3. Source certificate state check
  let sourceCert = null;
  if (badge.certificate_id) {
    const certRes = await dbClient.query(
      'SELECT id, certificate_name, issuer, status FROM certificates WHERE id = $1',
      [badge.certificate_id]
    );
    if (certRes.rows.length > 0) {
      sourceCert = certRes.rows[0];
    }
  }

  const certStatus = sourceCert ? (sourceCert.status || '').toUpperCase() : 'UNKNOWN';
  const isCertValid = ['VERIFIED', 'APPROVED'].includes(certStatus);

  // Overall validity: proof must be cryptographically valid AND certificate must be active/verified
  const overallValid = isProofValid && isCertValid;

  const config = getIssuerConfig();
  const studentName = credentialJson?.credentialSubject?.name || 'Student';
  const achievement = credentialJson?.credentialSubject?.achievement || {};
  const skills = achievement.tag || [];

  return {
    success: true,
    valid: overallValid,
    proofValid: isProofValid,
    cryptoVerificationError: cryptoResult.error || null,
    credentialId: badge.credential_id,
    badgeName: badge.name,
    studentName,
    sourceCertificateStatus: certStatus,
    certificateStatus: certStatus,
    sourceCertificateId: sourceCert?.id || null,
    issuedAt: badge.issued_at,
    issuer: credentialJson?.issuer?.name || config.issuerName,
    badge: {
      id: badge.id,
      name: badge.name,
      criteria: badge.criteria,
      issued_at: badge.issued_at,
    },
    achievement: {
      name: achievement.name || badge.name,
      description: achievement.description || '',
      criteria: achievement.criteria?.narrative || badge.criteria,
    },
    skills,
    credentialJson,
    verificationUrl: `${config.clientUrl}/verify/badge/${badge.credential_id}`,
  };
}

module.exports = {
  getIssuerConfig,
  getPublicIssuerProfile,
  getPublicKeyDocument,
  buildOpenBadgeCredential,
  signOpenBadgeCredential,
  verifyOpenBadgeCredential,
  issueBadgeForCertificate,
  verifyBadgeByCredentialId,
};
