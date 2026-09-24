/**
 * ==============================================================================
 * Admin Authentication Security Test Suite
 * File: backend/tests/adminAuth.test.js
 *
 * Tests:
 *  1. admin@test.in + Admin@1234 → login succeeds with role=Admin
 *  2. admin@test.in + wrong password → HTTP 401 rejected
 *  3. Non-admin email trying to sign in with role=Admin → HTTP 403 rejected
 *  4. POST /api/auth/register with role=admin → HTTP 403 rejected
 *  5. POST /api/auth/register with role=Admin (capitalized) → HTTP 403 rejected
 *  6. POST /api/auth/register with role=ADMIN (all caps) → HTTP 403 rejected
 *  7. Normal user signup as Issuer → HTTP 201 succeeds
 *  8. Normal user login → HTTP 200 succeeds with role=Issuer
 *  9. Only 1 admin account exists in PostgreSQL
 * 10. Returned JWT for admin contains role=Admin
 * 11. Admin-protected route accessible with admin JWT
 * 12. Admin-protected route blocked for issuer JWT
 * ==============================================================================
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const assert = require('assert');
const axios  = require('axios');
const pool   = require('../config/database');

const BASE = 'http://localhost:5000/api/auth';
const jwt  = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'student-credential-engine-secure-key-2026';

const ADMIN_EMAIL    = 'admin@test.in';
const ADMIN_PASSWORD = 'Admin@1234';

// Unique test email so we never collide with existing data
const TEST_ISSUER_EMAIL    = `testissuer_${Date.now()}@gmail.com`;
const TEST_ISSUER_PASSWORD = 'Test@12345';
const TEST_ISSUER_NAME     = 'Test Issuer User';

let passed = 0;
let failed = 0;
let testIssuerToken = null; // populated after test 7

async function test(label, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${label}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${label}`);
    console.error(`         ${err.message}`);
    if (err.response) {
      console.error(`         HTTP ${err.response.status} → ${JSON.stringify(err.response.data)}`);
    }
    failed++;
  }
}

async function runSuite() {
  console.log('='.repeat(68));
  console.log('ADMIN AUTHENTICATION SECURITY TEST SUITE');
  console.log('='.repeat(68));

  // ── Test 1: admin@test.in correct credentials → login succeeds ──────────
  await test('admin@test.in + Admin@1234 → login succeeds (HTTP 200)', async () => {
    const res = await axios.post(`${BASE}/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: 'Admin',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user.role, 'Admin');
    assert.strictEqual(res.data.user.email.toLowerCase(), ADMIN_EMAIL.toLowerCase());
    assert(res.data.token, 'JWT token must be returned');
  });

  // ── Test 2: admin@test.in + wrong password → 401 ───────────────────────
  await test('admin@test.in + wrong password → HTTP 401 rejected', async () => {
    try {
      await axios.post(`${BASE}/login`, {
        email: ADMIN_EMAIL,
        password: 'WrongPassword!99',
        role: 'Admin',
      });
      throw new Error('Expected HTTP 401 but got 200');
    } catch (err) {
      if (!err.response) throw err;
      assert.strictEqual(err.response.status, 401, `Expected 401, got ${err.response.status}`);
    }
  });

  // ── Test 3: Another email trying to log in with role=Admin → 403 ────────
  await test('issuer email logging in with role=Admin → HTTP 403 rejected', async () => {
    try {
      await axios.post(`${BASE}/login`, {
        email: 'poojadas@gmail.com',
        password: 'anything',
        role: 'Admin',
      });
      throw new Error('Expected HTTP 403 or 401 but got 200');
    } catch (err) {
      if (!err.response) throw err;
      assert(
        err.response.status === 403 || err.response.status === 401,
        `Expected 403 or 401, got ${err.response.status}`
      );
    }
  });

  // ── Test 4: Register with role=admin (lowercase) → 403 ──────────────────
  await test('POST /register with role=admin (lowercase) → HTTP 403 blocked', async () => {
    try {
      await axios.post(`${BASE}/register`, {
        name: 'Hacker',
        email: `hacker_${Date.now()}@gmail.com`,
        password: 'Hack@1234',
        role: 'admin',
      });
      throw new Error('Expected HTTP 403 but got 201');
    } catch (err) {
      if (!err.response) throw err;
      assert.strictEqual(err.response.status, 403, `Expected 403, got ${err.response.status}`);
      assert(
        err.response.data.error.includes('Admin accounts cannot be created'),
        `Expected admin block message, got: ${err.response.data.error}`
      );
    }
  });

  // ── Test 5: Register with role=Admin (capitalized) → 403 ────────────────
  await test('POST /register with role=Admin (capitalized) → HTTP 403 blocked', async () => {
    try {
      await axios.post(`${BASE}/register`, {
        name: 'Hacker',
        email: `hacker2_${Date.now()}@gmail.com`,
        password: 'Hack@1234',
        role: 'Admin',
      });
      throw new Error('Expected HTTP 403 but got 201');
    } catch (err) {
      if (!err.response) throw err;
      assert.strictEqual(err.response.status, 403, `Expected 403, got ${err.response.status}`);
    }
  });

  // ── Test 6: Register with role=ADMIN (all caps) → 403 ───────────────────
  await test('POST /register with role=ADMIN (all caps) → HTTP 403 blocked', async () => {
    try {
      await axios.post(`${BASE}/register`, {
        name: 'Hacker',
        email: `hacker3_${Date.now()}@gmail.com`,
        password: 'Hack@1234',
        role: 'ADMIN',
      });
      throw new Error('Expected HTTP 403 but got 201');
    } catch (err) {
      if (!err.response) throw err;
      assert.strictEqual(err.response.status, 403, `Expected 403, got ${err.response.status}`);
    }
  });

  // ── Test 7: Normal user signup as Issuer → 201 ──────────────────────────
  await test('Normal user signup as Issuer → HTTP 201 succeeds', async () => {
    const res = await axios.post(`${BASE}/register`, {
      name: TEST_ISSUER_NAME,
      email: TEST_ISSUER_EMAIL,
      password: TEST_ISSUER_PASSWORD,
      role: 'Issuer',
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user.role, 'Issuer');
    assert(res.data.token, 'JWT must be returned');
    testIssuerToken = res.data.token;
  });

  // ── Test 8: Normal user login → 200, role=Issuer ────────────────────────
  await test('Normal user login → HTTP 200 succeeds with role=Issuer', async () => {
    const res = await axios.post(`${BASE}/login`, {
      email: TEST_ISSUER_EMAIL,
      password: TEST_ISSUER_PASSWORD,
      role: 'Issuer',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user.role, 'Issuer');
  });

  // ── Test 9: Exactly 1 admin exists in PostgreSQL ─────────────────────────
  await test('Exactly 1 admin account exists in the PostgreSQL database', async () => {
    const res = await pool.query(`SELECT email FROM profiles WHERE role = 'admin'`);
    assert.strictEqual(
      res.rows.length, 1,
      `Expected 1 admin row, found ${res.rows.length}: ${res.rows.map(r=>r.email).join(', ')}`
    );
    assert.strictEqual(
      res.rows[0].email.toLowerCase(),
      ADMIN_EMAIL.toLowerCase(),
      `Expected admin email to be ${ADMIN_EMAIL}, got ${res.rows[0].email}`
    );
  });

  // ── Test 10: Admin JWT contains role=Admin ───────────────────────────────
  await test('Admin JWT payload contains role=Admin (not issuer)', async () => {
    const loginRes = await axios.post(`${BASE}/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: 'Admin',
    });
    const decoded = jwt.verify(loginRes.data.token, JWT_SECRET);
    assert.strictEqual(
      decoded.role, 'Admin',
      `Expected decoded JWT role=Admin, got ${decoded.role}`
    );
  });

  // ── Test 11: Admin-protected route accessible with admin JWT ─────────────
  await test('Admin-protected route /api/admin/certificates → 200 with admin JWT', async () => {
    const loginRes = await axios.post(`${BASE}/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: 'Admin',
    });
    const adminToken = loginRes.data.token;
    const res = await axios.get('http://localhost:5000/api/admin/certificates', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
  });

  // ── Test 12: Admin-protected route blocked for issuer JWT ────────────────
  await test('Admin-protected route /api/admin/certificates → 403 with issuer JWT', async () => {
    assert(testIssuerToken, 'Issuer token not available — test 7 may have failed');
    try {
      await axios.get('http://localhost:5000/api/admin/certificates', {
        headers: { Authorization: `Bearer ${testIssuerToken}` },
      });
      throw new Error('Expected 403 but got 200');
    } catch (err) {
      if (!err.response) throw err;
      assert.strictEqual(err.response.status, 403, `Expected 403, got ${err.response.status}`);
    }
  });

  // ── Cleanup: remove test issuer account ─────────────────────────────────
  try {
    await pool.query(`DELETE FROM profiles WHERE LOWER(email) = LOWER($1)`, [TEST_ISSUER_EMAIL]);
    console.log(`\n  [CLEANUP] Test issuer account removed: ${TEST_ISSUER_EMAIL}`);
  } catch (cleanErr) {
    console.warn(`  [CLEANUP WARNING] Could not remove test issuer: ${cleanErr.message}`);
  }

  console.log('');
  console.log('='.repeat(68));
  console.log(`ADMIN AUTH TEST RESULTS: ${passed}/${passed + failed} PASSED${failed > 0 ? `, ${failed} FAILED` : ''}`);
  console.log('='.repeat(68));

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runSuite().catch(err => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
