/**
 * ==============================================================================
 * Regression Test Suite: Skill Extraction Disambiguation
 * File: backend/tests/skillExtractionRegression.test.js
 * 
 * Verifies that deterministic skill extraction patterns properly distinguish:
 * 1. "Node.js" alone does NOT match "JavaScript" unless explicit JS evidence exists.
 * 2. Standalone "JavaScript", "ECMAScript", and independent "JS" terms DO match "JavaScript".
 * 3. Compound terms with ".js" (Node.js, React.js, Vue.js, Next.js) do not trigger false positive "JavaScript".
 * 4. Dual terms ("JavaScript and Node.js") correctly extract BOTH skills.
 * ==============================================================================
 */

const assert = require('assert');
const { extractCandidateSkills, matchSkillsToTaxonomy } = require('../services/skillAnalysisService');
const { TAXONOMY_RULES } = require('../services/activitySkillMapper');

function testActivityMapping(text) {
  const matched = [];
  for (const rule of TAXONOMY_RULES) {
    for (const pat of rule.patterns) {
      if (pat.regex.test(text)) {
        matched.push(rule.skillName);
        break;
      }
    }
  }
  return matched.sort();
}

function testCertificateMapping(text) {
  const candidates = extractCandidateSkills(text);
  const matched = candidates.map(c => c.name);
  return [...new Set(matched)].sort();
}

async function runRegressionTests() {
  console.log('===============================================================');
  console.log('STARTING SKILL EXTRACTION REGRESSION TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function runCase(name, fn) {
    total++;
    try {
      fn();
      console.log(`PASS [${total}]: ${name}`);
      passed++;
    } catch (err) {
      console.error(`FAIL [${total}]: ${name}`);
      console.error(`       Error: ${err.message}`);
    }
  }

  // MANDATORY REQUIREMENT TEST 1:
  // Text: "Node.js and Express backend development" -> maps to ['Node.js'] without JavaScript
  runCase('Requirement 1: "Node.js and Express backend development" in Certificate Parser maps to Node.js only', () => {
    const text = 'Node.js and Express backend development';
    const skills = testCertificateMapping(text);
    assert.deepStrictEqual(skills, ['Node.js'], `Expected ['Node.js'], got: ${JSON.stringify(skills)}`);
    assert.ok(!skills.includes('JavaScript'), 'Must NOT include JavaScript');
  });

  runCase('Requirement 1b: "Node.js and Express backend development" in Activity Skill Mapper maps to Node.js only', () => {
    const text = 'Node.js and Express backend development';
    const skills = testActivityMapping(text);
    assert.deepStrictEqual(skills, ['Node.js'], `Expected ['Node.js'], got: ${JSON.stringify(skills)}`);
    assert.ok(!skills.includes('JavaScript'), 'Must NOT include JavaScript');
  });

  // MANDATORY REQUIREMENT TEST 2:
  // Text: "JavaScript and Node.js development" -> maps to ['JavaScript', 'Node.js']
  runCase('Requirement 2: "JavaScript and Node.js development" in Certificate Parser maps to both JavaScript and Node.js', () => {
    const text = 'JavaScript and Node.js development';
    const skills = testCertificateMapping(text);
    assert.deepStrictEqual(skills, ['JavaScript', 'Node.js'], `Expected ['JavaScript', 'Node.js'], got: ${JSON.stringify(skills)}`);
  });

  runCase('Requirement 2b: "JavaScript and Node.js development" in Activity Skill Mapper maps to both JavaScript and Node.js', () => {
    const text = 'JavaScript and Node.js development';
    const skills = testActivityMapping(text);
    assert.deepStrictEqual(skills, ['JavaScript', 'Node.js'], `Expected ['JavaScript', 'Node.js'], got: ${JSON.stringify(skills)}`);
  });

  // ROBUSTNESS TESTS:
  runCase('Robustness: Independent "JS" term correctly triggers JavaScript', () => {
    const text = 'Full stack web development using modern JS and SQL';
    const certSkills = testCertificateMapping(text);
    const actSkills = testActivityMapping(text);
    assert.ok(certSkills.includes('JavaScript'), `Cert skills must include JavaScript: ${certSkills}`);
    assert.ok(actSkills.includes('JavaScript'), `Activity skills must include JavaScript: ${actSkills}`);
  });

  runCase('Robustness: "ECMAScript" correctly triggers JavaScript', () => {
    const text = 'Mastering ECMAScript 2024 features';
    const certSkills = testCertificateMapping(text);
    const actSkills = testActivityMapping(text);
    assert.ok(certSkills.includes('JavaScript'), `Cert skills must include JavaScript: ${certSkills}`);
    assert.ok(actSkills.includes('JavaScript'), `Activity skills must include JavaScript: ${actSkills}`);
  });

  runCase('Robustness: "React.js" does NOT trigger JavaScript without independent JS mention', () => {
    const text = 'Frontend development using React.js components';
    const certSkills = testCertificateMapping(text);
    assert.deepStrictEqual(certSkills, ['React'], `Expected ['React'], got: ${JSON.stringify(certSkills)}`);
    assert.ok(!certSkills.includes('JavaScript'), 'React.js must not trigger JavaScript');
  });

  console.log('\n===============================================================');
  console.log(`REGRESSION TEST RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log('===============================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

if (require.main === module) {
  runRegressionTests();
}

module.exports = { runRegressionTests };
