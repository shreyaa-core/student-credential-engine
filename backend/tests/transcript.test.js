/**
 * ==============================================================================
 * Comprehensive Test Suite: Co-Curricular Transcript Builder (Step 6)
 * Covers all 30 required verification criteria
 * ==============================================================================
 */

const axios = require('axios');
const pool = require('../config/database');
const { generateToken } = require('../middleware/authMiddleware');
const pdfModule = require('pdf-parse');

async function extractPdfText(dataBuffer) {
  if (pdfModule.PDFParse) {
    const parser = new pdfModule.PDFParse({ data: dataBuffer });
    const result = await parser.getText();
    return result.text || '';
  }
  if (typeof pdfModule === 'function') {
    const result = await pdfModule(dataBuffer);
    return result.text || '';
  }
  return dataBuffer.toString('latin1');
}

const BASE_URL = 'http://localhost:5000/api/transcript';

// Authenticated test users from database profiles
const USER_A = {
  id: '2d56ab4e-ce06-47b1-afc4-ec0f341a4b90',
  email: 'poojadas@gmail.com',
  name: 'Pooja Das',
  role: 'issuer',
};

const USER_B = {
  id: '043258e2-4938-43e1-93c2-52ca5d7600e0',
  email: 'shreya18das@gmail.com',
  name: 'Shreya Das',
  role: 'issuer',
};

const tokenA = generateToken(USER_A);
const tokenB = generateToken(USER_B);

const headersA = { Authorization: `Bearer ${tokenA}` };
const headersB = { Authorization: `Bearer ${tokenB}` };

let createdCertIds = [];
let createdBadgeIds = [];
let createdActivityIds = [];

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
  if (createdActivityIds.length > 0) {
    await pool.query('DELETE FROM public.activity_skills WHERE activity_id = ANY($1::uuid[])', [createdActivityIds]);
    await pool.query('DELETE FROM public.activity_logs WHERE id = ANY($1::uuid[])', [createdActivityIds]);
  }
}

