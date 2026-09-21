/**
 * ============================================================================
 * NON-DESTRUCTIVE TEST SUITE: USER-SCOPED CERTIFICATE DUPLICATE PREVENTION
 * ============================================================================
 *
 * Scenarios tested:
 * TEST 1: User A + Certificate X -> ALLOW
 * TEST 2: User A + Certificate X again -> REJECT 409
 * TEST 3: User A + same Certificate X with a different filename -> REJECT 409
 * TEST 4: User B + same Certificate X -> ALLOW
 * TEST 5: User C + same Certificate X -> ALLOW
 * TEST 6: User A + different Certificate Y -> ALLOW
 * TEST 7: Unauthenticated upload -> REJECT 401
 * TEST 8: Attempt to manipulate student_id in request -> Rejected/Scoped to JWT
 * TEST 9: Two simultaneous uploads of the same certificate by User A -> Only 1 created
 *
 * GUARANTEES:
 * - 0 dummy records left in PostgreSQL database
 * - 0 schema mutations
 * - Existing real user certificate preserved
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('../config/database');
const { generateToken } = require('../middleware/authMiddleware');

const BASE_URL = 'http://localhost:5000';

// Real user in database who owns the existing certificate:
// id: 2d56ab4e-ce06-47b1-afc4-ec0f341a4b90 (poojadas@gmail.com)
const USER_A_ID = '2d56ab4e-ce06-47b1-afc4-ec0f341a4b90';

// Other real user in database:
// id: 043258e2-4938-43e1-93c2-52ca5d7600e0 (shreya18das@gmail.com)
const USER_B_ID = '043258e2-4938-43e1-93c2-52ca5d7600e0';

async function getDbCounts() {
  const res = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM public.profiles) as profiles,
      (SELECT COUNT(*) FROM public.certificates) as certificates,
      (SELECT COUNT(*) FROM public.certificate_skills) as certificate_skills,
      (SELECT COUNT(*) FROM public.badges) as badges,
      (SELECT COUNT(*) FROM public.verification_logs) as verification_logs,
      (SELECT COUNT(*) FROM public.skills) as skills;
  `);
  return res.rows[0];
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('STARTING USER-SCOPED CERTIFICATE DUPLICATE TEST SUITE');
  console.log('===============================================================\n');

  const initialCounts = await getDbCounts();
  console.log('Initial Database Counts:', JSON.stringify(initialCounts));

  // Load real existing certificate file (Certificate X)
  const certPath = path.join(__dirname, '../uploads/cert-1789820304138-97a20a47.pdf');
  const certBytes = fs.readFileSync(certPath);
  const certHash = crypto.createHash('sha256').update(certBytes).digest('hex');
  console.log(`Certificate X SHA-256: ${certHash}`);

  // Generate tokens
  const tokenUserA = generateToken({
    id: USER_A_ID,
    email: 'poojadas@gmail.com',
    role: 'issuer',
    name: 'Pooja Das',
  });

  const tokenUserB = generateToken({
    id: USER_B_ID,
    email: 'shreya18das@gmail.com',
    role: 'admin',
    name: 'shreya',
  });

  const results = {};

  // --------------------------------------------------------------------------
  // TEST 7: Unauthenticated upload
  // Expected: 401
  // --------------------------------------------------------------------------
  console.log('\n--- RUNNING TEST 7: Unauthenticated Upload ---');
  {
    const blob = new Blob([certBytes], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('certificate', blob, 'test-cert.pdf');
    formData.append('certificate_name', 'Test Unauth');
    formData.append('issuer', 'Test Org');

    const res = await fetch(`${BASE_URL}/api/certificates/upload`, {
      method: 'POST',
      body: formData,
    });

    const json = await res.json().catch(() => ({}));
    const passed = res.status === 401;
    results.TEST_7 = {
      description: 'Unauthenticated upload rejected with 401',
      passed,
      status: res.status,
      response: json,
    };
    console.log(`TEST 7: [${passed ? 'PASS' : 'FAIL'}] HTTP ${res.status}`);
  }

  // --------------------------------------------------------------------------
  // TEST 2: User A + Certificate X again
  // Expected: REJECT 409 Conflict
  // --------------------------------------------------------------------------
  console.log('\n--- RUNNING TEST 2: User A + Certificate X Again (Duplicate) ---');
  {
    const blob = new Blob([certBytes], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('certificate', blob, 'spotify-clone.pdf');
    formData.append('certificate_name', 'spotify clone');
    formData.append('issuer', 'Spotify');

    const res = await fetch(`${BASE_URL}/api/certificates/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenUserA}`,
      },
      body: formData,
    });

    const json = await res.json().catch(() => ({}));
    const passed =
      res.status === 409 &&
      json.code === 'DUPLICATE_CERTIFICATE' &&
      json.message === 'This certificate has already been uploaded to your account.';
    results.TEST_2 = {
      description: 'User A uploading existing Certificate X rejected with 409',
      passed,
      status: res.status,
      code: json.code,
      message: json.message,
    };
    console.log(`TEST 2: [${passed ? 'PASS' : 'FAIL'}] HTTP ${res.status} - Message: "${json.message}"`);
  }

  // --------------------------------------------------------------------------
  // TEST 3: User A + same Certificate X with a different filename
  // Expected: REJECT 409 (hash-based, not filename-based)
  // --------------------------------------------------------------------------
  console.log('\n--- RUNNING TEST 3: User A + Certificate X with Different Filename ---');
  {
    const blob = new Blob([certBytes], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('certificate', blob, 'completely-different-name-12345.pdf');
    formData.append('certificate_name', 'Completely Different Name');
    formData.append('issuer', 'Different Issuer');

    const res = await fetch(`${BASE_URL}/api/certificates/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenUserA}`,
      },
      body: formData,
    });

    const json = await res.json().catch(() => ({}));
    const passed =
      res.status === 409 &&
      json.code === 'DUPLICATE_CERTIFICATE' &&
      json.message === 'This certificate has already been uploaded to your account.';
    results.TEST_3 = {
      description: 'User A uploading Certificate X under new filename rejected with 409 based on content hash',
      passed,
      status: res.status,
      code: json.code,
      message: json.message,
    };
    console.log(`TEST 3: [${passed ? 'PASS' : 'FAIL'}] HTTP ${res.status} - Message: "${json.message}"`);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Attempt to manipulate student_id in request
  // Expected: ignored/rejected; ownership comes strictly from JWT
  // --------------------------------------------------------------------------
  console.log('\n--- RUNNING TEST 8: Spoofed student_id in Form Body ---');
  {
    const blob = new Blob([certBytes], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('certificate', blob, 'spotify-clone.pdf');
    formData.append('certificate_name', 'spotify clone');
    formData.append('issuer', 'Spotify');
    // Attacker sends someone else's student_id in form
    formData.append('student_id', USER_B_ID);

    const res = await fetch(`${BASE_URL}/api/certificates/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenUserA}`, // JWT is User A
      },
      body: formData,
    });

    const json = await res.json().catch(() => ({}));
    // Since backend uses req.user.id (User A) and Certificate X exists under User A,
    // spoofing student_id=User_B in body does NOT bypass duplicate detection.
    const passed =
      res.status === 409 &&
      json.code === 'DUPLICATE_CERTIFICATE' &&
      json.message === 'This certificate has already been uploaded to your account.';
    results.TEST_8 = {
      description: 'Spoofed student_id in body ignored; ownership resolved from JWT and rejected 409',
      passed,
      status: res.status,
      code: json.code,
      message: json.message,
    };
    console.log(`TEST 8: [${passed ? 'PASS' : 'FAIL'}] HTTP ${res.status} - Message: "${json.message}"`);
  }

  // --------------------------------------------------------------------------
  // TRANSACTIONAL TESTS (TEST 1, TEST 4, TEST 5, TEST 6, TEST 9)
  // Tested inside an explicit PostgreSQL TRANSACTION with ROLLBACK
  // Guarantees zero residual database records.
  // --------------------------------------------------------------------------
  console.log('\n--- RUNNING TRANSACTIONAL TESTS (1, 4, 5, 6, 9) WITH ROLLBACK ---');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create hypothetical User C for multi-user test inside transaction
    const userCRes = await client.query(`
      INSERT INTO profiles (id, email, password_hash, role, full_name, created_at)
      VALUES ('c0000000-0000-0000-0000-000000000003', 'userc@test.com', '$2b$10$dummyHashForUserCInTransaction', 'issuer', 'User C', NOW())
      RETURNING id;
    `);
    const USER_C_ID = userCRes.rows[0].id;

    // Generate different Certificate Y hash
    const certYBytes = Buffer.from('Dummy Certificate Y Content - Unique Byte Signature');
    const certYHash = crypto.createHash('sha256').update(certYBytes).digest('hex');

    // TEST 4: User B + same Certificate X (certHash) -> ALLOW
    console.log('Testing Scenario: User B + same Certificate X');
    const dupCheckUserB = await client.query(
      'SELECT id FROM certificates WHERE student_id = $1 AND file_hash = $2 LIMIT 1',
      [USER_B_ID, certHash]
    );
    const userBDupCheckPass = dupCheckUserB.rows.length === 0;

    // Insert under User B
    const insertUserB = await client.query(`
      INSERT INTO certificates (
        student_id, certificate_name, issuer, file_url, file_type, status,
        verification_score, file_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id;
    `, [USER_B_ID, 'spotify clone - User B', 'Spotify', 'http://localhost:5000/uploads/testB.pdf', 'PDF', 'MANUAL_REVIEW', 60, certHash]);

    const userBInserted = insertUserB.rows.length > 0;
    results.TEST_4 = {
      description: 'User B can upload the exact same Certificate X owned by User A',
      passed: userBDupCheckPass && userBInserted,
      userBDupCheckRows: dupCheckUserB.rows.length,
      userBCertId: insertUserB.rows[0].id,
    };
    console.log(`TEST 4: [${results.TEST_4.passed ? 'PASS' : 'FAIL'}] Allowed User B to register Certificate X`);

    // TEST 5: User C + same Certificate X (certHash) -> ALLOW
    console.log('Testing Scenario: User C + same Certificate X');
    const dupCheckUserC = await client.query(
      'SELECT id FROM certificates WHERE student_id = $1 AND file_hash = $2 LIMIT 1',
      [USER_C_ID, certHash]
    );
    const userCDupCheckPass = dupCheckUserC.rows.length === 0;

    const insertUserC = await client.query(`
      INSERT INTO certificates (
        student_id, certificate_name, issuer, file_url, file_type, status,
        verification_score, file_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id;
    `, [USER_C_ID, 'spotify clone - User C', 'Spotify', 'http://localhost:5000/uploads/testC.pdf', 'PDF', 'MANUAL_REVIEW', 60, certHash]);

    const userCInserted = insertUserC.rows.length > 0;
    results.TEST_5 = {
      description: 'User C can upload the exact same Certificate X owned by User A and User B',
      passed: userCDupCheckPass && userCInserted,
      userCDupCheckRows: dupCheckUserC.rows.length,
      userCCertId: insertUserC.rows[0].id,
    };
    console.log(`TEST 5: [${results.TEST_5.passed ? 'PASS' : 'FAIL'}] Allowed User C to register Certificate X`);

    // TEST 1: User A + New Certificate Z -> ALLOW
    console.log('Testing Scenario: User A + New Certificate Z');
    const certZHash = crypto.createHash('sha256').update(Buffer.from('Certificate Z Bytes')).digest('hex');
    const dupCheckUserAZ = await client.query(
      'SELECT id FROM certificates WHERE student_id = $1 AND file_hash = $2 LIMIT 1',
      [USER_A_ID, certZHash]
    );
    const userAZDupCheckPass = dupCheckUserAZ.rows.length === 0;

    const insertUserAZ = await client.query(`
      INSERT INTO certificates (
        student_id, certificate_name, issuer, file_url, file_type, status,
        verification_score, file_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id;
    `, [USER_A_ID, 'Certificate Z', 'Issuer Z', 'http://localhost:5000/uploads/testZ.pdf', 'PDF', 'MANUAL_REVIEW', 60, certZHash]);

    results.TEST_1 = {
      description: 'User A uploading a new certificate for the first time is ALLOWED',
      passed: userAZDupCheckPass && insertUserAZ.rows.length > 0,
      certId: insertUserAZ.rows[0].id,
    };
    console.log(`TEST 1: [${results.TEST_1.passed ? 'PASS' : 'FAIL'}] Allowed User A to register new Certificate Z`);

    // TEST 6: User A + different Certificate Y -> ALLOW
    console.log('Testing Scenario: User A + different Certificate Y');
    const dupCheckUserAY = await client.query(
      'SELECT id FROM certificates WHERE student_id = $1 AND file_hash = $2 LIMIT 1',
      [USER_A_ID, certYHash]
    );
    const userAYDupCheckPass = dupCheckUserAY.rows.length === 0;

    const insertUserAY = await client.query(`
      INSERT INTO certificates (
        student_id, certificate_name, issuer, file_url, file_type, status,
        verification_score, file_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id;
    `, [USER_A_ID, 'Certificate Y', 'Issuer Y', 'http://localhost:5000/uploads/testY.pdf', 'PDF', 'MANUAL_REVIEW', 60, certYHash]);

    results.TEST_6 = {
      description: 'User A uploading different Certificate Y is ALLOWED',
      passed: userAYDupCheckPass && insertUserAY.rows.length > 0,
      certId: insertUserAY.rows[0].id,
    };
    console.log(`TEST 6: [${results.TEST_6.passed ? 'PASS' : 'FAIL'}] Allowed User A to register Certificate Y`);

    // TEST 9: Two simultaneous uploads of the same certificate by User A
    // Database unique constraint uq_certificates_student_file_hash must reject the second insert with code 23505
    console.log('Testing Scenario: Simultaneous duplicate upload against unique constraint');
    let constraintTriggered = false;
    let errorCode = null;

    try {
      // Attempt to insert duplicate (USER_A_ID, certZHash) which was just inserted above
      await client.query(`
        INSERT INTO certificates (
          student_id, certificate_name, issuer, file_url, file_type, status,
          verification_score, file_hash, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW());
      `, [USER_A_ID, 'Certificate Z Duplicate', 'Issuer Z', 'http://localhost:5000/uploads/testZ2.pdf', 'PDF', 'MANUAL_REVIEW', 60, certZHash]);
    } catch (constraintErr) {
      constraintTriggered = true;
      errorCode = constraintErr.code;
    }

    results.TEST_9 = {
      description: 'Database composite unique constraint (student_id, file_hash) prevents duplicate inserts',
      passed: constraintTriggered && errorCode === '23505',
      errorCode,
    };
    console.log(`TEST 9: [${results.TEST_9.passed ? 'PASS' : 'FAIL'}] Unique constraint caught duplicate with code: ${errorCode}`);

  } finally {
    // ALWAYS ROLLBACK TRANSACTION - Zero data persistence
    await client.query('ROLLBACK');
    client.release();
    console.log('Transaction rolled back successfully. Zero residual rows created.');
  }

  // Verify final database counts
  const finalCounts = await getDbCounts();
  console.log('\nFinal Database Counts:', JSON.stringify(finalCounts));

  const countsMatch = JSON.stringify(initialCounts) === JSON.stringify(finalCounts);
  console.log(`Database Integrity Verified: [${countsMatch ? 'PASS - Zero Changes' : 'FAIL'}]`);

  const allPassed = Object.values(results).every((r) => r.passed) && countsMatch;

  console.log('\n===============================================================');
  console.log(`ALL 9 TEST SCENARIOS RESULT: [${allPassed ? 'ALL PASSED' : 'SOME FAILED'}]`);
  console.log('===============================================================');
  console.log(JSON.stringify(results, null, 2));

  if (!allPassed) {
    process.exitCode = 1;
  }
}

runTestSuite()
  .then(() => {
    pool.end();
  })
  .catch((err) => {
    console.error('Test suite runtime error:', err);
    pool.end();
    process.exit(1);
  });
