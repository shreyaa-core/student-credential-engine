const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { getGeminiClient, getGeminiModel, isGeminiConfigured } = require('../config/gemini');
const { Type } = require('@google/genai');
const { parseCertificate } = require('../services/certificateParser');
const { extractCertificateInfo } = require('../services/informationExtractor');

async function testFile(fileName) {
  const filePath = path.join(__dirname, '../../sample-certificates', fileName);
  console.log('\n===============================================================');
  console.log(`TESTING FILE: ${fileName}`);
  console.log('===============================================================');

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(fileName).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : ext === '.pdf' ? 'application/pdf' : 'image/jpeg';

  // 1. OCR Stage
  const ocrResult = await parseCertificate(filePath, mimeType, buffer);
  console.log('--- 1. OCR RAW TEXT ---');
  console.log(ocrResult.text);

  // 2. Deterministic Extraction Stage
  console.log('\n--- 2. DETERMINISTIC EXTRACTION ---');
  const detInfo = extractCertificateInfo(ocrResult.text);
  console.log(JSON.stringify(detInfo, null, 2));

  // 3. Multimodal / Vision Gemini Extraction Stage
  console.log('\n--- 3. MULTIMODAL GEMINI EXTRACTION ---');
  const client = getGeminiClient();
  const model = getGeminiModel();

  if (!client) {
    console.log('Gemini client not configured.');
    return;
  }

  const systemInstruction = `You are a precision certificate verification & metadata extraction engine.
Analyze the certificate image and extract structured metadata fields strictly visible on the document.

RULES:
1. Extract ONLY information explicitly and visibly present in the certificate image/text.
2. If any field is missing or unreadable, return null for that field. Never invent, guess, or hallucinate missing data.
3. Normalize issue_date to YYYY-MM-DD (e.g. "Mar 22, 2023" -> "2023-03-22", "May 14, 2013" -> "2013-05-14").
4. Preserve complete Coursera verification URLs (e.g. "https://coursera.org/verify/<ID>"). If the URL on the document lacks https://, prepend https://.
5. Extract certificate_id from labeled identifiers (e.g. Credential ID, Certificate ID, Verify Code) or from the verification URL path.
6. Extract certificate_name as the specific course/program title.
7. Extract purpose as the completion/recognition statement (e.g. "for successfully completing...", "Coursera has confirmed the identity...").`;

  const userPrompt = `Extract the 6 certificate fields as strict JSON matching the schema from this certificate document.`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      certificate_name: { type: Type.STRING, nullable: true },
      issuer: { type: Type.STRING, nullable: true },
      certificate_id: { type: Type.STRING, nullable: true },
      issue_date: { type: Type.STRING, nullable: true },
      verification_url: { type: Type.STRING, nullable: true },
      purpose: { type: Type.STRING, nullable: true },
    },
    required: ['certificate_name', 'issuer', 'certificate_id', 'issue_date', 'verification_url', 'purpose'],
  };

  const parts = [];
  if (mimeType.startsWith('image/')) {
    parts.push({
      inlineData: {
        mimeType: mimeType,
        data: buffer.toString('base64'),
      },
    });
  }
  parts.push({
    text: `${userPrompt}\n\nOCR RAW TEXT (for reference):\n"""\n${ocrResult.text || ''}\n"""`,
  });

  const response = await client.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.0,
      maxOutputTokens: 2048,
    },
  });

  let textRes = response.text ? response.text.trim() : '';
  textRes = textRes.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const aiParsed = JSON.parse(textRes);
  console.log(JSON.stringify(aiParsed, null, 2));

  // 4. Merge results
  console.log('\n--- 4. FINAL MERGED RESULT ---');
  const merged = {
    certificate_name: detInfo.certificate_name || aiParsed.certificate_name || null,
    issuer: detInfo.issuer || aiParsed.issuer || null,
    certificate_id: detInfo.certificate_id || aiParsed.certificate_id || null,
    issue_date: detInfo.issue_date || aiParsed.issue_date || null,
    verification_url: detInfo.verification_url || aiParsed.verification_url || null,
    purpose: detInfo.purpose || aiParsed.purpose || null,
  };
  console.log(JSON.stringify(merged, null, 2));
}

async function run() {
  await testFile('corsera demo.png');
  await testFile('coursera demo 2.jpg');
}

run().catch(console.error);