async function runTests() {
  console.log('==============================================================================');
  console.log('STARTING 30-CRITERIA TEST SUITE: CO-CURRICULAR TRANSCRIPT BUILDER (STEP 6)');
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
    // Test 1: Unauthenticated transcript request returns 401
    // --------------------------------------------------------------------------
    console.log('\n--- 1. Authentication & Security Enforcement ---');
    try {
      await axios.get(`${BASE_URL}/me`);
      assert(false, 'Expected 401 for unauthenticated request');
    } catch (err) {
      assert(err.response?.status === 401, 'Unauthenticated GET /api/transcript/me rejected with HTTP 401');
    }

    // --------------------------------------------------------------------------
    // Test 2: Authenticated user can request own transcript
    // --------------------------------------------------------------------------
    const resA = await axios.get(`${BASE_URL}/me`, { headers: headersA });
    assert(resA.status === 200, 'Authenticated user can request own transcript (200 OK)');
    assert(resA.data?.success === true, 'Response contains success: true');
    assert(resA.data?.data?.student?.id === USER_A.id, 'Transcript matches authenticated student ID');

    // --------------------------------------------------------------------------
    // Test 3: Transcript does not trust client-supplied student_id
    // --------------------------------------------------------------------------
    const spoofRes = await axios.get(`${BASE_URL}/me?student_id=${USER_B.id}`, { headers: headersA });
    assert(
      spoofRes.data?.data?.student?.id === USER_A.id,
      'Transcript ignores client-supplied student_id query parameter and scopes strictly to req.user.id'
    );

    // --------------------------------------------------------------------------
    // Setup Test Data for Certificate Status Filtering
    // --------------------------------------------------------------------------
    console.log('\n--- 2. Certificate Status Filtering Rules ---');

    // Canonical skills
    const pySkillRes = await pool.query(`SELECT id, name FROM public.skills WHERE name ILIKE '%Python%' LIMIT 1`);
    const sqlSkillRes = await pool.query(`SELECT id, name FROM public.skills WHERE name ILIKE '%SQL%' LIMIT 1`);
    const reactSkillRes = await pool.query(`SELECT id, name FROM public.skills WHERE name ILIKE '%React%' LIMIT 1`);
    const pythonSkillId = pySkillRes.rows[0]?.id;
    const sqlSkillId = sqlSkillRes.rows[0]?.id;
    const dlSkillRes = await pool.query(`SELECT id, name FROM public.skills WHERE name ILIKE '%Deep Learning%' LIMIT 1`);
    const deepLearningSkillId = dlSkillRes.rows[0]?.id;

    // A. VERIFIED Certificate for User A with specific issue_date
    const certVerifiedRes = await pool.query(
      `INSERT INTO public.certificates 
         (student_id, certificate_name, issuer, issue_date, file_hash, file_url, status)
       VALUES 
         ($1, $2, $3, '2025-06-15', $4, $5, 'VERIFIED')
       RETURNING id`,
      [USER_A.id, 'Verified Machine Learning Masterclass', 'DeepLearning.AI', `hash_ver_${Date.now()}`, 'http://example.com/ml.pdf']
    );
    const verifiedCertId = certVerifiedRes.rows[0].id;
    createdCertIds.push(verifiedCertId);
    if (pythonSkillId) {
      await pool.query(
        `INSERT INTO public.certificate_skills (certificate_id, skill_id, proficiency_level) VALUES ($1, $2, 'Advanced')`,
        [verifiedCertId, pythonSkillId]
      );
    }

    // B. APPROVED Certificate for User A (Issue date null to test date handling)
    const certApprovedRes = await pool.query(
      `INSERT INTO public.certificates 
         (student_id, certificate_name, issuer, issue_date, file_hash, file_url, status)
       VALUES 
         ($1, $2, $3, NULL, $4, $5, 'APPROVED')
       RETURNING id`,
      [USER_A.id, 'Approved Database Engineering', 'PostgreSQL Org', `hash_app_${Date.now()}`, 'http://example.com/db.pdf']
    );
    const approvedCertId = certApprovedRes.rows[0].id;
    createdCertIds.push(approvedCertId);
    if (sqlSkillId) {
      await pool.query(
        `INSERT INTO public.certificate_skills (certificate_id, skill_id, proficiency_level) VALUES ($1, $2, 'Intermediate')`,
        [approvedCertId, sqlSkillId]
      );
    }

    // C. Non-verified statuses that MUST be excluded
    const nonVerifiedStatuses = [
      'PROCESSING',
      'PENDING',
      'MANUAL_REVIEW',
      'VERIFICATION_TIMEOUT',
      'SUSPICIOUS',
      'REJECTED',
    ];

    let rejectedCertId = null;
    for (const st of nonVerifiedStatuses) {
      const cRes = await pool.query(
        `INSERT INTO public.certificates 
           (student_id, certificate_name, issuer, issue_date, file_hash, file_url, status)
         VALUES 
           ($1, $2, $3, NOW(), $4, $5, $6)
         RETURNING id`,
        [USER_A.id, `Test Cert ${st}`, 'Excluded Issuer', `hash_${st.toLowerCase()}_${Date.now()}`, 'http://example.com/test.pdf', st]
      );
      const cId = cRes.rows[0].id;
      createdCertIds.push(cId);
      if (st === 'REJECTED') {
        rejectedCertId = cId;
        // Map Deep Learning skill to rejected cert
        if (deepLearningSkillId) {
          await pool.query(
            `INSERT INTO public.certificate_skills (certificate_id, skill_id, proficiency_level) VALUES ($1, $2, 'Beginner')`,
            [rejectedCertId, deepLearningSkillId]
          );
        }
      }
    }

    // Fetch updated transcript for User A
    const transcriptAfterCerts = (await axios.get(`${BASE_URL}/me`, { headers: headersA })).data.data;
    const certNames = transcriptAfterCerts.certificates.map((c) => c.certificate_name);

    // --------------------------------------------------------------------------
    // Tests 4 - 11: Verification of Status Filtering
    // --------------------------------------------------------------------------
    assert(certNames.includes('Verified Machine Learning Masterclass'), 'VERIFIED certificate appears in Verified Credentials');
    assert(certNames.includes('Approved Database Engineering'), 'APPROVED certificate appears in Verified Credentials');
    assert(!certNames.includes('Test Cert PROCESSING'), 'PROCESSING certificate does NOT appear');
    assert(!certNames.includes('Test Cert PENDING'), 'PENDING certificate does NOT appear');
    assert(!certNames.includes('Test Cert MANUAL_REVIEW'), 'MANUAL_REVIEW certificate does NOT appear');
    assert(!certNames.includes('Test Cert VERIFICATION_TIMEOUT'), 'VERIFICATION_TIMEOUT certificate does NOT appear');
    assert(!certNames.includes('Test Cert SUSPICIOUS'), 'SUSPICIOUS certificate does NOT appear');
    assert(!certNames.includes('Test Cert REJECTED'), 'REJECTED certificate does NOT appear');

    // --------------------------------------------------------------------------
    // Tests 12 - 13: Skills from Verified vs Rejected Certificates
    // --------------------------------------------------------------------------
    console.log('\n--- 3. Certificate Skill Provenance ---');
    const credSkillNames = transcriptAfterCerts.skills.credential_based.map((s) => s.name);
    assert(credSkillNames.includes('Python'), 'Certificate skills from VERIFIED certificate appear in credential_based skills');
    assert(credSkillNames.includes('SQL'), 'Certificate skills from APPROVED certificate appear in credential_based skills');
    assert(!credSkillNames.includes('Deep Learning'), 'Skills from REJECTED certificate do NOT appear as verified credential skills');

    // --------------------------------------------------------------------------
    // Tests 14 - 15: Issue Date vs Upload Date Handling
    // --------------------------------------------------------------------------
    console.log('\n--- 4. Certificate Date Handling ---');
    const mlCert = transcriptAfterCerts.certificates.find((c) => c.certificate_name === 'Verified Machine Learning Masterclass');
    const dbCert = transcriptAfterCerts.certificates.find((c) => c.certificate_name === 'Approved Database Engineering');

    assert(mlCert.issue_date === '2025-06-15', 'issue_date is used when available');
    assert(dbCert.issue_date === null, 'issue_date is strictly null when missing in database');
    assert(dbCert.uploaded_at !== null, 'created_at is provided clearly as uploaded_at without mislabeling');

    // --------------------------------------------------------------------------
    // Setup Activities for User A & User B
    // --------------------------------------------------------------------------
    console.log('\n--- 5. Co-Curricular Activities & Skills ---');
    // User A Activity mentioning Python and Hackathon
    const actARes = await pool.query(
      `INSERT INTO public.activity_logs 
         (student_id, title, activity_type, organizer, description, activity_date, evidence_url)
       VALUES 
         ($1, $2, $3, $4, $5, '2025-08-20', $6)
       RETURNING id`,
      [USER_A.id, 'National AI Innovation Hackathon', 'Hackathon', 'IEEE Student Branch', 'Built an autonomous diagnostic agent using Python', 'http://example.com/hack.pdf']
    );
    const actAId = actARes.rows[0].id;
    createdActivityIds.push(actAId);

    if (pythonSkillId) {
      await pool.query(
        `INSERT INTO public.activity_skills (activity_id, skill_id, confidence_score, evidence_text)
         VALUES ($1, $2, 90, 'autonomous diagnostic agent using Python')`,
        [actAId, pythonSkillId]
      );
    }

    // User B Activity (isolation test)
    const actBRes = await pool.query(
      `INSERT INTO public.activity_logs 
         (student_id, title, activity_type, organizer, description, activity_date, evidence_url)
       VALUES 
         ($1, $2, $3, $4, $5, '2025-09-01', $6)
       RETURNING id`,
      [USER_B.id, 'User B Web Dev Workshop', 'Workshop', 'Tech Club', 'Frontend workshop', 'http://example.com/b.pdf']
    );
    const actBId = actBRes.rows[0].id;
    createdActivityIds.push(actBId);

    // User B Certificate (isolation test)
    const certBRes = await pool.query(
      `INSERT INTO public.certificates 
         (student_id, certificate_name, issuer, issue_date, file_hash, file_url, status)
       VALUES 
         ($1, $2, $3, NOW(), $4, $5, 'VERIFIED')
       RETURNING id`,
      [USER_B.id, 'User B Secret Certificate', 'MIT', `hash_userb_${Date.now()}`, 'http://example.com/b_cert.pdf']
    );
    createdCertIds.push(certBRes.rows[0].id);

    const transcriptAfterActs = (await axios.get(`${BASE_URL}/me`, { headers: headersA })).data.data;
    const actTitles = transcriptAfterActs.activities.map((a) => a.title);

    // --------------------------------------------------------------------------
    // Tests 16 - 20: Activities, Activity Skills & Cross-User Isolation
    // --------------------------------------------------------------------------
    assert(actTitles.includes('National AI Innovation Hackathon'), 'Student activities appear in Co-Curricular Activities');

    const actSkillNames = transcriptAfterActs.skills.activity_based.map((s) => s.name);
    assert(actSkillNames.includes('Python'), 'Activity skills appear as activity-based skills');

    const pyUnified = transcriptAfterActs.skills.unified.find((s) => s.name === 'Python');
    assert(
      pyUnified && pyUnified.sources.includes('Verified Certificate') && pyUnified.sources.includes('Activity'),
      'Activity skills are distinguishable and properly combined with credential-based skills (Certificate + Activity)'
    );

    assert(!actTitles.includes('User B Web Dev Workshop'), "Another user's activities do NOT appear in Student A's transcript");
    const certTitlesA = transcriptAfterActs.certificates.map((c) => c.certificate_name);
    assert(!certTitlesA.includes('User B Secret Certificate'), "Another user's certificates do NOT appear in Student A's transcript");

    // --------------------------------------------------------------------------
    // Badges & Revocation Behavior
    // --------------------------------------------------------------------------
    console.log('\n--- 6. Digital Badges & Revocation Filtering ---');
    // Active badge linked to verifiedCertId
    const badgeActiveRes = await pool.query(
      `INSERT INTO public.badges 
         (student_id, certificate_id, name, credential_id, criteria, issued_at)
       VALUES 
         ($1, $2, $3, $4, $5, NOW())
       RETURNING id, credential_id`,
      [USER_A.id, verifiedCertId, 'Machine Learning Master Badge', '11111111-2222-4333-8444-555555555555', 'Verified ML competence']
    );
    createdBadgeIds.push(badgeActiveRes.rows[0].id);

    // Revoked/Inactive badge linked to rejectedCertId
    const badgeRevokedRes = await pool.query(
      `INSERT INTO public.badges 
         (student_id, certificate_id, name, credential_id, criteria, issued_at)
       VALUES 
         ($1, $2, $3, $4, $5, NOW())
       RETURNING id, credential_id`,
      [USER_A.id, rejectedCertId, 'Revoked React Badge', '99999999-8888-4777-8666-555555555555', 'Revoked competence']
    );
    createdBadgeIds.push(badgeRevokedRes.rows[0].id);

    const transcriptAfterBadges = (await axios.get(`${BASE_URL}/me`, { headers: headersA })).data.data;
    const badgeNames = transcriptAfterBadges.badges.map((b) => b.name);

    // --------------------------------------------------------------------------
    // Tests 21 - 22: Badge Inclusion and Revocation Filtering
    // --------------------------------------------------------------------------
    assert(badgeNames.includes('Machine Learning Master Badge'), 'Active badge appears in Digital Micro-Credentials');
    assert(!badgeNames.includes('Revoked React Badge'), 'Badge linked to REJECTED source certificate is not presented as currently valid');

    // --------------------------------------------------------------------------
    // Tests 23 - 24: Summary Counts Integrity & No Double Counting
    // --------------------------------------------------------------------------
    const summaryData = transcriptAfterBadges.summary;
    assert(summaryData.verified_certificates === 3, `Verified certificate count is accurate (expected 3, got ${summaryData.verified_certificates})`);
    assert(summaryData.activities === 1, `Recorded activity count is accurate (expected 1, got ${summaryData.activities})`);
    const expectedBadgesCount = parseInt(baselineCounts.badges || '0', 10) + 1;
    assert(summaryData.digital_badges === expectedBadgesCount, `Digital badge count excludes revoked badges (expected ${expectedBadgesCount}, got ${summaryData.digital_badges})`);

    const unifiedTotal = transcriptAfterBadges.skills.unified.length;
    assert(
      summaryData.total_unique_skills === unifiedTotal && summaryData.total_unique_skills === 3,
      `Distinct skills are not double-counted (Python is in both cert & act, total unique is 3: Python, SQL, React)`
    );

    // --------------------------------------------------------------------------
    // Tests 25 - 29: PDF Generation & Verification
    // --------------------------------------------------------------------------
    console.log('\n--- 8. PDF Generation & Content Verification ---');
    try {
      await axios.get(`${BASE_URL}/me/pdf`);
      assert(false, 'Expected 401 for unauthenticated PDF request');
    } catch (err) {
      assert(err.response?.status === 401, 'GET /api/transcript/me/pdf requires authentication (401)');
    }

    const pdfRes = await axios.get(`${BASE_URL}/me/pdf`, {
      headers: headersA,
      responseType: 'arraybuffer',
    });

    assert(pdfRes.status === 200, 'PDF generation succeeds for valid student transcript (200 OK)');
    assert(pdfRes.headers['content-type'] === 'application/pdf', 'Response header is application/pdf');

    // Parse generated PDF text
    const pdfText = await extractPdfText(Buffer.from(pdfRes.data));

    assert(pdfText.includes('Verified Machine Learning Masterclass'), 'PDF contains verified certificate title');
    assert(!pdfText.includes('Test Cert REJECTED'), 'PDF does not contain rejected certificate title');
    assert(pdfText.includes('National AI Innovation Hackathon'), 'PDF contains recorded co-curricular activity');

  } catch (err) {
    console.error('\nFatal test execution error:', err.message);
    if (err.response?.data) console.error('Response data:', err.response.data);
    failed++;
  } finally {
    // --------------------------------------------------------------------------
    // Test 30: Cleanup all test fixtures & check baseline counts
    // --------------------------------------------------------------------------
    console.log('\n--- 9. Cleanup & Zero Dummy Data Guarantee ---');
    await cleanupTestData();

    const endCounts = await getDbCounts();
    console.log('Database end counts:', endCounts);

    const countsMatch = JSON.stringify(baselineCounts) === JSON.stringify(endCounts);
    assert(countsMatch, 'Test fixtures are completely cleaned up and database baseline counts match (zero leaked data)');

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
