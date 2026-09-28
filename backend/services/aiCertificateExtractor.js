// ==============================================================================
// Student Micro-Credential Verification Engine - AI Certificate Extractor
// ==============================================================================

const { isGeminiConfigured, getGeminiClient, getGeminiModel } = require('../config/gemini');
const { Type } = require('@google/genai');

const AI_EXTRACT_TIMEOUT_MS = 10000;

function withTimeout(promise, ms, timeoutMsg = 'Operation timed out') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(timeoutMsg));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * Extracts certificate metadata from OCR / raw text using Google Gemini as a fallback.
 * Only extracts information visibly present in the text; never invents missing values.
 * 
 * @param {string} rawText - Raw extracted text from certificate
 * @param {number} [timeoutMs=AI_EXTRACT_TIMEOUT_MS]
 * @returns {Promise<{
 *   certificate_name: string|null,
 *   issuer: string|null,
 *   certificate_id: string|null,
 *   issue_date: string|null,
 *   verification_url: string|null,
 *   purpose: string|null
 * }|null>}
 */
const { normalizeDate } = require('./informationExtractor');

async function extractMetadataWithGemini(rawText = '', fileBuffer = null, mimeType = null, timeoutMs = AI_EXTRACT_TIMEOUT_MS) {
  if (!rawText && !fileBuffer) {
    return null;
  }

  if (!isGeminiConfigured()) {
    return null;
  }

  const client = getGeminiClient();
  const model = getGeminiModel();
  if (!client) {
    return null;
  }

  const systemInstruction = `You are a precision certificate metadata extraction assistant.
Your task is to extract structured certificate fields strictly from the provided certificate document and OCR text.

RULES:
1. Extract ONLY information that is explicitly and visibly present in the certificate image/text.
2. If any field is missing or ambiguous, you MUST return null for that field.
3. NEVER invent, hallucinate, or guess missing dates, names, URLs, or IDs.
4. Normalize issue_date to YYYY-MM-DD if a valid date is present (e.g., "Mar 22, 2023" -> "2023-03-22", "May 14, 2013" -> "2013-05-14").
5. Normalize verification_url to a complete valid URL (e.g. "coursera.org/verify/XYZ" -> "https://coursera.org/verify/XYZ"). Fix obvious OCR spacing or letter typos in domain/verify paths.
6. Extract certificate_id from labeled IDs or from the verification URL path.
7. Extract certificate_name as the specific course/program title, not generic words like "CERTIFICATE OF COMPLETION".
8. Extract purpose as the completion/recognition statement (e.g., "has successfully completed...", "for successfully completing...", "Coursera has confirmed the identity...").`;

  const userPrompt = `Extract the 6 certificate fields as strict JSON matching the schema.`;

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
  if (fileBuffer && mimeType && (mimeType.startsWith('image/') || mimeType === 'application/pdf')) {
    const cleanMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
    parts.push({
      inlineData: {
        mimeType: cleanMime,
        data: Buffer.isBuffer(fileBuffer) ? fileBuffer.toString('base64') : fileBuffer,
      },
    });
  }
  parts.push({
    text: `${userPrompt}\n\nCERTIFICATE OCR RAW TEXT (if any):\n"""\n${rawText || ''}\n"""`,
  });

  try {
    const apiCall = client.models.generateContent({
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

    const response = await withTimeout(apiCall, timeoutMs, 'AI metadata extraction timed out');
    let textResponse = response.text ? response.text.trim() : '';
    if (!textResponse) {
      return null;
    }

    // Strip markdown code fences if present
    textResponse = textResponse.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    const parsed = JSON.parse(textResponse);
    const issueDateNormalized = parsed.issue_date ? (normalizeDate(parsed.issue_date) || parsed.issue_date) : null;
    let vUrl = parsed.verification_url || null;
    if (vUrl && !vUrl.startsWith('http://') && !vUrl.startsWith('https://')) {
      vUrl = `https://${vUrl}`;
    }

    return {
      certificate_name: parsed.certificate_name || null,
      issuer: parsed.issuer || null,
      certificate_id: parsed.certificate_id || null,
      issue_date: issueDateNormalized,
      verification_url: vUrl,
      purpose: parsed.purpose || null,
    };
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[AiCertificateExtractor] Gemini extraction fallback error:', err.message);
    }
    return null;
  }
}

module.exports = {
  extractMetadataWithGemini,
};
