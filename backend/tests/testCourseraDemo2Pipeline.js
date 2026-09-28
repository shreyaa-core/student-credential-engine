const fs = require('fs');
const path = require('path');
const { parseCertificate } = require('../services/certificateParser');
const { extractCertificateInfo } = require('../services/informationExtractor');
const { extractMetadataWithGemini } = require('../services/aiCertificateExtractor');

async function test() {
  const filePath = path.join(__dirname, '../../sample-certificates/coursera demo 2.jpg');
  console.log('Testing file:', filePath);
  const buffer = fs.readFileSync(filePath);

  console.log('\n--- 1. OCR EXECUTION ---');
  const ocrResult = await parseCertificate(filePath, 'image/jpeg', buffer);
  console.log('OCR Method:', ocrResult.method);
  console.log('OCR Raw Text:\n', ocrResult.text);

  console.log('\n--- 2. DETERMINISTIC EXTRACTION ---');
  const detInfo = extractCertificateInfo(ocrResult.text);
  console.log(JSON.stringify(detInfo, null, 2));

  console.log('\n--- 3. GEMINI FALLBACK EXTRACTION ---');
  let aiInfo = null;
  try {
    aiInfo = await extractMetadataWithGemini(ocrResult.text);
    console.log('Gemini Result:', JSON.stringify(aiInfo, null, 2));
  } catch (e) {
    console.log('Gemini error/unavailable:', e.message);
  }

  console.log('\n--- 4. MERGED RESULT (Deterministic Priority + AI Fallback) ---');
  const merged = {
    certificate_name: detInfo.certificate_name || aiInfo?.certificate_name || null,
    issuer: detInfo.issuer || aiInfo?.issuer || null,
    certificate_id: detInfo.certificate_id || aiInfo?.certificate_id || null,
    issue_date: detInfo.issue_date || aiInfo?.issue_date || null,
    verification_url: detInfo.verification_url || aiInfo?.verification_url || null,
    purpose: detInfo.purpose || aiInfo?.purpose || null,
  };
  console.log(JSON.stringify(merged, null, 2));
}

test().catch(console.error);
