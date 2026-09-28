const { parseCertificate } = require('../services/certificateParser');
const { extractCertificateInfo } = require('../services/informationExtractor');
const path = require('path');
const fs = require('fs');

async function testOne() {
  const filePath = path.join(__dirname, '../uploads/cert-1790574528657-4bb69aad.png');
  const buffer = fs.readFileSync(filePath);
  const parsed = await parseCertificate(filePath, 'image/png', buffer);
  console.log('--- CLEAN RAW TEXT ---');
  console.log(parsed.text);
  console.log('--- EXTRACTED INFO ---');
  console.log(JSON.stringify(extractCertificateInfo(parsed.text), null, 2));
}

testOne().catch(console.error);
