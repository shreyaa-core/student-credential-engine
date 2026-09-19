const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { generateToken } = require('../middleware/authMiddleware');

async function testUpload() {
  const token = generateToken({
    id: '62deb8a7-561a-44e5-b544-2c1328ed86e1',
    email: 'student-62deb8a7@university.edu',
    role: 'student',
    name: 'Test Student'
  });

  const filePath = path.join(__dirname, '../uploads/cert-1789803368758-79702e9c.pdf');
  const fileBytes = fs.readFileSync(filePath);
  const blob = new Blob([fileBytes], { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('certificate', blob, 'LetsUpgrade spotify clone react.pdf');
  formData.append('certificate_name', 'REACT');
  formData.append('issuer', 'shreya');

  console.log('Posting certificate to http://localhost:5000/api/certificates/upload...');
  const res = await fetch('http://localhost:5000/api/certificates/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });

  console.log('HTTP Status:', res.status);
  const json = await res.json();
  console.log('Response payload:\n', JSON.stringify(json, null, 2));

  // Query database
  const pool = require('../config/database');
  const certRows = await pool.query('SELECT id, student_id, certificate_name, issuer, status, verification_score, file_hash, raw_text, verification_evidence FROM certificates WHERE file_hash = \'131ef9d2c80ee9b0cbc90c9d6f7a91be1e3d85b9a463108bb6da01dbafd5c212\'');
  console.log('\n--- DATABASE CERTIFICATES ROW ---');
  console.log('Count of certificates matching hash:', certRows.rows.length);
  if (certRows.rows.length > 0) {
    const c = certRows.rows[0];
    console.log('Cert ID:', c.id);
    console.log('Student ID:', c.student_id);
    console.log('Cert Name:', c.certificate_name);
    console.log('Issuer:', c.issuer);
    console.log('Status:', c.status);
    console.log('Score:', c.verification_score);
    console.log('File Hash:', c.file_hash);
    console.log('Evidence keys:', Object.keys(c.verification_evidence || {}));

    const skillRows = await pool.query('SELECT cs.id, cs.certificate_id, cs.skill_id, cs.proficiency_level, s.name as skill_name, s.category FROM certificate_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.certificate_id = $1', [c.id]);
    console.log('\n--- DATABASE CERTIFICATE_SKILLS ROWS ---');
    console.log('Skill count:', skillRows.rows.length);
    console.log(JSON.stringify(skillRows.rows, null, 2));
  }

  process.exit(0);
}

testUpload().catch(console.error);
