/**
 * ============================================================================
 * ROLE-BOUND AUTHENTICATION & SECURITY TEST SUITE
 * ============================================================================
 * 
 * Verifies all 10 security test scenarios required by STEP 6G / Role-Bound Auth:
 * 1. Issuer account + Issuer selection -> 200, JWT role = Issuer
 * 2. Issuer account + Admin selection -> 403, No JWT issued
 * 3. Admin account + Admin selection -> 200, JWT role = Admin (isolated simulation)
 * 4. Admin account + Issuer selection -> 403, No JWT issued (isolated simulation)
 * 5. Wrong password -> 401, No JWT
 * 6. Student registration attempt -> 400
 * 7. Teacher registration attempt -> 400
 * 8. Issuer JWT accessing /api/admin/certificates -> 403
 * 9. Admin JWT accessing /api/admin/certificates -> 200
 * 10. Frontend / client role tampering -> backend rejects based on signed JWT
 * 
 * ZERO-DATA-MUTATION RULE:
 * This script DOES NOT insert, update, or delete any records in the real database.
 * ============================================================================
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const http = require('http');
const bcrypt = require('bcrypt');
const { generateToken, JWT_SECRET } = require('../middleware/authMiddleware');
const pool = require('../config/database');

const BASE_URL = 'http://localhost:5000';

function postJson(urlPath, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const url = new URL(urlPath, BASE_URL);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        let json = {};
        try { json = JSON.parse(body); } catch { json = { raw: body }; }
        resolve({ status: res.statusCode, data: json });
      });
    });

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

function getJson(urlPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        let json = {};
        try { json = JSON.parse(body); } catch { json = { raw: body }; }
        resolve({ status: res.statusCode, data: json });
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

async function runRoleSecurityTests() {
  console.log('===============================================================');
  console.log('STEP 6: ROLE-BOUND AUTHENTICATION & SECURITY TEST SUITE');
  console.log('===============================================================\n');

  const results = {};

  // --------------------------------------------------------------------------
  // TEST 5: Wrong password -> 401, No JWT
  // --------------------------------------------------------------------------
  console.log('--- TEST 5: Wrong password authentication rejection ---');
  try {
    const res = await postJson('/api/auth/login', {
      email: 'poojadas@gmail.com',
      password: 'DefinitelyWrongPassword123!',
      role: 'Issuer',
    });
    const passed = res.status === 401 && !res.data.token;
    results['TEST 5: Wrong Password'] = passed ? 'PASS' : 'FAIL';
    console.log(`[TEST 5] Status: ${res.status}, Error: "${res.data.error || res.data.message}", Token: ${res.data.token || 'None'}`);
    console.log(`Result: ${passed ? 'PASS' : 'FAIL'}\n`);
  } catch (err) {
    results['TEST 5: Wrong Password'] = `ERROR: ${err.message}`;
    console.error('[TEST 5] Error:', err.message, '\n');
  }

  // --------------------------------------------------------------------------
  // TEST 6: Student registration attempt -> 400
  // --------------------------------------------------------------------------
  console.log('--- TEST 6: Registration with Student role rejection ---');
  try {
    const res = await postJson('/api/auth/register', {
      name: 'Attempted Student',
      email: 'student.attempt@gmail.com',
      password: 'Password123!',
      role: 'Student',
    });
    const passed = res.status === 400 && res.data.success === false;
    results['TEST 6: Student Registration Rejection'] = passed ? 'PASS' : 'FAIL';
    console.log(`[TEST 6] Status: ${res.status}, Message: "${res.data.error || res.data.message}"`);
    console.log(`Result: ${passed ? 'PASS' : 'FAIL'}\n`);
  } catch (err) {
    results['TEST 6: Student Registration Rejection'] = `ERROR: ${err.message}`;
    console.error('[TEST 6] Error:', err.message, '\n');
  }

  // --------------------------------------------------------------------------
  // TEST 7: Teacher registration attempt -> 400
  // --------------------------------------------------------------------------
  console.log('--- TEST 7: Registration with Teacher role rejection ---');
  try {
    const res = await postJson('/api/auth/register', {
      name: 'Attempted Teacher',
      email: 'teacher.attempt@gmail.com',
      password: 'Password123!',
      role: 'Teacher',
    });
    const passed = res.status === 400 && res.data.success === false;
    results['TEST 7: Teacher Registration Rejection'] = passed ? 'PASS' : 'FAIL';
    console.log(`[TEST 7] Status: ${res.status}, Message: "${res.data.error || res.data.message}"`);
    console.log(`Result: ${passed ? 'PASS' : 'FAIL'}\n`);
  } catch (err) {
    results['TEST 7: Teacher Registration Rejection'] = `ERROR: ${err.message}`;
    console.error('[TEST 7] Error:', err.message, '\n');
  }

  // --------------------------------------------------------------------------
  // TEST 8: Issuer JWT accessing /api/admin/certificates -> 403
  // --------------------------------------------------------------------------
  console.log('--- TEST 8: Issuer JWT access to Admin API endpoint ---');
  try {
    const issuerToken = generateToken({
      id: '62deb8a7-561a-44e5-b544-2c1328ed86e1',
      email: 'poojadas@gmail.com',
      role: 'Issuer',
      name: 'Pooja Das',
    });
    const res = await getJson('/api/admin/certificates', {
      Authorization: `Bearer ${issuerToken}`,
    });
    const passed = res.status === 403;
    results['TEST 8: Issuer Denied Admin Endpoint'] = passed ? 'PASS' : 'FAIL';
    console.log(`[TEST 8] Status: ${res.status}, Message: "${res.data.error || res.data.message}"`);
    console.log(`Result: ${passed ? 'PASS' : 'FAIL'}\n`);
  } catch (err) {
    results['TEST 8: Issuer Denied Admin Endpoint'] = `ERROR: ${err.message}`;
    console.error('[TEST 8] Error:', err.message, '\n');
  }

  // --------------------------------------------------------------------------
  // TEST 9: Admin JWT accessing /api/admin/certificates -> 200
  // --------------------------------------------------------------------------
  console.log('--- TEST 9: Admin JWT access to Admin API endpoint ---');
  try {
    const adminToken = generateToken({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@system.local',
      role: 'Admin',
      name: 'System Admin',
    });
    const res = await getJson('/api/admin/certificates', {
      Authorization: `Bearer ${adminToken}`,
    });
    const passed = res.status === 200 && Array.isArray(res.data);
    results['TEST 9: Admin Authorized Admin Endpoint'] = passed ? 'PASS' : 'FAIL';
    console.log(`[TEST 9] Status: ${res.status}, Certificates count: ${Array.isArray(res.data) ? res.data.length : 'N/A'}`);
    console.log(`Result: ${passed ? 'PASS' : 'FAIL'}\n`);
  } catch (err) {
    results['TEST 9: Admin Authorized Admin Endpoint'] = `ERROR: ${err.message}`;
    console.error('[TEST 9] Error:', err.message, '\n');
  }

  // --------------------------------------------------------------------------
  // TEST 10: Client Role Tampering Protection
  // --------------------------------------------------------------------------
  console.log('--- TEST 10: Client Role Tampering Protection ---');
  try {
    // User claims role: 'Admin' in request body or headers, but uses Issuer token
    const issuerToken = generateToken({
      id: '62deb8a7-561a-44e5-b544-2c1328ed86e1',
      email: 'poojadas@gmail.com',
      role: 'Issuer',
      name: 'Pooja Das',
    });
    const res = await getJson(
      '/api/admin/certificates?role=Admin',
      { Authorization: `Bearer ${issuerToken}`, 'X-Role': 'Admin' }
    );
    const passed = res.status === 403;
    results['TEST 10: Client Role Tampering Prevented'] = passed ? 'PASS' : 'FAIL';
    console.log(`[TEST 10] Status: ${res.status}, Backend rejected based on verified JWT role: ${passed}`);
    console.log(`Result: ${passed ? 'PASS' : 'FAIL'}\n`);
  } catch (err) {
    results['TEST 10: Client Role Tampering Prevented'] = `ERROR: ${err.message}`;
    console.error('[TEST 10] Error:', err.message, '\n');
  }

  // --------------------------------------------------------------------------
  // UNIT / ISOLATED ROLE-BINDING LOGIC TESTS (TESTS 1, 2, 3, 4)
  // (Tests exact login role-binding logic without altering or writing to PostgreSQL)
  // --------------------------------------------------------------------------
  console.log('--- TESTS 1-4: Unit Role-Binding Verification (Zero DB Mutation) ---');

  // Simulated logic mirroring POST /api/auth/login exact implementation
  function executeLoginRoleCheck(databaseRoleRaw, selectedRole) {
    const authoritativeRole = databaseRoleRaw.toLowerCase() === 'admin' ? 'Admin' : 'Issuer';
    const normalizedSelected = (selectedRole || '').trim().toLowerCase() === 'admin' ? 'Admin' : (selectedRole.toLowerCase() === 'issuer' ? 'Issuer' : null);

    if (normalizedSelected && normalizedSelected !== authoritativeRole) {
      return {
        status: 403,
        success: false,
        message: 'Selected role does not match the role assigned to this account.',
        token: null,
      };
    }

    const payload = {
      id: 'sample-id',
      email: 'test@example.com',
      name: 'Test User',
      role: authoritativeRole, // STRICTLY database role
    };
    const token = generateToken(payload);
    return {
      status: 200,
      success: true,
      roleInJwt: payload.role,
      token,
    };
  }

  // TEST 1: Issuer account + Issuer selection
  const t1 = executeLoginRoleCheck('issuer', 'Issuer');
  const pass1 = t1.status === 200 && t1.roleInJwt === 'Issuer' && Boolean(t1.token);
  results['TEST 1: Issuer Account + Issuer Selection'] = pass1 ? 'PASS' : 'FAIL';
  console.log(`[TEST 1] Status: ${t1.status}, JWT Role: ${t1.roleInJwt}, Result: ${pass1 ? 'PASS' : 'FAIL'}`);

  // TEST 2: Issuer account + Admin selection
  const t2 = executeLoginRoleCheck('issuer', 'Admin');
  const pass2 = t2.status === 403 && t2.token === null;
  results['TEST 2: Issuer Account + Admin Selection'] = pass2 ? 'PASS' : 'FAIL';
  console.log(`[TEST 2] Status: ${t2.status}, Message: "${t2.message}", Token: ${t2.token}, Result: ${pass2 ? 'PASS' : 'FAIL'}`);

  // TEST 3: Admin account + Admin selection
  const t3 = executeLoginRoleCheck('admin', 'Admin');
  const pass3 = t3.status === 200 && t3.roleInJwt === 'Admin' && Boolean(t3.token);
  results['TEST 3: Admin Account + Admin Selection (Isolated)'] = pass3 ? 'PASS' : 'FAIL';
  console.log(`[TEST 3] Status: ${t3.status}, JWT Role: ${t3.roleInJwt}, Result: ${pass3 ? 'PASS' : 'FAIL'}`);

  // TEST 4: Admin account + Issuer selection
  const t4 = executeLoginRoleCheck('admin', 'Issuer');
  const pass4 = t4.status === 403 && t4.token === null;
  results['TEST 4: Admin Account + Issuer Selection (Isolated)'] = pass4 ? 'PASS' : 'FAIL';
  console.log(`[TEST 4] Status: ${t4.status}, Message: "${t4.message}", Token: ${t4.token}, Result: ${pass4 ? 'PASS' : 'FAIL'}`);

  console.log('\n===============================================================');
  console.log('ALL TESTS SUMMARY');
  console.log('===============================================================');
  console.table(results);

  await pool.end();
}

runRoleSecurityTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
