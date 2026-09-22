/**
 * ==============================================================================
 * Comprehensive Test Suite: Automated Digital Badge Issuer (Open Badges 3.0)
 * Step 5 Verification & QR / Public Verification Chain
 * ==============================================================================
 */

const axios = require('axios');
const pool = require('../config/database');
const { generateToken } = require('../middleware/authMiddleware');
const { verifyOpenBadgeCredential } = require('../services/openBadgeService');

const BASE_URL = 'http://localhost:5000/api/badges';

// Authenticated test users from database profiles
const USER_A = {
  id: '2d56ab4e-ce06-47b1-afc4-ec0f341a4b90',
  email: 'poojadas@gmail.com',
  name: 'Pooja Das',
  role: 'issuer'
};

const USER_B = {
  id: '043258e2-4938-43e1-93c2-52ca5d7600e0',
  email: 'shreya18das@gmail.com',
  name: 'Shreya Das',
  role: 'issuer'
};

const ADMIN_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@bwu.edu',
  name: 'Administrator',
  role: 'admin'
};

const tokenA = generateToken(USER_A);
const tokenB = generateToken(USER_B);
const tokenAdmin = generateToken(ADMIN_USER);

const headersA = { Authorization: `Bearer ${tokenA}` };
const headersB = { Authorization: `Bearer ${tokenB}` };
const headersAdmin = { Authorization: `Bearer ${tokenAdmin}` };

let createdCertIds = [];
let createdBadgeIds = [];

