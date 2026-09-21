/**
 * ==============================================================================
 * Database Schema Validation Script
 * File: backend/tests/validateDatabaseSchema.js
 *
 * READ-ONLY verification of PostgreSQL schema consistency:
 * 1. profiles table exists
 * 2. certificates table exists
 * 3. skills table exists
 * 4. certificate_skills table exists
 * 5. verification_logs table exists
 * 6. badges table exists
 * 7. all required profile columns exist
 * 8. all required certificate columns exist
 * 9. certificates.file_hash index exists
 * 10. skills table contains the 7 canonical skills
 *
 * GUARANTEE: Read-only metadata inspection. Does not modify, insert, or delete data.
 * ==============================================================================
 */

const pool = require('../config/database');

const REQUIRED_TABLES = [
  'profiles',
  'certificates',
  'skills',
  'certificate_skills',
  'verification_logs',
  'badges',
];

const REQUIRED_PROFILE_COLUMNS = [
  'id',
  'full_name',
  'email',
  'password_hash',
  'role',
  'institution',
  'bio',
  'last_qualification',
  'profile_photo_url',
  'created_at',
];

const REQUIRED_CERTIFICATE_COLUMNS = [
  'id',
  'student_id',
  'certificate_name',
  'issuer',
  'file_url',
  'file_type',
  'status',
  'verification_score',
  'admin_notes',
  'file_hash',
  'raw_text',
  'certificate_id',
  'issue_date',
  'verification_url',
  'verification_evidence',
  'created_at',
];

const CANONICAL_SKILLS = [
  { name: 'Python', category: 'Programming' },
  { name: 'JavaScript', category: 'Programming' },
  { name: 'React', category: 'Web Development' },
  { name: 'Node.js', category: 'Web Development' },
  { name: 'SQL', category: 'Database' },
  { name: 'Machine Learning', category: 'Artificial Intelligence' },
  { name: 'Deep Learning', category: 'Artificial Intelligence' },
];

