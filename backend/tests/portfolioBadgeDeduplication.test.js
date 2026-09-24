/**
 * ==============================================================================
 * Regression Test Suite: Portfolio Badge Deduplication & Canonical Resolution
 * File: backend/tests/portfolioBadgeDeduplication.test.js
 * 
 * Verifies:
 * 1. Exactly one badge is returned for a student with one verified certificate (e.g. Pooja Das with "spotify clone").
 * 2. No synthetic legacy badge with issuer "Credential Authority" or synthesized "badge-" prefix is returned alongside real badge.
 * 3. Portfolio badge count in stats equals the number of distinct valid badges (1, not 2).
 * 4. The badge returned contains authentic Open Badges 3.0 fields:
 *    - canonical id, credential_id, certificate_id, criteria, valid issuer name (not "Credential Authority").
 * 5. "View Badge" endpoints resolve successfully:
 *    - GET /api/badges/:id (database badge id) returns 200 OK
 *    - GET /api/badges/:credentialId (OpenBadge credential id) returns 200 OK
 *    - GET /api/badges/:certificateId (certificate id) returns 200 OK
 *    - GET /api/badges/badge-:certificateId returns 200 OK
 * 6. Cryptographic OpenBadge 3.0 proof verification passes with eddsa-rdfc-2022.
 * 7. Database integrity check: uq_badges_certificate_id constraint holds and exactly 1 row exists in badges for the certificate.
 * ==============================================================================
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const assert = require('assert');
const axios = require('axios');
const pool = require('../config/database');
const { generateToken } = require('../middleware/authMiddleware');
const { verifyBadgeByCredentialId } = require('../services/openBadgeService');

const BASE_URL = 'http://localhost:5000';

// Real authenticated student (Pooja Das)
const STUDENT_USER = {
  id: '2d56ab4e-ce06-47b1-afc4-ec0f341a4b90',
  email: 'poojadas@gmail.com',
  name: 'Pooja Das',
  role: 'issuer',
};

const token = generateToken(STUDENT_USER);
const authHeaders = { Authorization: `Bearer ${token}` };

async function runTests() {
  console.log('='.repeat(70));
  console.log('PORTFOLIO BADGE DEDUPLICATION & CANONICAL RESOLUTION REGRESSION SUITE');
  console.log('='.repeat(70));

  let passedTests = 0;
  let totalTests = 0;

  async function test(description, fn) {
    totalTests++;
    try {
      await fn();
      console.log(`[PASS] Test ${totalTests}: ${description}`);
      passedTests++;
    } catch (err) {
      console.error(`[FAIL] Test ${totalTests}: ${description}`);
      console.error('       Error:', err.message);
      if (err.response) {
        console.error('       Response data:', err.response.data);
      }
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Exactly 1 badge per verified certificate returned for authenticated student from GET /api/profile/me
  // --------------------------------------------------------------------------
  await test('GET /api/profile/me returns deduplicated badges (1:1 with verified certificates)', async () => {
    const res = await axios.get(`${BASE_URL}/api/profile/me`, { headers: authHeaders });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(Array.isArray(res.data.badges), 'Expected badges to be an array');
    const eligibleCerts = (res.data.certificates || []).filter(
      (c) => c.status === 'VERIFIED' || c.status === 'APPROVED'
    );
    assert.strictEqual(
      res.data.badges.length,
      eligibleCerts.length,
      `Expected ${eligibleCerts.length} badges (1 per verified cert), but received ${res.data.badges.length}`
    );
  });

  // --------------------------------------------------------------------------
  // TEST 2: No synthetic legacy badge with issuer "Credential Authority" is generated
  // --------------------------------------------------------------------------
  await test('Returned badge does NOT have hardcoded "Credential Authority" issuer or synthetic ID', async () => {
    const res = await axios.get(`${BASE_URL}/api/profile/me`, { headers: authHeaders });
    const badge = res.data.badges[0];
    assert(badge, 'Badge object must exist');
    assert.notStrictEqual(
      badge.issuer,
      'Credential Authority',
      'Badge issuer must not be hardcoded to "Credential Authority"'
    );
    assert(
      !badge.id.startsWith('badge-'),
      `Badge ID should be canonical UUID, got: ${badge.id}`
    );
    assert(badge.credential_id, 'Badge must contain credential_id');
    assert(badge.certificate_id, 'Badge must contain certificate_id');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Portfolio profile stats accurately reflect badges earned
  // --------------------------------------------------------------------------
  await test('Profile stats badgesCount equals distinct valid badges count', async () => {
    const res = await axios.get(`${BASE_URL}/api/profile/me`, { headers: authHeaders });
    const stats = res.data.profile.stats;
    assert(stats, 'Profile stats must exist');
    assert.strictEqual(
      stats.badgesCount,
      res.data.badges.length,
      `Expected stats.badgesCount === ${res.data.badges.length}, got ${stats.badgesCount}`
    );
  });

  // --------------------------------------------------------------------------
  // TEST 4: Public portfolio lookup GET /api/profile/:id returns canonical badges matching user
  // --------------------------------------------------------------------------
  await test('GET /api/profile/:id returns canonical badges for target user', async () => {
    const res = await axios.get(`${BASE_URL}/api/profile/${STUDENT_USER.id}`, { headers: authHeaders });
    const meRes = await axios.get(`${BASE_URL}/api/profile/me`, { headers: authHeaders });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.data.badges));
    assert.strictEqual(
      res.data.badges.length,
      meRes.data.badges.length,
      `Expected ${meRes.data.badges.length} badges in public profile, got ${res.data.badges.length}`
    );
  });

  // --------------------------------------------------------------------------
  // TEST 5: "View Badge" by internal badge id resolves successfully (200 OK, not 404)
  // --------------------------------------------------------------------------
  await test('GET /api/badges/:id resolves successfully by database badge id', async () => {
    const profRes = await axios.get(`${BASE_URL}/api/profile/me`, { headers: authHeaders });
    const badge = profRes.data.badges[0];
    const res = await axios.get(`${BASE_URL}/api/badges/${badge.id}`, { headers: authHeaders });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.id, badge.id);
    assert.strictEqual(res.data.credential_id, badge.credential_id);
    assert.strictEqual(res.data.certificate_id, badge.certificate_id);
    assert.notStrictEqual(res.data.issuer, 'Credential Authority');
  });

  // --------------------------------------------------------------------------
  // TEST 6: "View Badge" by credential_id resolves successfully
  // --------------------------------------------------------------------------
  await test('GET /api/badges/:credentialId resolves successfully by OpenBadge credential_id', async () => {
    const profRes = await axios.get(`${BASE_URL}/api/profile/me`, { headers: authHeaders });
    const badge = profRes.data.badges[0];
    const res = await axios.get(`${BASE_URL}/api/badges/${badge.credential_id}`, { headers: authHeaders });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.credential_id, badge.credential_id);
    assert(res.data.qrCode, 'Expected QR code to be generated');
    assert(res.data.verificationUrl, 'Expected verificationUrl to be provided');
  });

  // --------------------------------------------------------------------------
  // TEST 7: "View Badge" by certificate_id and badge-:certificateId resolves successfully
  // --------------------------------------------------------------------------
  await test('GET /api/badges/:certId and /api/badges/badge-:certId resolve successfully', async () => {
    const profRes = await axios.get(`${BASE_URL}/api/profile/me`, { headers: authHeaders });
    const badge = profRes.data.badges[0];
    const res1 = await axios.get(`${BASE_URL}/api/badges/${badge.certificate_id}`, { headers: authHeaders });
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.data.certificate_id, badge.certificate_id);

    const res2 = await axios.get(`${BASE_URL}/api/badges/badge-${badge.certificate_id}`, { headers: authHeaders });
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.data.certificate_id, badge.certificate_id);
  });

  // --------------------------------------------------------------------------
  // TEST 8: Cryptographic proof verification on the canonical badge is 100% valid
  // --------------------------------------------------------------------------
  await test('Authoritative badge passes eddsa-rdfc-2022 cryptographic signature verification', async () => {
    const profRes = await axios.get(`${BASE_URL}/api/profile/me`, { headers: authHeaders });
    const badge = profRes.data.badges[0];
    const verifyResult = await verifyBadgeByCredentialId(badge.credential_id);
    assert.strictEqual(verifyResult.success, true);
    assert.strictEqual(verifyResult.valid, true, `Verification failed: ${verifyResult.error}`);
    assert(
      verifyResult.sourceCertificateStatus === 'VERIFIED' || verifyResult.sourceCertificateStatus === 'APPROVED',
      `Expected status VERIFIED or APPROVED, got ${verifyResult.sourceCertificateStatus}`
    );
  });

  // --------------------------------------------------------------------------
  // TEST 9: Database integrity check: Exactly 1 row in badges for certificate
  // --------------------------------------------------------------------------
  await test('PostgreSQL badges table contains exactly 1 row for certificate (enforcing 1:1)', async () => {
    const profRes = await axios.get(`${BASE_URL}/api/profile/me`, { headers: authHeaders });
    const badge = profRes.data.badges[0];
    const dbRes = await pool.query(
      `SELECT id, student_id, certificate_id, credential_id, name, created_at 
       FROM badges 
       WHERE certificate_id = $1`,
      [badge.certificate_id]
    );
    assert.strictEqual(dbRes.rows.length, 1, `Expected 1 row in DB for cert ${badge.certificate_id}, got ${dbRes.rows.length}`);
  });

  console.log('='.repeat(70));
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} tests passed.`);
  console.log('='.repeat(70));

  await pool.end();
  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
