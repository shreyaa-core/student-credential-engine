/**
 * ==============================================================================
 * Comprehensive Test Suite: Activity Logs & Skill Taxonomy Mapping (Step 4)
 * ==============================================================================
 *
 * Covers all 20 required verification criteria:
 * 1.  PostgreSQL `activity_logs` table exists
 * 2.  PostgreSQL `activity_skills` table exists
 * 3.  `activity_logs` table schema (columns, types, constraints)
 * 4.  `activity_skills` table schema (columns, types, constraints)
 * 5.  Authentication enforcement: POST /api/activities without token -> 401
 * 6.  Input validation: POST /api/activities with missing title/description -> 400
 * 7.  Deterministic skill mapping: Python & Pandas -> canonical Python (confidence >= 60)
 * 8.  Multi-skill mapping: Machine Learning & Deep Learning (PyTorch, CNN) -> ML & DL
 * 9.  Database skill mapping: PostgreSQL & SQL queries -> canonical SQL (confidence >= 60)
 * 10. Web skill mapping: React & Node.js -> canonical React & Node.js
 * 11. Taxonomy isolation: Non-canonical skills (Leadership, Public Speaking) are ignored
 * 12. Database taxonomy non-mutation: `skills` table is never altered or added to
 * 13. Student A retrieves activities list via GET /api/activities -> 200 with records
 * 14. Activity payload contains nested skills array with confidence and evidence text
 * 15. Student A retrieves single activity via GET /api/activities/:id -> 200
 * 16. Ownership security: Student B viewing Student A's activity -> 403 Forbidden
 * 17. Update activity: PUT /api/activities/:id updates text and recalculates mapped skills
 * 18. Ownership security: Student B updating or deleting Student A's activity -> 403 Forbidden
 * 19. Delete activity: DELETE /api/activities/:id cascades activity_skills
 * 20. Zero dummy data guarantee: Database counts verified clean, canonical skills intact
 * ==============================================================================
 */

const axios = require('axios');
const pool = require('../config/database');
const { generateToken } = require('../middleware/authMiddleware');

const BASE_URL = 'http://localhost:5000/api/activities';

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

const tokenA = generateToken(USER_A);
const tokenB = generateToken(USER_B);

const headersA = { Authorization: `Bearer ${tokenA}` };
const headersB = { Authorization: `Bearer ${tokenB}` };

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