async function validateSchema() {
  console.log('===============================================================');
  console.log('STARTING DATABASE SCHEMA CONSISTENCY VALIDATION');
  console.log('===============================================================\n');

  const report = [];
  let allChecksPassed = true;

  function recordCheck(number, description, passed, details = null) {
    if (!passed) allChecksPassed = false;
    report.push({
      check: `CHECK ${number}`,
      description,
      status: passed ? 'PASS' : 'FAIL',
      details,
    });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] CHECK ${number}: ${description}`);
    if (details) {
      console.log(`       Details: ${typeof details === 'object' ? JSON.stringify(details) : details}`);
    }
  }

  try {
    // --------------------------------------------------------------------------
    // Query Existing Tables
    // --------------------------------------------------------------------------
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    const existingTables = new Set(tablesRes.rows.map((r) => r.table_name));

    // Checks 1 to 6: Table existence
    recordCheck(1, "Table 'profiles' exists", existingTables.has('profiles'));
    recordCheck(2, "Table 'certificates' exists", existingTables.has('certificates'));
    recordCheck(3, "Table 'skills' exists", existingTables.has('skills'));
    recordCheck(4, "Table 'certificate_skills' exists", existingTables.has('certificate_skills'));
    recordCheck(5, "Table 'verification_logs' exists", existingTables.has('verification_logs'));
    recordCheck(6, "Table 'badges' exists", existingTables.has('badges'));

    // --------------------------------------------------------------------------
    // Check 7: Profiles columns
    // --------------------------------------------------------------------------
    const profileColsRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'profiles';
    `);
    const existingProfileCols = new Set(profileColsRes.rows.map((r) => r.column_name));
    const missingProfileCols = REQUIRED_PROFILE_COLUMNS.filter((col) => !existingProfileCols.has(col));
    const profilesPassed = missingProfileCols.length === 0;

    recordCheck(
      7,
      'All required profiles columns exist',
      profilesPassed,
      profilesPassed
        ? `All ${REQUIRED_PROFILE_COLUMNS.length} columns verified`
        : { missing: missingProfileCols }
    );

    // --------------------------------------------------------------------------
    // Check 8: Certificates columns
    // --------------------------------------------------------------------------
    const certColsRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'certificates';
    `);
    const existingCertCols = new Set(certColsRes.rows.map((r) => r.column_name));
    const missingCertCols = REQUIRED_CERTIFICATE_COLUMNS.filter((col) => !existingCertCols.has(col));
    const certsPassed = missingCertCols.length === 0;

    recordCheck(
      8,
      'All required certificates columns exist',
      certsPassed,
      certsPassed
        ? `All ${REQUIRED_CERTIFICATE_COLUMNS.length} columns verified`
        : { missing: missingCertCols }
    );

    // --------------------------------------------------------------------------
    // Check 9: certificates.file_hash index exists
    // --------------------------------------------------------------------------
    const indexRes = await pool.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename = 'certificates';
    `);
    const hasFileHashIndex = indexRes.rows.some(
      (idx) =>
        idx.indexname === 'idx_certificates_file_hash' ||
        (idx.indexdef && idx.indexdef.includes('(file_hash)'))
    );

    recordCheck(
      9,
      "Index on 'certificates.file_hash' exists",
      hasFileHashIndex,
      hasFileHashIndex ? 'Index verified on file_hash' : 'No index found covering file_hash'
    );

    // --------------------------------------------------------------------------
    // Check 10: Skills table contains the 7 canonical skills
    // --------------------------------------------------------------------------
    const skillsRes = await pool.query(`
      SELECT name, category 
      FROM skills 
      ORDER BY name ASC;
    `);
    const existingSkillsMap = new Map(skillsRes.rows.map((s) => [s.name, s.category]));

    const missingSkills = [];
    const mismatchedCategories = [];

    for (const expected of CANONICAL_SKILLS) {
      if (!existingSkillsMap.has(expected.name)) {
        missingSkills.push(expected.name);
      } else {
        const actualCat = existingSkillsMap.get(expected.name);
        if (actualCat !== expected.category) {
          mismatchedCategories.push({
            skill: expected.name,
            expected: expected.category,
            actual: actualCat,
          });
        }
      }
    }

    const skillsCheckPassed = missingSkills.length === 0 && mismatchedCategories.length === 0;

    recordCheck(
      10,
      'Skills table contains the 7 canonical skills',
      skillsCheckPassed,
      skillsCheckPassed
        ? `All 7 canonical skills present: ${CANONICAL_SKILLS.map((s) => `${s.name} (${s.category})`).join(', ')}`
        : { missing: missingSkills, mismatchedCategories }
    );

    // --------------------------------------------------------------------------
    // Check 11: Table 'activity_logs' exists
    // --------------------------------------------------------------------------
    recordCheck(11, "Table 'activity_logs' exists", existingTables.has('activity_logs'));

    // --------------------------------------------------------------------------
    // Check 12: Table 'activity_skills' exists
    // --------------------------------------------------------------------------
    recordCheck(12, "Table 'activity_skills' exists", existingTables.has('activity_skills'));

    // --------------------------------------------------------------------------
    // Check 13: All required activity_logs columns exist
    // --------------------------------------------------------------------------
    const activityColsRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'activity_logs';
    `);
    const existingActivityCols = new Set(activityColsRes.rows.map((r) => r.column_name));
    const REQUIRED_ACTIVITY_COLUMNS = [
      'id',
      'student_id',
      'title',
      'activity_type',
      'organizer',
      'description',
      'activity_date',
      'evidence_url',
      'created_at',
      'updated_at',
    ];
    const missingActivityCols = REQUIRED_ACTIVITY_COLUMNS.filter((col) => !existingActivityCols.has(col));
    const activityPassed = missingActivityCols.length === 0;

    recordCheck(
      13,
      'All required activity_logs columns exist',
      activityPassed,
      activityPassed
        ? `All ${REQUIRED_ACTIVITY_COLUMNS.length} columns verified`
        : { missing: missingActivityCols }
    );

    // --------------------------------------------------------------------------
    // Check 14: All required activity_skills columns exist
    // --------------------------------------------------------------------------
    const activitySkillColsRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'activity_skills';
    `);
    const existingActSkillCols = new Set(activitySkillColsRes.rows.map((r) => r.column_name));
    const REQUIRED_ACT_SKILL_COLUMNS = [
      'id',
      'activity_id',
      'skill_id',
      'confidence_score',
      'evidence_text',
      'created_at',
    ];
    const missingActSkillCols = REQUIRED_ACT_SKILL_COLUMNS.filter((col) => !existingActSkillCols.has(col));
    const actSkillPassed = missingActSkillCols.length === 0;

    recordCheck(
      14,
      'All required activity_skills columns exist',
      actSkillPassed,
      actSkillPassed
        ? `All ${REQUIRED_ACT_SKILL_COLUMNS.length} columns verified`
        : { missing: missingActSkillCols }
    );

    // --------------------------------------------------------------------------
    // Check 15: Required activity indexes exist
    // --------------------------------------------------------------------------
    const actIndexRes = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename IN ('activity_logs', 'activity_skills');
    `);
    const existingActIndexes = new Set(actIndexRes.rows.map((r) => r.indexname));
    const hasStudentIdIdx = existingActIndexes.has('idx_activity_logs_student_id');
    const hasActivityIdIdx = existingActIndexes.has('idx_activity_skills_activity_id');
    const hasSkillIdIdx = existingActIndexes.has('idx_activity_skills_skill_id');
    const indexesPassed = hasStudentIdIdx && hasActivityIdIdx && hasSkillIdIdx;

    recordCheck(
      15,
      'Required activity_logs and activity_skills indexes exist',
      indexesPassed,
      indexesPassed
        ? 'All required activity indexes verified'
        : { hasStudentIdIdx, hasActivityIdIdx, hasSkillIdIdx }
    );

    console.log('\n===============================================================');
    console.log(`VALIDATION SUMMARY: [${allChecksPassed ? 'ALL 15 CHECKS PASSED' : 'SOME CHECKS FAILED'}]`);
    console.log('===============================================================');

    return { allChecksPassed, report };
  } catch (err) {
    console.error('Fatal error during schema validation:', err);
    return { allChecksPassed: false, error: err.message };
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  validateSchema()
    .then(({ allChecksPassed }) => {
      process.exit(allChecksPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Validation script execution failed:', err);
      process.exit(1);
    });
}

module.exports = { validateSchema };
