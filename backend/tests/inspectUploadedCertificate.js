const path = require('path');
const fs = require('fs');
const { parseCertificate } = require('../services/certificateParser');
const {
  extractCertificateInfo,
  extractCourseName,
  extractIssuer,
  extractCertificateId,
  extractIssueDate,
  extractVerificationUrl,
  extractPurpose,
} = require('../services/informationExtractor');

async function inspect() {
  const uploadDir = path.join(__dirname, '../uploads');
  const files = fs.readdirSync(uploadDir).filter(f => f.startsWith('cert-'));
  console.log('Found upload files:', files);

  for (const filename of files) {
    console.log('\n===============================================================');
    console.log(`INSPECTING: ${filename}`);
    console.log('===============================================================');
    const filePath = path.join(uploadDir, filename);
    const ext = path.extname(filename).toLowerCase();
    const mimeType = ext === '.pdf' ? 'application/pdf' : 'image/png';
    const buffer = fs.readFileSync(filePath);

    try {
      const parsed = await parseCertificate(filePath, mimeType, buffer);
      console.log('--- RAW TEXT ---');
      console.log(parsed.text);
      console.log('--- EXTRACTED FIELDS ---');
      console.log('Title (Course):', extractCourseName(parsed.text));
      console.log('Issuer:', extractIssuer(parsed.text));
      console.log('Certificate ID:', extractCertificateId(parsed.text));
      console.log('Issue Date:', extractIssueDate(parsed.text));
      console.log('Verification URL:', extractVerificationUrl(parsed.text));
      console.log('Purpose:', extractPurpose(parsed.text));
      console.log('Full Extracted Info:', extractCertificateInfo(parsed.text));
    } catch (e) {
      console.error(`Failed to parse ${filename}:`, e.message);
    }
  }
}

inspect();