async function runTests() {
  console.log('==============================================================================');
  console.log('STARTING 20-CRITERIA TEST SUITE: ACTIVITY LOGS & SKILL TAXONOMY MAPPING');
  console.log('==============================================================================\n');

  const baselineCounts = await getDbCounts();
  console.log('Database baseline counts:', baselineCounts);
  console.log('Canonical skills catalog count:', baselineCounts.skills);

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failedTests++;
    }
  }

  try {
    // ------------------------------------------------------------------------
    // CHECK 1: activity_logs table exists
    // ------------------------------------------------------------------------
    console.log('\n[CHECK 1] Verifying activity_logs table exists in PostgreSQL...');
    const tableRes1 = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_logs';"
    );
    assert(tableRes1.rows.length === 1, 'activity_logs table exists in PostgreSQL');

    // ------------------------------------------------------------------------
    // CHECK 2: activity_skills table exists
    // ------------------------------------------------------------------------
    console.log('\n[CHECK 2] Verifying activity_skills table exists in PostgreSQL...');
    const tableRes2 = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_skills';"
    );
    assert(tableRes2.rows.length === 1, 'activity_skills table exists in PostgreSQL');

    // ------------------------------------------------------------------------
    // CHECK 3: activity_logs required columns
    // ------------------------------------------------------------------------
    console.log('\n[CHECK 3] Verifying activity_logs column schema...');
    const colsRes1 = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'activity_logs';"
    );
    const cols1 = colsRes1.rows.map((r) => r.column_name);
    const expectedCols1 = ['id', 'student_id', 'title', 'activity_type', 'organizer', 'description', 'activity_date', 'evidence_url', 'created_at', 'updated_at'];
    const allCols1Present = expectedCols1.every((c) => cols1.includes(c));
    assert(allCols1Present, `activity_logs has all required columns (${expectedCols1.join(', ')})`);

    // ------------------------------------------------------------------------
    // CHECK 4: activity_skills required columns
    // ------------------------------------------------------------------------
    console.log('\n[CHECK 4] Verifying activity_skills column schema...');
    const colsRes2 = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'activity_skills';"
    );
    const cols2 = colsRes2.rows.map((r) => r.column_name);
    const expectedCols2 = ['id', 'activity_id', 'skill_id', 'confidence_score', 'evidence_text', 'created_at'];
    const allCols2Present = expectedCols2.every((c) => cols2.includes(c));
    assert(allCols2Present, `activity_skills has all required columns (${expectedCols2.join(', ')})`);

    // ------------------------------------------------------------------------
    // CHECK 5: Auth required: POST without token -> 401
    // ------------------------------------------------------------------------
    console.log('\n[CHECK 5] Testing unauthenticated POST /api/activities...');
    try {
      await axios.post(BASE_URL, { title: 'Test', activity_type: 'Workshop', description: 'Desc' });
      assert(false, 'Should have failed with 401');
    } catch (err) {
      assert(err.response?.status === 401, `Unauthenticated request correctly rejected with status 401 (got ${err.response?.status})`);
    }

    // ------------------------------------------------------------------------
    // CHECK 6: Input validation: Missing required fields -> 400
    // ------------------------------------------------------------------------
    console.log('\n[CHECK 6] Testing missing required fields (title/description)...');
    try {
      await axios.post(BASE_URL, { organizer: 'ACM' }, { headers: headersA });
      assert(false, 'Should have failed with 400');
    } catch (err) {
      assert(err.response?.status === 400, `Missing required fields rejected with status 400 (got ${err.response?.status})`);
    }

    // ------------------------------------------------------------------------
    // CHECK 7: Skill mapping: Python & Pandas -> canonical Python
    // ------------------------------------------------------------------------
    console.log('\n[CHECK 7] Creating activity mentioning Python and Pandas...');
    const pythonActRes = await axios.post(
      BASE_URL,
      {
        title: 'Python Data Analysis Intensive Bootcamp',
        activity_type: 'Workshop',
        organizer: 'Tech University AI Lab',
        activity_date: '2026-03-10',
        evidence_url: 'https://github.com/student/python-data-bootcamp',
        description: 'Completed 40 hours of hands-on data analysis training using Python and Pandas to clean and process real-world datasets.'
      },
      { headers: headersA }
    );
    assert(pythonActRes.status === 201, 'Python activity created with 201 Created');
    const pythonAct = pythonActRes.data.activity;
    createdActivityIds.push(pythonAct.id);

    const mappedPython = pythonAct.skills.find((s) => s.skill_name === 'Python');
    assert(
      mappedPython && mappedPython.confidence_score >= 60 && mappedPython.evidence_text.length > 0,
      `Mapped to canonical Python with confidence ${mappedPython?.confidence_score}% and evidence "${mappedPython?.evidence_text}"`
    );

    // ------------------------------------------------------------------------
    // CHECK 8: Multi-skill mapping: Machine Learning & Deep Learning
    // ------------------------------------------------------------------------
    console.log('\n[CHECK 8] Creating activity with Machine Learning & Deep Learning (PyTorch, CNN)...');
    const mlDlActRes = await axios.post(
      BASE_URL,
      {
        title: 'Computer Vision & Deep Learning Hackathon 2026',
        activity_type: 'Hackathon',
        organizer: 'National AI Challenge',
        activity_date: '2026-02-15',
        evidence_url: 'https://github.com/student/vision-hackathon',
        description: 'Developed an automated defect detection system using Deep Learning neural networks and PyTorch. Applied Machine Learning classification pipelines for evaluation.'
      },
      { headers: headersA }
    );
    assert(mlDlActRes.status === 201, 'ML/DL activity created with 201 Created');
    const mlDlAct = mlDlActRes.data.activity;
    createdActivityIds.push(mlDlAct.id);

    const hasML = mlDlAct.skills.some((s) => s.skill_name === 'Machine Learning' && s.confidence_score >= 60);
    const hasDL = mlDlAct.skills.some((s) => s.skill_name === 'Deep Learning' && s.confidence_score >= 60);
    assert(hasML && hasDL, `Both Machine Learning and Deep Learning successfully mapped (skills: ${mlDlAct.skills.map((s) => s.skill_name).join(', ')})`);

    // ------------------------------------------------------------------------
    // CHECK 9: Database skill mapping: SQL & PostgreSQL
    // ------------------------------------------------------------------------
    console.log('\n[CHECK 9] Creating activity mentioning SQL and PostgreSQL...');
    const sqlActRes = await axios.post(
      BASE_URL,
      {
        title: 'Database Design & Relational Query Optimization Seminar',
        activity_type: 'Seminar',
        organizer: 'PostgreSQL User Group',
        activity_date: '2026-01-20',
        description: 'Participated in advanced PostgreSQL performance tuning seminar, writing optimized SQL queries and indexing strategies.'
      },
      { headers: headersA }
    );
    assert(sqlActRes.status === 201, 'SQL activity created with 201 Created');
    const sqlAct = sqlActRes.data.activity;
    createdActivityIds.push(sqlAct.id);

    const hasSQL = sqlAct.skills.some((s) => s.skill_name === 'SQL' && s.confidence_score >= 60);
    assert(hasSQL, 'SQL skill accurately mapped with confidence >= 60');

    // ------------------------------------------------------------------------
    // CHECK 10: Web skill mapping: React & Node.js
    // ------------------------------------------------------------------------
    console.log('\n[CHECK 10] Creating activity mentioning React and Node.js...');
    const webActRes = await axios.post(
      BASE_URL,
      {
        title: 'Full Stack Web Project: Student Portal',
        activity_type: 'Project',
        organizer: 'Computer Science Department',
        activity_date: '2026-03-01',
        evidence_url: 'https://github.com/student/portal',
        description: 'Built a responsive frontend using React components and a backend REST API using Node.js.'
      },
      { headers: headersA }
    );
    assert(webActRes.status === 201, 'React/Node.js activity created with 201 Created');
    const webAct = webActRes.data.activity;
    createdActivityIds.push(webAct.id);

    const hasReact = webAct.skills.some((s) => s.skill_name === 'React');
    const hasNode = webAct.skills.some((s) => s.skill_name === 'Node.js');
    assert(hasReact && hasNode, `Both React and Node.js mapped successfully (mapped: ${webAct.skills.map((s) => s.skill_name).join(', ')})`);

    // ------------------------------------------------------------------------
    // CHECK 11: Non-canonical skills ignored
    // ------------------------------------------------------------------------
    console.log('\n[CHECK 11] Creating activity with non-canonical terms (Leadership, Public Speaking)...');
    const nonCanonActRes = await axios.post(
      BASE_URL,
      {
        title: 'Annual Youth Leadership Summit & Public Speaking Workshop',
        activity_type: 'Conference',
        organizer: 'Student Senate',
        activity_date: '2026-02-05',
        description: 'Moderated panel discussions on ethical leadership, team collaboration, and persuasive public speaking techniques.'
      },
      { headers: headersA }
    );
    assert(nonCanonActRes.status === 201, 'Non-technical activity created with 201 Created');
    const nonCanonAct = nonCanonActRes.data.activity;
    createdActivityIds.push(nonCanonAct.id);

    assert(
      nonCanonAct.skills.length === 0,
      `Non-canonical skills ignored: 0 skills mapped (got: ${JSON.stringify(nonCanonAct.skills)})`
    );

    // ------------------------------------------------------------------------
    // CHECK 12: Database taxonomy non-mutation
    // ------------------------------------------------------------------------
    console.log('\n[CHECK 12] Verifying canonical skills table was NOT mutated...');
    const currentSkillsRes = await pool.query('SELECT COUNT(*) as count FROM public.skills;');
    const currentSkillsCount = currentSkillsRes.rows[0].count;
    assert(
      currentSkillsCount === baselineCounts.skills,
      `Canonical skills count remained exactly ${baselineCounts.skills} (current: ${currentSkillsCount})`
    );

    // ------------------------------------------------------------------------
    // CHECK 13: Student A retrieves activities list via GET /api/activities
    // ------------------------------------------------------------------------
    console.log('\n[CHECK 13] Student A retrieves activities list...');
    const listRes = await axios.get(BASE_URL, { headers: headersA });
    assert(listRes.status === 200, 'GET /api/activities returns 200 OK');
    assert(listRes.data.activities.length >= 5, `Student A has ${listRes.data.activities.length} recorded activities`);

    // ------------------------------------------------------------------------
    // CHECK 14: Activity payload contains nested skills array
    // ------------------------------------------------------------------------
    console.log('\n[CHECK 14] Verifying nested skills payload in list response...');
    const firstWithSkills = listRes.data.activities.find((a) => a.skills && a.skills.length > 0);
    const skillItem = firstWithSkills?.skills[0];
    assert(
      skillItem &&
      skillItem.skill_id &&
      skillItem.skill_name &&
      typeof skillItem.confidence_score === 'number' &&
      skillItem.evidence_text,
      `Nested skill has skill_id, skill_name ("${skillItem?.skill_name}"), confidence_score (${skillItem?.confidence_score}%), and evidence_text`
    );

    // ------------------------------------------------------------------------
    // CHECK 15: Student A retrieves specific activity by ID
    // ------------------------------------------------------------------------
    console.log('\n[CHECK 15] Student A retrieves single activity by ID...');
    const singleRes = await axios.get(`${BASE_URL}/${pythonAct.id}`, { headers: headersA });
    assert(singleRes.status === 200, `GET /api/activities/${pythonAct.id} returns 200 OK`);
    assert(singleRes.data.activity.title === pythonAct.title, 'Activity title matches created record');

    // ------------------------------------------------------------------------
    // CHECK 16: Ownership isolation: Student B viewing Student A's activity -> 403
    // ------------------------------------------------------------------------
    console.log("\n[CHECK 16] Testing Student B attempt to view Student A's activity...");
    try {
      await axios.get(`${BASE_URL}/${pythonAct.id}`, { headers: headersB });
      assert(false, 'Should have failed with 403');
    } catch (err) {
      assert(
        err.response?.status === 403,
        `Student B cannot view Student A's activity: rejected with 403 Forbidden (got ${err.response?.status})`
      );
    }

    // ------------------------------------------------------------------------
    // CHECK 17: Update activity & recalculate skills
    // ------------------------------------------------------------------------
    console.log('\n[CHECK 17] Student A updates Python activity to React + Node.js project...');
    const updateRes = await axios.put(
      `${BASE_URL}/${pythonAct.id}`,
      {
        title: 'Full Stack Dashboard Refactoring',
        activity_type: 'Project',
        organizer: 'Open Source Club',
        activity_date: '2026-03-12',
        description: 'Migrated web dashboard to modern React architecture and optimized backend APIs using Node.js.'
      },
      { headers: headersA }
    );
    assert(updateRes.status === 200, 'PUT /api/activities/:id returns 200 OK');
    const updatedSkills = updateRes.data.activity.skills.map((s) => s.skill_name);
    assert(
      !updatedSkills.includes('Python') && updatedSkills.includes('React') && updatedSkills.includes('Node.js'),
      `Skills recalculated dynamically: old Python removed, new [${updatedSkills.join(', ')}] mapped`
    );

    // ------------------------------------------------------------------------
    // CHECK 18: Ownership isolation: Student B updating or deleting Student A's activity
    // ------------------------------------------------------------------------
    console.log("\n[CHECK 18] Testing Student B attempt to modify/delete Student A's activity...");
    try {
      await axios.put(
        `${BASE_URL}/${pythonAct.id}`,
        { title: 'Hacked', activity_type: 'Workshop', description: 'Desc' },
        { headers: headersB }
      );
      assert(false, 'Should have failed update with 403');
    } catch (err) {
      assert(err.response?.status === 403, `Unauthorized update blocked with 403 Forbidden (got ${err.response?.status})`);
    }

    try {
      await axios.delete(`${BASE_URL}/${pythonAct.id}`, { headers: headersB });
      assert(false, 'Should have failed delete with 403');
    } catch (err) {
      assert(err.response?.status === 403, `Unauthorized delete blocked with 403 Forbidden (got ${err.response?.status})`);
    }

    // ------------------------------------------------------------------------
    // CHECK 19: Delete activity & cascade verification
    // ------------------------------------------------------------------------
    console.log('\n[CHECK 19] Student A deletes activity and verifies cascade...');
    const deleteRes = await axios.delete(`${BASE_URL}/${pythonAct.id}`, { headers: headersA });
    assert(deleteRes.status === 200, 'DELETE /api/activities/:id returns 200 OK');

    // Remove pythonAct from createdActivityIds so clean-up doesn't double-delete
    createdActivityIds = createdActivityIds.filter((id) => id !== pythonAct.id);

    // Verify activity_logs record is gone
    const checkLogRes = await pool.query('SELECT id FROM public.activity_logs WHERE id = $1;', [pythonAct.id]);
    assert(checkLogRes.rows.length === 0, 'activity_logs record successfully deleted');

    // Verify activity_skills records cascaded away
    const checkSkillsRes = await pool.query('SELECT id FROM public.activity_skills WHERE activity_id = $1;', [pythonAct.id]);
    assert(checkSkillsRes.rows.length === 0, 'activity_skills junction records automatically cascaded and removed');

    // ------------------------------------------------------------------------
    // CHECK 20: Clean-up and database taxonomy integrity
    // ------------------------------------------------------------------------
    console.log('\n[CHECK 20] Cleaning up remaining test activities and verifying zero leakage...');
    for (const actId of createdActivityIds) {
      await pool.query('DELETE FROM public.activity_logs WHERE id = $1;', [actId]);
    }
    createdActivityIds = [];

    const finalCounts = await getDbCounts();
    console.log('Database final counts:', finalCounts);

    const cleanSuccess =
      finalCounts.profiles === baselineCounts.profiles &&
      finalCounts.certificates === baselineCounts.certificates &&
      finalCounts.skills === baselineCounts.skills &&
      finalCounts.activity_logs === baselineCounts.activity_logs &&
      finalCounts.activity_skills === baselineCounts.activity_skills;

    assert(
      cleanSuccess,
      `Zero dummy data left: activity_logs=${finalCounts.activity_logs}, skills=${finalCounts.skills} (canonical count unchanged)`
    );

  } catch (unexpectedErr) {
    console.error('Unexpected test error:', unexpectedErr);
    failedTests++;
  } finally {
    // Failsafe clean-up
    if (createdActivityIds.length > 0) {
      console.log('Failsafe clean-up of created test activities...');
      for (const actId of createdActivityIds) {
        try {
          await pool.query('DELETE FROM public.activity_logs WHERE id = $1;', [actId]);
        } catch (e) {}
      }
    }
    await pool.end();
  }

  console.log('\n==============================================================================');
  console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL 20 CHECKS)`);
  console.log('==============================================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
