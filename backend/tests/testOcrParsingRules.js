const {
  extractCertificateInfo,
  extractCourseName,
  extractIssuer,
  extractCertificateId,
  extractIssueDate,
  extractVerificationUrl,
  extractPurpose,
  normalizeDate,
} = require('../services/informationExtractor');

const sampleOcrText = `
ee VERIFIED
CERTIFICATE
Penn
>
University of PENNSYLVANIA
May 14, 2013
Jane Learner 7 =
has successfully completed A i
My First Coursera Course el /
TTS TY
Professor John Doe
Vertfy at courvera.org/vertfy/32080F 2901
Cowrvers bas confirmed the identity of this individual
ard ther parneipatson in the course
`;

console.log('--- TEST SAMPLE OCR TEXT ---');
console.log('Extracted Course:', extractCourseName(sampleOcrText));
console.log('Extracted Issuer:', extractIssuer(sampleOcrText));
console.log('Extracted Date:', extractIssueDate(sampleOcrText));
console.log('Extracted URL:', extractVerificationUrl(sampleOcrText));
console.log('Extracted ID:', extractCertificateId(sampleOcrText));
console.log('Extracted Purpose:', extractPurpose(sampleOcrText));
console.log('Full Info:', extractCertificateInfo(sampleOcrText));