async function getDbCounts() {
  const res = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM public.profiles) as profiles,
      (SELECT COUNT(*) FROM public.certificates) as certificates,
      (SELECT COUNT(*) FROM public.certificate_skills) as certificate_skills,
      (SELECT COUNT(*) FROM public.badges) as badges,
      (SELECT COUNT(*) FROM public.verification_logs) as verification_logs,
      (SELECT COUNT(*) FROM public.skills) as skills,
      (SELECT COUNT(*) FROM public.activity_logs) as activity_logs,
      (SELECT COUNT(*) FROM public.activity_skills) as activity_skills;
  `);
  return res.rows[0];
}

async function cleanupTestData() {
  if (createdBadgeIds.length > 0) {
    await pool.query('DELETE FROM public.badges WHERE id = ANY($1::uuid[])', [createdBadgeIds]);
  }
  if (createdCertIds.length > 0) {
    await pool.query('DELETE FROM public.certificate_skills WHERE certificate_id = ANY($1::uuid[])', [createdCertIds]);
    await pool.query('DELETE FROM public.verification_logs WHERE certificate_id = ANY($1::uuid[])', [createdCertIds]);
    await pool.query('DELETE FROM public.certificates WHERE id = ANY($1::uuid[])', [createdCertIds]);
  }
}

async function runTests() {
  console.log('==============================================================================');
  console.log('STARTING STEP 5 TEST SUITE: OPEN BADGES 3.0 & CRYPTOGRAPHIC VERIFICATION');
  console.log('==============================================================================\n');

  const baselineCounts = await getDbCounts();
  console.log('Database baseline counts:', baselineCounts);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // --------------------------------------------------------------------------
    // Test 1: PostgreSQL Schema Check for badges table
    // --------------------------------------------------------------------------
    console.log('\n--- 1. Database Schema Verification for Badges ---');
    const colsRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'badges' AND column_name IN ('credential_id', 'credential_json', 'issued_at');
    `);
    const foundCols = colsRes.rows.map(r => r.column_name);
    assert(foundCols.includes('credential_id'), 'Column credential_id exists on badges');
    assert(foundCols.includes('credential_json'), 'Column credential_json exists on badges');
    assert(foundCols.includes('issued_at'), 'Column issued_at exists on badges');

    const constraintRes = await pool.query(`
      SELECT conname 
      FROM pg_constraint 
      WHERE conrelid = 'public.badges'::regclass 
        AND conname IN ('uq_badges_certificate_id', 'uq_badges_credential_id');
    `);
    const foundConstraints = constraintRes.rows.map(r => r.conname);
    assert(foundConstraints.includes('uq_badges_certificate_id'), 'Unique constraint uq_badges_certificate_id exists');
    assert(foundConstraints.includes('uq_badges_credential_id'), 'Unique constraint uq_badges_credential_id exists');

    // --------------------------------------------------------------------------
    // Test 2: Reject Unverified Statuses (PROCESSING, PENDING, MANUAL_REVIEW, SUSPICIOUS, REJECTED)
    // --------------------------------------------------------------------------
    console.log('\n--- 2. Unverified Status Rejection Enforcement ---');
    const unverifiedStatuses = ['PROCESSING', 'PENDING', 'MANUAL_REVIEW', 'SUSPICIOUS', 'REJECTED'];
    
    for (const status of unverifiedStatuses) {
      const certRes = await pool.query(
        `INSERT INTO public.certificates 
           (student_id, certificate_name, issuer, issue_date, file_hash, file_url, status)
         VALUES 
           ($1, $2, $3, NOW(), $4, $5, $6)
         RETURNING id`,
        [USER_A.id, `Test Cert ${status}`, 'Test Issuer', `hash_${status.toLowerCase()}_${Date.now()}`, 'http://example.com/test.pdf', status]
      );
      const testCertId = certRes.rows[0].id;
      createdCertIds.push(testCertId);

      try {
        await axios.post(`${BASE_URL}/create`, { certificate_id: testCertId }, { headers: headersA });
        assert(false, `Expected rejection for status ${status} but request succeeded`);
      } catch (err) {
        assert(err.response?.status === 400, `Rejected status ${status} with HTTP 400 (${err.response?.data?.error})`);
      }
    }

    // --------------------------------------------------------------------------
    // Test 3: Issue Badge for VERIFIED Certificate (Open Badges 3.0)
    // --------------------------------------------------------------------------
    console.log('\n--- 3. Issuance for VERIFIED Certificate ---');
    const verifiedCertRes = await pool.query(
      `INSERT INTO public.certificates 
         (student_id, certificate_name, issuer, issue_date, file_hash, file_url, status)
       VALUES 
         ($1, $2, $3, NOW(), $4, $5, 'VERIFIED')
       RETURNING id`,
      [USER_A.id, 'Advanced Cloud Architecture', 'AWS Academy', `hash_verified_${Date.now()}`, 'http://example.com/aws.pdf']
    );
    const verifiedCertId = verifiedCertRes.rows[0].id;
    createdCertIds.push(verifiedCertId);

    // Map a canonical skill to this certificate
    const skillRes = await pool.query(`SELECT id FROM public.skills WHERE name ILIKE '%Cloud Computing%' OR name ILIKE '%Python%' LIMIT 1`);
    if (skillRes.rows.length > 0) {
      await pool.query(
        `INSERT INTO public.certificate_skills (certificate_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [verifiedCertId, skillRes.rows[0].id]
      );
    }

    const issueRes = await axios.post(`${BASE_URL}/create`, { certificate_id: verifiedCertId }, { headers: headersA });
    assert(issueRes.status === 201, `Issued badge with HTTP 201: ${issueRes.data?.message}`);
    assert(issueRes.data?.badge?.credential_id, 'Response contains credential_id');
    assert(issueRes.data?.qrCode && issueRes.data.qrCode.startsWith('data:image/png;base64,'), 'Response contains valid base64 QR code');
    assert(issueRes.data?.verificationUrl?.includes(`/verify/badge/${issueRes.data.badge.credential_id}`), 'Verification URL points to /verify/badge/:credentialId');

    const createdBadge = issueRes.data.badge;
    createdBadgeIds.push(createdBadge.id);

    // Check UUID format (NOT Math.random / NOT CRED-XXXXXX)
    const isUuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(createdBadge.credential_id);
    assert(isUuidV4, `Credential ID is valid UUIDv4 (${createdBadge.credential_id}), not Math.random`);

    // Verify DB persistence
    const dbBadgeRes = await pool.query('SELECT * FROM public.badges WHERE id = $1', [createdBadge.id]);
    assert(dbBadgeRes.rows.length === 1, 'Badge record successfully persisted in PostgreSQL');
    const dbBadge = dbBadgeRes.rows[0];
    assert(dbBadge.credential_id === createdBadge.credential_id, 'credential_id persisted correctly in PostgreSQL');
    assert(dbBadge.credential_json !== null, 'credential_json persisted as JSONB in PostgreSQL');
    assert(dbBadge.issued_at !== null, 'issued_at persisted as TIMESTAMPTZ');

    // --------------------------------------------------------------------------
    // Test 4: Idempotence & Duplicate Prevention
    // --------------------------------------------------------------------------
    console.log('\n--- 4. Idempotent Issuance / Duplicate Prevention ---');
    const duplicateRes = await axios.post(`${BASE_URL}/create`, { certificate_id: verifiedCertId }, { headers: headersA });
    assert(duplicateRes.status === 200, `Duplicate issuance returns HTTP 200 (Already Exists)`);
    assert(duplicateRes.data?.alreadyExists === true, 'Response flag alreadyExists is true');
    assert(duplicateRes.data?.badge?.credential_id === createdBadge.credential_id, 'Returns existing credential_id without reissuing');

    const countRes = await pool.query('SELECT COUNT(*) FROM public.badges WHERE certificate_id = $1', [verifiedCertId]);
    assert(parseInt(countRes.rows[0].count, 10) === 1, 'Exactly one badge row exists for the certificate in PostgreSQL');

    // --------------------------------------------------------------------------
    // Test 5: Ownership Security
    // --------------------------------------------------------------------------
    console.log('\n--- 5. Ownership Security Enforcement ---');
    try {
      // User B tries to issue badge for User A's certificate
      await axios.post(`${BASE_URL}/create`, { certificate_id: verifiedCertId }, { headers: headersB });
      assert(false, 'Expected 403 Forbidden when Student B issues badge for Student A cert');
    } catch (err) {
      assert(err.response?.status === 403, `Blocked cross-user issuance with HTTP 403 (${err.response?.data?.error})`);
    }

    try {
      // User B tries to access private badge details of User A
      await axios.get(`${BASE_URL}/${createdBadge.id}`, { headers: headersB });
      assert(false, 'Expected 403 Forbidden when Student B accesses Student A badge');
    } catch (err) {
      assert(err.response?.status === 403, `Blocked cross-user badge detail retrieval with HTTP 403 (${err.response?.data?.error})`);
    }

    // --------------------------------------------------------------------------
    // Test 6: Open Badges 3.0 & W3C VC Conformance
    // --------------------------------------------------------------------------
    console.log('\n--- 6. 1EdTech Open Badges 3.0 & W3C VC Conformance ---');
    const cred = dbBadge.credential_json;

    // Contexts
    assert(
      Array.isArray(cred['@context']) &&
      cred['@context'].includes('https://www.w3.org/ns/credentials/v2') &&
      cred['@context'].includes('https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'),
      'Context includes W3C VC v2 and 1EdTech OB 3.0'
    );

    // Types
    assert(
      Array.isArray(cred.type) &&
      cred.type.includes('VerifiableCredential') &&
      cred.type.includes('OpenBadgeCredential'),
      'Type includes VerifiableCredential and OpenBadgeCredential'
    );

    // Identifiers
    assert(cred.id.includes(createdBadge.credential_id), `Credential ID references ${createdBadge.credential_id}`);

    // Issuer Profile
    assert(cred.issuer?.type?.includes('Profile'), 'Issuer type includes Profile');
    assert(cred.issuer?.id?.endsWith('/api/badges/issuer'), 'Issuer ID points to issuer endpoint');
    assert(cred.issuer?.name !== undefined, 'Issuer name is present');

    // Subject & Achievement
    assert(cred.credentialSubject?.type?.includes('AchievementSubject'), 'credentialSubject type includes AchievementSubject');
    assert(cred.credentialSubject?.achievement?.type?.includes('Achievement'), 'achievement type includes Achievement');
    assert(cred.credentialSubject?.achievement?.name === 'Advanced Cloud Architecture', 'achievement name matches certificate');
    assert(cred.credentialSubject?.achievement?.criteria?.narrative !== undefined, 'achievement criteria narrative is present');

    // --------------------------------------------------------------------------
    // Test 7: Cryptographic Proof Verification (eddsa-rdfc-2022)
    // --------------------------------------------------------------------------
    console.log('\n--- 7. Cryptographic Proof Verification ---');
    const proof = cred.proof;
    assert(proof !== undefined, 'Data integrity proof object is present');
    assert(proof?.type === 'DataIntegrityProof', 'Proof type is DataIntegrityProof');
    assert(proof?.cryptosuite === 'eddsa-rdfc-2022', 'Cryptosuite is eddsa-rdfc-2022');
    assert(proof?.proofValue && proof.proofValue.startsWith('z'), 'Proof value is multibase string starting with z');
    assert(proof?.verificationMethod?.includes('/api/badges/issuer/keys/'), 'verificationMethod references issuer key URI');

    // Verify cryptographic proof with document loader
    const verifyResult = await verifyOpenBadgeCredential(cred);
    assert(verifyResult.verified === true || verifyResult.valid === true, 'Cryptographic proof verified successfully (verified = true)');

    // --------------------------------------------------------------------------
    // Test 8: Tamper Detection (Tampered Credential Must Fail Proof)
    // --------------------------------------------------------------------------
    console.log('\n--- 8. Cryptographic Tamper Detection ---');
    const tamperedCred1 = JSON.parse(JSON.stringify(cred));
    tamperedCred1.credentialSubject.achievement.name = 'Hacked Grade & Credential';
    const tamperResult1 = await verifyOpenBadgeCredential(tamperedCred1);
    assert(tamperResult1.verified === false || tamperResult1.valid === false, 'Tampered achievement name fails cryptographic verification (valid = false)');

    const tamperedCred2 = JSON.parse(JSON.stringify(cred));
    tamperedCred2.validFrom = '2019-01-01T00:00:00.000Z';
    const tamperResult2 = await verifyOpenBadgeCredential(tamperedCred2);
    assert(tamperResult2.verified === false || tamperResult2.valid === false, 'Tampered issue date fails cryptographic verification (valid = false)');

    // --------------------------------------------------------------------------
    // Test 9: Public Issuer & Multikey Endpoints
    // --------------------------------------------------------------------------
    console.log('\n--- 9. Public Issuer & Key Endpoints ---');
    const issuerRes = await axios.get(`${BASE_URL}/issuer`);
    assert(issuerRes.status === 200, 'GET /api/badges/issuer returns 200');
    assert(issuerRes.data?.id?.endsWith('/api/badges/issuer'), 'Issuer document contains canonical ID');
    assert(Array.isArray(issuerRes.data?.publicKey) && issuerRes.data.publicKey.length > 0, 'Issuer document lists public keys');

    const keyId = issuerRes.data.publicKey[0].id.split('/').pop();
    const keyRes = await axios.get(`${BASE_URL}/issuer/keys/${keyId}`);
    assert(keyRes.status === 200, `GET /api/badges/issuer/keys/${keyId} returns 200`);
    assert(keyRes.data?.type === 'Multikey', 'Key type is Multikey');
    assert(keyRes.data?.publicKeyMultibase && keyRes.data.publicKeyMultibase.startsWith('z'), 'publicKeyMultibase starts with z');
    assert(keyRes.data?.secretKeyMultibase === undefined, 'Private key (secretKeyMultibase) is NEVER exposed');

    // --------------------------------------------------------------------------
    // Test 10: Public Raw Credential Endpoint (GET /api/badges/public/:credentialId)
    // --------------------------------------------------------------------------
    console.log('\n--- 10. Public Raw Credential Endpoint ---');
    const publicCredRes = await axios.get(`${BASE_URL}/public/${createdBadge.credential_id}`);
    assert(publicCredRes.status === 200, 'GET /api/badges/public/:credentialId returns 200');
    assert(publicCredRes.data?.id === dbBadge.credential_json.id, 'Returned JSON-LD matches stored credential');
    assert(publicCredRes.data?.proof?.proofValue === proof.proofValue, 'Returned proof matches original signature');

    try {
      await axios.get(`${BASE_URL}/public/00000000-0000-0000-0000-000000000000`);
      assert(false, 'Expected 404 for unknown credential');
    } catch (err) {
      assert(err.response?.status === 404, 'Non-existent credential correctly returns HTTP 404');
    }

    // --------------------------------------------------------------------------
    // Test 11: Public Verification Endpoint (GET /api/badges/verify/:credentialId)
    // --------------------------------------------------------------------------
    console.log('\n--- 11. Public Verification Endpoint ---');
    const verifyEndpointRes = await axios.get(`${BASE_URL}/verify/${createdBadge.credential_id}`);
    assert(verifyEndpointRes.status === 200, 'GET /api/badges/verify/:credentialId returns 200');
    assert(verifyEndpointRes.data?.valid === true, 'Public verification valid is true');
    assert(verifyEndpointRes.data?.proofValid === true, 'Public verification proofValid is true');
    assert(verifyEndpointRes.data?.certificateStatus === 'VERIFIED', 'Certificate status is VERIFIED');
    assert(verifyEndpointRes.data?.badge?.name?.includes('Advanced Cloud Architecture'), 'Badge name is correctly populated');

    // --------------------------------------------------------------------------
    // Test 12: Certificate Status Modification (Revocation Behavior)
    // --------------------------------------------------------------------------
    console.log('\n--- 12. Certificate Revocation Impact on Badge Verification ---');
    await pool.query('UPDATE public.certificates SET status = $1 WHERE id = $2', ['REJECTED', verifiedCertId]);

    const revokedVerifyRes = await axios.get(`${BASE_URL}/verify/${createdBadge.credential_id}`);
    assert(revokedVerifyRes.status === 200, 'GET /api/badges/verify/:credentialId returns 200 even for rejected certificate');
    assert(revokedVerifyRes.data?.proofValid === true, 'Cryptographic proof is still mathematically valid (proofValid = true)');
    assert(revokedVerifyRes.data?.valid === false, 'Overall credential validity is false because certificate is REJECTED (valid = false)');
    assert(revokedVerifyRes.data?.certificateStatus === 'REJECTED', 'Returned certificateStatus reflects REJECTED');

    // --------------------------------------------------------------------------
    // Test 13: Private Key Exposure Check
    // --------------------------------------------------------------------------
    console.log('\n--- 13. Strict Private Key Non-Exposure Check ---');
    const rawJsonStr = JSON.stringify(dbBadge.credential_json);
    assert(!rawJsonStr.includes('privateKey') && !rawJsonStr.includes('secretKey'), 'No private keys present in PostgreSQL stored credential_json');

    const rawPublicStr = JSON.stringify(publicCredRes.data);
    assert(!rawPublicStr.includes('privateKey') && !rawPublicStr.includes('secretKey'), 'No private keys present in public credential API output');

    const rawVerifyStr = JSON.stringify(verifyEndpointRes.data);
    assert(!rawVerifyStr.includes('privateKey') && !rawVerifyStr.includes('secretKey'), 'No private keys present in public verify API output');

    // --------------------------------------------------------------------------
    // Test 14: Issuance for APPROVED status (Admin Workflow)
    // --------------------------------------------------------------------------
    console.log('\n--- 14. Issuance for APPROVED Certificate (Admin Workflow) ---');
    const approvedCertRes = await pool.query(
      `INSERT INTO public.certificates 
         (student_id, certificate_name, issuer, issue_date, file_hash, file_url, status)
       VALUES 
         ($1, $2, $3, NOW(), $4, $5, 'APPROVED')
       RETURNING id`,
      [USER_B.id, 'PostgreSQL Database Administration', 'PostgreSQL Org', `hash_approved_${Date.now()}`, 'http://example.com/pg.pdf']
    );
    const approvedCertId = approvedCertRes.rows[0].id;
    createdCertIds.push(approvedCertId);

    const approvedIssueRes = await axios.post(`${BASE_URL}/create`, { certificate_id: approvedCertId }, { headers: headersB });
    assert(approvedIssueRes.status === 201, 'APPROVED certificate successfully issued Open Badge 3.0');
    createdBadgeIds.push(approvedIssueRes.data.badge.id);

    const approvedVerifyRes = await axios.get(`${BASE_URL}/verify/${approvedIssueRes.data.badge.credential_id}`);
    assert(approvedVerifyRes.data?.valid === true, 'Approved certificate badge verifies true');
    assert(approvedVerifyRes.data?.certificateStatus === 'APPROVED', 'Verification reflects certificateStatus APPROVED');

  } catch (err) {
    console.error('\nFatal test execution error:', err.message);
    if (err.response?.data) console.error('Response data:', err.response.data);
    failed++;
  } finally {
    // --------------------------------------------------------------------------
    // Test Cleanup: Clean up all test fixtures & verify database counts
    // --------------------------------------------------------------------------
    console.log('\n--- Cleaning up test fixtures ---');
    await cleanupTestData();

    const endCounts = await getDbCounts();
    console.log('Database end counts:', endCounts);

    const countsMatch = JSON.stringify(baselineCounts) === JSON.stringify(endCounts);
    assert(countsMatch, 'Database counts match baseline perfectly (zero leaked test data)');

    console.log('\n==============================================================================');
    console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('==============================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runTests();
