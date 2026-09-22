// ==============================================================================
// Generate 20 Acceptance Test Certificate Fixtures
// ==============================================================================

const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { createCanvas } = require('@napi-rs/canvas');

const OUTPUT_DIR = path.resolve(__dirname, '../../sample-certificates/acceptance');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Helper to create a standard text-based PDF certificate
 */
async function createTextPdf({
  filename,
  title,
  studentName,
  courseName,
  issuer,
  certificateId,
  issueDate,
  verificationUrl,
  extraText = '',
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 400]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Background border
  page.drawRectangle({
    x: 20,
    y: 20,
    width: 560,
    height: 360,
    borderColor: rgb(0.2, 0.3, 0.5),
    borderWidth: 2,
  });

  let y = 340;
  // Header
  page.drawText(title || 'Certificate of Completion', {
    x: 40,
    y,
    size: 20,
    font: fontBold,
    color: rgb(0.1, 0.2, 0.4),
  });

  y -= 40;
  // Recipient
  page.drawText(`This certifies that ${studentName} has successfully completed the course`, {
    x: 40,
    y,
    size: 12,
    font: font,
    color: rgb(0.2, 0.2, 0.2),
  });

  y -= 30;
  // Course Title
  page.drawText(courseName, {
    x: 40,
    y,
    size: 16,
    font: fontBold,
    color: rgb(0.05, 0.4, 0.2),
  });

  y -= 30;
  if (issuer) {
    page.drawText(`Issued by ${issuer}`, {
      x: 40,
      y,
      size: 12,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  y -= 25;
  if (issueDate) {
    page.drawText(`Issued on: ${issueDate}`, {
      x: 40,
      y,
      size: 11,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  y -= 25;
  if (certificateId) {
    page.drawText(`Certificate ID: ${certificateId}`, {
      x: 40,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
  }

  y -= 25;
  if (verificationUrl) {
    page.drawText(`Verification URL: ${verificationUrl}`, {
      x: 40,
      y,
      size: 10,
      font: font,
      color: rgb(0.1, 0.3, 0.7),
    });
  }

  y -= 30;
  if (extraText) {
    page.drawText(extraText, {
      x: 40,
      y,
      size: 10,
      font: font,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  const pdfBytes = await pdfDoc.save();
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, pdfBytes);
  console.log(`[GENERATED PDF] ${filename} (${pdfBytes.length} bytes)`);
}

/**
 * Helper to render an image certificate on Canvas and return PNG buffer
 */
function renderCertificateToCanvasPng({
  title,
  studentName,
  courseName,
  issuer,
  certificateId,
  issueDate,
  verificationUrl,
  extraText = '',
}) {
  const canvas = createCanvas(800, 600);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, 800, 600);

  // Border
  ctx.strokeStyle = '#2b4c7e';
  ctx.lineWidth = 10;
  ctx.strokeRect(20, 20, 760, 560);

  // Title
  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 32px Arial';
  ctx.fillText(title || 'Certificate of Completion', 60, 100);

  // Body
  ctx.fillStyle = '#333333';
  ctx.font = '20px Arial';
  ctx.fillText(`This is to certify that ${studentName}`, 60, 180);
  ctx.fillText('has successfully completed the course', 60, 220);

  // Course Name
  ctx.fillStyle = '#0f766e';
  ctx.font = 'bold 28px Arial';
  ctx.fillText(courseName, 60, 280);

  // Issuer & Date
  ctx.fillStyle = '#555555';
  ctx.font = '18px Arial';
  let y = 350;
  if (issuer) {
    ctx.fillText(`Issued by ${issuer}`, 60, y);
    y += 40;
  }
  if (issueDate) {
    ctx.fillText(`Issued on: ${issueDate}`, 60, y);
    y += 40;
  }
  if (certificateId) {
    ctx.fillText(`Certificate ID: ${certificateId}`, 60, y);
    y += 40;
  }
  if (verificationUrl) {
    ctx.fillText(`Verification URL: ${verificationUrl}`, 60, y);
    y += 40;
  }
  if (extraText) {
    ctx.fillText(extraText, 60, y);
  }

  return canvas.toBuffer('image/png');
}

/**
 * Generate Scanned PDF (Embedded image with no extractable text stream)
 */
async function createScannedPdf(filename, details) {
  const pngBuffer = renderCertificateToCanvasPng(details);
  const pdfDoc = await PDFDocument.create();
  const pngImage = await pdfDoc.embedPng(pngBuffer);
  const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
  page.drawImage(pngImage, {
    x: 0,
    y: 0,
    width: pngImage.width,
    height: pngImage.height,
  });

  const pdfBytes = await pdfDoc.save();
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, pdfBytes);
  console.log(`[GENERATED SCANNED PDF] ${filename} (${pdfBytes.length} bytes)`);
}

async function generateAll() {
  console.log('Generating 20 Acceptance Test Certificates in:', OUTPUT_DIR);

  // 1. CASE-01: Valid NPTEL Python
  await createTextPdf({
    filename: 'cert-01-nptel-python.pdf',
    title: 'Certificate of Completion',
    studentName: 'Alex Morgan',
    courseName: 'Programming, Data Structures and Algorithms Using Python',
    issuer: 'NPTEL',
    certificateId: 'NPTEL24CS101S1234567',
    issueDate: '2024-10-25',
    verificationUrl: 'https://archive.nptel.ac.in/noc/E_Certificate/verify?certId=NPTEL24CS101S1234567',
    extraText: 'Focus on Python core algorithms and data structures.',
  });

  // 2. CASE-02: Valid Coursera Machine Learning
  await createTextPdf({
    filename: 'cert-02-coursera-ml.pdf',
    title: 'Certificate of Completion',
    studentName: 'Alex Morgan',
    courseName: 'Machine Learning Specialization',
    issuer: 'Coursera',
    certificateId: 'COURSERA-ML-987654',
    issueDate: '2024-11-15',
    verificationUrl: 'https://www.coursera.org/verify/COURSERA-ML-987654',
    extraText: 'Comprehensive training in Machine Learning algorithms and supervised learning.',
  });

  // 3. CASE-03: Valid Coursera Deep Learning
  await createTextPdf({
    filename: 'cert-03-coursera-deeplearning.pdf',
    title: 'Certificate of Completion',
    studentName: 'Alex Morgan',
    courseName: 'Deep Learning and Neural Networks',
    issuer: 'Coursera',
    certificateId: 'COURSERA-DL-543210',
    issueDate: '2024-12-01',
    verificationUrl: 'https://www.coursera.org/verify/COURSERA-DL-543210',
    extraText: 'Advanced study of Deep Learning, CNNs, and recurrent networks.',
  });

  // 4. CASE-04: Valid edX SQL
  await createTextPdf({
    filename: 'cert-04-edx-sql.pdf',
    title: 'Certificate of Completion',
    studentName: 'Alex Morgan',
    courseName: 'Querying Data with SQL and Relational Databases',
    issuer: 'edX',
    certificateId: 'e0d1f2a3b4c56789e0d1f2a3b4c56789',
    issueDate: '2025-01-20',
    verificationUrl: 'https://verify.edx.org/cert/e0d1f2a3b4c56789e0d1f2a3b4c56789',
    extraText: 'Hands-on querying with relational SQL database management systems.',
  });

  // 5. CASE-05: Valid Credly React
  await createTextPdf({
    filename: 'cert-05-credly-react.pdf',
    title: 'Certificate of Completion',
    studentName: 'Alex Morgan',
    courseName: 'Certified Frontend Specialist in React and Web Development',
    issuer: 'Credly',
    certificateId: '11223344-5566-7788-9900-aabbccddeeff',
    issueDate: '2025-02-14',
    verificationUrl: 'https://www.credly.com/badges/11223344-5566-7788-9900-aabbccddeeff',
    extraText: 'Mastery of React components, hooks, and responsive user interfaces.',
  });

  // 6. CASE-06: Valid Accredible Node.js
  await createTextPdf({
    filename: 'cert-06-accredible-nodejs.pdf',
    title: 'Certificate of Completion',
    studentName: 'Alex Morgan',
    courseName: 'Backend Engineering with Node.js and Microservices',
    issuer: 'Accredible',
    certificateId: 'accredible-node-99887766',
    issueDate: '2025-03-10',
    verificationUrl: 'https://www.credential.net/accredible-node-99887766',
    extraText: 'Asynchronous event-driven architecture using Node.js runtime.',
  });

  // 7. CASE-07: Valid Coursera JavaScript
  await createTextPdf({
    filename: 'cert-07-coursera-javascript.pdf',
    title: 'Certificate of Completion',
    studentName: 'Alex Morgan',
    courseName: 'JavaScript Modern Web Applications',
    issuer: 'Coursera',
    certificateId: 'COURSERA-JS-778899',
    issueDate: '2025-04-05',
    verificationUrl: 'https://www.coursera.org/verify/COURSERA-JS-778899',
    extraText: 'Full proficiency in ECMAScript JavaScript programming standards.',
  });

  // 8. CASE-08: Valid NPTEL Python + Machine Learning
  await createTextPdf({
    filename: 'cert-08-nptel-ml-python.pdf',
    title: 'Certificate of Completion',
    studentName: 'Alex Morgan',
    courseName: 'Python for Data Science and Machine Learning',
    issuer: 'NPTEL',
    certificateId: 'NPTEL25CS202S9876543',
    issueDate: '2025-05-18',
    verificationUrl: 'https://archive.nptel.ac.in/noc/E_Certificate/verify?certId=NPTEL25CS202S9876543',
    extraText: 'Applied Python programming for Machine Learning predictive modeling.',
  });

  // 9. CASE-09: Forged Typosquatting / Suffix Spoof
  await createTextPdf({
    filename: 'cert-09-forged-typosquatting.pdf',
    title: 'Certificate of Completion',
    studentName: 'Alex Morgan',
    courseName: 'Machine Learning Mastery',
    issuer: 'Coursera',
    certificateId: 'COURSERA-FAKE-001',
    issueDate: '2025-05-01',
    verificationUrl: 'https://coursera.org.attacker-phish.com/verify/COURSERA-FAKE-001',
    extraText: 'Advanced Machine Learning predictive systems.',
  });

  // 10. CASE-10: Forged Altered ID
  await createTextPdf({
    filename: 'cert-10-forged-altered-id.pdf',
    title: 'Certificate of Completion',
    studentName: 'Alex Morgan',
    courseName: 'Full-Stack Web Development with React',
    issuer: 'edX',
    certificateId: 'ffff0000aaaa1111bbbb2222cccc3333',
    issueDate: '2025-05-05',
    verificationUrl: 'https://verify.edx.org/cert/ffff0000aaaa1111bbbb2222cccc3333',
    extraText: 'Component architecture with React library.',
  });

  // 11. CASE-11: Forged NPTEL Revoked ID
  await createTextPdf({
    filename: 'cert-11-forged-nptel-revoked.pdf',
    title: 'Certificate of Completion',
    studentName: 'Alex Morgan',
    courseName: 'Deep Learning Fundamentals',
    issuer: 'NPTEL',
    certificateId: 'NPTEL-REVOKED-0000000',
    issueDate: '2025-05-10',
    verificationUrl: 'https://archive.nptel.ac.in/noc/E_Certificate/verify?certId=NPTEL-REVOKED-0000000',
    extraText: 'Foundations of Deep Learning and artificial neural nets.',
  });

  // 12. CASE-12: Forged SSRF Exploit
  await createTextPdf({
    filename: 'cert-12-forged-ssrf-metadata.pdf',
    title: 'Certificate of Completion',
    studentName: 'Alex Morgan',
    courseName: 'SQL Database Administration',
    issuer: 'Credly',
    certificateId: 'credly-ssrf-attack-001',
    issueDate: '2025-05-12',
    verificationUrl: 'http://169.254.169.254/latest/meta-data/',
    extraText: 'Relational database querying with SQL.',
  });

  // 13. CASE-13: Legitimate Unsupported Issuer
  await createTextPdf({
    filename: 'cert-13-unsupported-issuer.pdf',
    title: 'Certificate of Completion',
    studentName: 'Alex Morgan',
    courseName: 'Advanced JavaScript Frameworks',
    issuer: 'Autonomous Technical Institute',
    certificateId: 'ATI-JS-2025-555',
    issueDate: '2025-05-15',
    verificationUrl: 'https://autonomous-institute.edu/verify/555',
    extraText: 'Advanced client-side JavaScript design patterns.',
  });

  // 14. CASE-14: Missing Verification URL
  await createTextPdf({
    filename: 'cert-14-missing-verification-url.pdf',
    title: 'Certificate of Participation',
    studentName: 'Alex Morgan',
    courseName: 'Executive Leadership Seminar',
    issuer: 'Global Leadership Institute',
    certificateId: 'GLI-LEAD-2026-10294',
    issueDate: '2026-02-10',
    verificationUrl: null,
    extraText: 'Participated in executive leadership and management development.',
  });

  // 15. CASE-15: Timeout Unreachable
  await createTextPdf({
    filename: 'cert-15-timeout-unreachable.pdf',
    title: 'Certificate of Completion',
    studentName: 'Alex Morgan',
    courseName: 'Cloud Database Architecture with SQL',
    issuer: 'Coursera',
    certificateId: 'COURSERA-TIMEOUT-999',
    issueDate: '2025-05-20',
    verificationUrl: 'https://www.coursera.org/verify/COURSERA-TIMEOUT-999',
    extraText: 'Enterprise SQL database architecture on distributed cloud storage.',
  });

  // 16. CASE-16: No Evidence HTTP 200
  await createTextPdf({
    filename: 'cert-16-no-evidence-http200.pdf',
    title: 'Certificate of Completion',
    studentName: 'Alex Morgan',
    courseName: 'Python Advanced Data Structures',
    issuer: 'NPTEL',
    certificateId: 'NPTEL-NO-EVIDENCE-404',
    issueDate: '2025-05-25',
    verificationUrl: 'https://archive.nptel.ac.in/noc/E_Certificate/verify',
    extraText: 'Advanced algorithms implemented using Python.',
  });

  // 17. CASE-17: Scanned PDF (OCR fallback)
  await createScannedPdf('cert-17-scanned-ocr.pdf', {
    title: 'Certificate of Completion',
    studentName: 'Shreya Das',
    courseName: 'Zero to Python Hero: Code Smart with AI',
    issuer: 'LetsUpgrade',
    certificateId: 'LU-PY-2025-0814',
    issueDate: '2025-06-23',
    extraText: 'Comprehensive hands-on Python programming course.',
  });

  // 18. CASE-18: Scanned Image PNG
  const imgPngBuffer = renderCertificateToCanvasPng({
    title: 'Certificate of Completion',
    studentName: 'Shreya Das',
    courseName: 'Zero to Python Hero: Code Smart with AI',
    issuer: 'LetsUpgrade',
    certificateId: 'LU-PY-2025-0814',
    issueDate: '2025-06-23',
    extraText: 'Comprehensive hands-on Python programming course.',
  });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'cert-18-image-ocr.png'), imgPngBuffer);
  console.log(`[GENERATED PNG] cert-18-image-ocr.png (${imgPngBuffer.length} bytes)`);

  // 19. CASE-19: Empty / Corrupted PDF
  const corruptBuffer = Buffer.from('%PDF-1.4\n%corrupted-empty-stream\n%%EOF');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'cert-19-empty-corrupt.pdf'), corruptBuffer);
  console.log(`[GENERATED CORRUPT PDF] cert-19-empty-corrupt.pdf (${corruptBuffer.length} bytes)`);

  // 20. CASE-20: Incomplete Metadata PDF
  const pdf20Doc = await PDFDocument.create();
  const page20 = pdf20Doc.addPage([500, 300]);
  const fontBold20 = await pdf20Doc.embedFont(StandardFonts.HelveticaBold);
  page20.drawText('Certificate of Completion', {
    x: 100,
    y: 180,
    size: 24,
    font: fontBold20,
    color: rgb(0.2, 0.2, 0.2),
  });
  const pdf20Bytes = await pdf20Doc.save();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'cert-20-incomplete-metadata.pdf'), pdf20Bytes);
  console.log(`[GENERATED INCOMPLETE PDF] cert-20-incomplete-metadata.pdf (${pdf20Bytes.length} bytes)`);

  console.log('All 20 acceptance fixtures generated successfully.');
}

generateAll().catch((err) => {
  console.error('Error generating fixtures:', err);
  process.exit(1);
});
