/**
 * ==============================================================================
 * Test Suite: Dashboard API & User Metrics
 * File: backend/tests/dashboard.test.js
 * 
 * Tests:
 * 1. Unauthenticated GET /api/dashboard returns 401
 * 2. Authenticated GET /api/dashboard returns 200 with all 6 metric categories
 * 3. Field names: totalCertificates, verifiedCertificates, pendingCertificates,
 *    skillsEarned, badgesEarned, totalActivities (and all snake_case aliases)
 * 4. User scoping: activity count reflects only authenticated user's records
 * 5. Safe defaults: zero undefined/null numeric statistics
 * 6. Database integrity: zero mutations
 * ==============================================================================
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const assert = require('assert');
const axios = require('axios');
const pool = require('../config/database');
const { generateToken } = require('../middleware/authMiddleware');

const BASE_URL = 'http://localhost:5000/api/dashboard';

async function runDashboardTests() {
  console.log('===============================================================');
  console.log('STARTING DASHBOARD API TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  async function testCase(name, fn) {
    total++;
    try {
      await fn();
      console.log(`PASS [${total}]: ${name}`);
      passed++;
    } catch (err) {
      console.error(`FAIL [${total}]: ${name}`);
      console.error(`       Error: ${err.message}`);
    }
  }

  const tokenUser1 = generateToken({
    id: '2d56ab4e-ce06-47b1-afc4-ec0f341a4b90',
    email: 'poojadas@gmail.com',
    role: 'issuer'
  });

  const tokenUser2 = generateToken({
    id: 'e9372ed0-87e3-4d71-9778-40aa356e8e9e',
    email: 'user2@example.com',
    role: 'issuer'
  });

  // TEST 1: Unauthenticated request
  await testCase('Unauthenticated GET /api/dashboard is rejected with 401', async () => {
    try {
      await axios.get(BASE_URL);
      assert.fail('Should have failed with 401');
    } catch (err) {
      assert.strictEqual(err.response?.status, 401, 'Expected status 401');
    }
  });

  // TEST 2: Authenticated request returns 200 with all metric fields
  await testCase('Authenticated GET /api/dashboard returns 200 with all 6 metric categories', async () => {
    const res = await axios.get(BASE_URL, {
      headers: { Authorization: `Bearer ${tokenUser1}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);

    const data = res.data;
    assert(typeof data.totalCertificates === 'number', 'totalCertificates must be a number');
    assert(typeof data.verifiedCertificates === 'number', 'verifiedCertificates must be a number');
    assert(typeof data.pendingCertificates === 'number', 'pendingCertificates must be a number');
    assert(typeof data.skillsEarned === 'number', 'skillsEarned must be a number');
    assert(typeof data.badgesEarned === 'number', 'badgesEarned must be a number');
    assert(typeof data.totalActivities === 'number', 'totalActivities must be a number');

    // Verify aliases
    assert.strictEqual(data.total_certificates, data.totalCertificates);
    assert.strictEqual(data.verified_certificates, data.verifiedCertificates);
    assert.strictEqual(data.pending_certificates, data.pendingCertificates);
    assert.strictEqual(data.skills_earned, data.skillsEarned);
    assert.strictEqual(data.badges_earned, data.badgesEarned);
    assert.strictEqual(data.total_activities, data.totalActivities);
    assert.strictEqual(data.activitiesLogged, data.totalActivities);
    assert.strictEqual(data.activities_logged, data.totalActivities);
  });

  // TEST 3: User isolation for activities count
  await testCase('User scoping: User 1 (0 activities) vs User 2 (1 activity in DB)', async () => {
    const res1 = await axios.get(BASE_URL, {
      headers: { Authorization: `Bearer ${tokenUser1}` }
    });
    assert.strictEqual(res1.data.totalActivities, 0, 'User 1 should have 0 activities');

    const res2 = await axios.get(BASE_URL, {
      headers: { Authorization: `Bearer ${tokenUser2}` }
    });
    assert.strictEqual(res2.data.totalActivities, 1, 'User 2 should have 1 activity');
  });

  // TEST 4: Arrays for recentCertificates and latestBadges
  await testCase('recentCertificates and latestBadges are arrays', async () => {
    const res = await axios.get(BASE_URL, {
      headers: { Authorization: `Bearer ${tokenUser1}` }
    });
    assert(Array.isArray(res.data.recentCertificates), 'recentCertificates must be an array');
    assert(Array.isArray(res.data.latestBadges), 'latestBadges must be an array');
  });

  // TEST 5: Database baseline counts remain intact
  await testCase('Zero mutations: Database table row counts are preserved', async () => {
    const countsRes = await pool.query(`
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
    const c = countsRes.rows[0];
    assert.strictEqual(c.profiles, '3');
    assert.strictEqual(c.certificates, '2');
    assert.strictEqual(c.skills, '7');
    assert.strictEqual(c.activity_logs, '1');
  });

  console.log('\n===============================================================');
  console.log(`DASHBOARD TEST RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log('===============================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

if (require.main === module) {
  runDashboardTests().then(async () => {
    await pool.end();
  }).catch(async (err) => {
    console.error('Fatal error:', err);
    await pool.end();
    process.exit(1);
  });
}

module.exports = { runDashboardTests };
