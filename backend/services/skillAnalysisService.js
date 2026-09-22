// ==============================================================================
// Student Micro-Credential Verification Engine - Skill Analysis Service
// ==============================================================================

const { v4: uuidv4 } = require('uuid');
const { Type } = require('@google/genai');
const { isGeminiConfigured, getGeminiClient, getGeminiModel } = require('../config/gemini');
const { isOpenAIConfigured, getOpenAIClient, getOpenAIModel } = require('../config/openai');

/**
 * Maximum timeout for any AI / OpenAI analysis request (15 seconds).
 * Ensures the pipeline easily meets the overall 60-second execution ceiling.
 */
const AI_TIMEOUT_MS = 15000;

/**
 * Minimum confidence required for automatic skill mapping.
 */
const CONFIDENCE_THRESHOLD = 0.85;

/**
 * Technical skill patterns used for evidence-based candidate extraction from raw_text.
 * Every candidate extracted MUST have direct verbatim evidence in the certificate's raw_text.
 */
const TECHNICAL_PATTERNS = [
  // Taxonomy skills
  { name: 'Python', regex: /\bpython\b/i },
  { name: 'JavaScript', regex: /(?:\b(?:javascript|ecmascript)\b|(?<!(?:node|react|vue|next)[\.\s_-]*)\bjs\b)/i },
  { name: 'React', regex: /\breact(?:\.js)?\b/i },
  { name: 'Node.js', regex: /\bnode(?:\.js)?\b/i },
  { name: 'SQL', regex: /\b(?:sql|postgresql|postgres|mysql|sqlite)\b/i },
  { name: 'Machine Learning', regex: /\bmachine\s+learning\b/i },
  { name: 'Deep Learning', regex: /\bdeep\s+learning\b/i },

  // Non-taxonomy technical skills (for unmatchedSkills reporting)
  { name: 'Docker', regex: /\bdocker\b/i },
  { name: 'Kubernetes', regex: /\bkubernetes\b/i },
  { name: 'Cloud Systems', regex: /\bcloud\s+(?:systems?|computing|architecture)\b/i },
  { name: 'Artificial Intelligence', regex: /\b(?:artificial\s+intelligence|\bai\b)\b/i },
  { name: 'Data Analysis', regex: /\bdata\s+analysis\b/i },
  { name: 'Java', regex: /\bjava\b(?!\s*script)/i },
  { name: 'TypeScript', regex: /\btypescript\b/i },
  { name: 'C++', regex: /\bc\+\+\b/i },
  { name: 'Cybersecurity', regex: /\bcyber\s*security\b/i },
];

/**
 * Promise timeout helper.
 */
function withTimeout(promise, ms, timeoutErrorMsg = 'AI analysis timed out') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(timeoutErrorMsg));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * Normalizes text for comparison by collapsing whitespace and stripping special characters.
 * 
 * @param {string} str - Raw string
 * @returns {string} - Clean lowercase alphanumeric string
 */
function normalizeText(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[’']/g, "'")
    .replace(/[“”"]/g, '"')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Node.js Evidence Validator.
 * Validates that the AI-provided evidence string actually exists in the certificate raw_text.
 * Does NOT trust the AI blindly.
 * 
 * @param {string} evidence - The evidence snippet returned by AI
 * @param {string} rawText - The actual certificate extracted raw_text
 * @returns {boolean} - True if evidence is verified to originate from raw_text
 */
function validateEvidenceAgainstRawText(evidence, rawText) {
  if (!evidence || typeof evidence !== 'string' || !rawText || typeof rawText !== 'string') {
    return false;
  }

  const normEvidence = normalizeText(evidence);
  const normRaw = normalizeText(rawText);

  if (!normEvidence || !normRaw) {
    return false;
  }

  // 1. Direct exact substring match after normalization
  if (normRaw.includes(normEvidence)) {
    return true;
  }

  // 2. Token overlap check for slight OCR/formatting variations
  const evWords = normEvidence.split(' ').filter(w => w.length > 2);
  if (evWords.length === 0) {
    return false;
  }

  // If evidence is short (1-2 words), require exact substring
  if (evWords.length <= 2) {
    return normRaw.includes(normEvidence);
  }

  // For longer phrases, verify that at least 70% of words appear in the raw text
  const matchedWords = evWords.filter(w => normRaw.includes(w));
  const matchRatio = matchedWords.length / evWords.length;

  return matchRatio >= 0.7;
}


/**
 * Extracts the exact line and surrounding context from raw_text containing the skill keyword.
 * 
 * @param {string} rawText - Certificate extracted text
 * @param {RegExp} patternRegex - Regex pattern for the skill
 * @returns {string|null} - Verbatim sentence/line evidence from raw_text
 */
function extractEvidenceFromText(rawText, patternRegex) {
  if (!rawText || typeof rawText !== 'string') return null;

  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    if (patternRegex.test(lines[i])) {
      const prev = i > 0 ? lines[i - 1] + ' ' : '';
      const curr = lines[i];
      const next = i < lines.length - 1 ? ' ' + lines[i + 1] : '';
      return (prev + curr + next).replace(/\s+/g, ' ').trim();
    }
  }

  return null;
}

/**
 * Deterministic candidate skill extraction with verbatim raw_text evidence.
 * 
 * @param {string} rawText - Cleaned extracted certificate text
 * @returns {Array<{ name: string, confidence: number, evidence: string }>}
 */
function extractCandidateSkills(rawText) {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
    return [];
  }

  const candidates = [];
  const lowerText = rawText.toLowerCase();

  for (const pattern of TECHNICAL_PATTERNS) {
    if (pattern.regex.test(rawText)) {
      const evidence = extractEvidenceFromText(rawText, pattern.regex);
      if (evidence) {
        // Evaluate confidence: higher if found in course completion context
        let confidence = 0.85;
        if (/completed|certificate|course|proficien|specializ/i.test(evidence)) {
          confidence = 0.95;
        }

        candidates.push({
          name: pattern.name,
          confidence,
          evidence,
        });
      }
    }
  }

  return candidates;
}

/**
 * Matches candidate skills against PostgreSQL public.skills taxonomy using normalized matching.
 * Skills found in raw_text that do NOT exist in the taxonomy are placed in unmatchedSkills.
 * 
 * @param {Array<{ name: string, confidence: number, evidence: string }>} candidates
 * @param {Array<{ id: string, name: string, category: string }>} taxonomy
 * @returns {{
 *   matched: Array<{ skillId: string, skillName: string, category: string, confidence: number, evidence: string }>,
 *   unmatched: Array<{ name: string, confidence: number, evidence: string }>
 * }}
 */
function matchSkillsToTaxonomy(candidates, taxonomy) {
  const matched = [];
  const unmatched = [];
  const seenSkillIds = new Set();

  for (const candidate of candidates) {
    const candidateNorm = candidate.name.toLowerCase().trim();

    // Find normalized match in taxonomy
    const taxMatch = taxonomy.find((tax) => {
      const taxNorm = tax.name.toLowerCase().trim();
      return taxNorm === candidateNorm ||
             (taxNorm.length > 2 && candidateNorm.includes(taxNorm)) ||
             (candidateNorm.length > 2 && taxNorm.includes(candidateNorm));
    });

    if (taxMatch) {
      if (!seenSkillIds.has(taxMatch.id)) {
        seenSkillIds.add(taxMatch.id);
        matched.push({
          skillId: taxMatch.id,
          skillName: taxMatch.name,
          category: taxMatch.category,
          confidence: candidate.confidence,
          evidence: candidate.evidence,
        });
      }
    } else {
      unmatched.push({
        name: candidate.name,
        confidence: candidate.confidence,
        evidence: candidate.evidence,
      });
    }
  }

  return { matched, unmatched };
}

/**
 * Executes structured OpenAI Chat Completion to analyze certificate raw_text against taxonomy.
 * 
 * @param {string} rawText - Extracted certificate text
 * @param {Array<{ id: string, name: string, category: string }>} taxonomy - Dynamic PostgreSQL skills
 * @param {number} timeoutMs - Strict timeout in ms (15000)
 * @returns {Promise<{
 *   success: boolean,
 *   data?: { skills: Array<{ skillName: string, confidence: number, evidence: string }>, unmatchedSkills: Array<{ name: string, confidence: number, evidence: string }>, analysisNotes: string },
 *   error?: string,
 *   code?: string,
 *   durationMs: number
 * }>}
 */
/**
 * Executes structured Google Gemini generateContent to analyze certificate raw_text against taxonomy.
 * 
 * @param {string} rawText - Extracted certificate text
 * @param {Array<{ id: string, name: string, category: string }>} taxonomy - Dynamic PostgreSQL skills
 * @param {number} timeoutMs - Strict timeout in ms (15000)
 * @returns {Promise<{
 *   success: boolean,
 *   data?: { skills: Array<{ skillName: string, confidence: number, evidence: string }>, unmatchedSkills: Array<{ name: string, confidence: number, evidence: string }>, analysisNotes: string },
 *   error?: string,
 *   code?: string,
 *   durationMs: number
 * }>}
 */
async function callGeminiSkillAnalysis(rawText, taxonomy, timeoutMs = AI_TIMEOUT_MS) {
  const start = Date.now();
  const client = getGeminiClient();
  const model = getGeminiModel();

  if (!client) {
    return {
      success: false,
      error: 'Google Gemini client is not configured (GEMINI_API_KEY missing)',
      code: 'NOT_CONFIGURED',
      durationMs: 0,
    };
  }

  const taxList = taxonomy.map(t => `- ${t.name} (Category: ${t.category})`).join('\n');

  const systemInstruction = `You are a strict, conservative micro-credential skill auditor analyzing a certificate document for evidence-supported skills.
Your job is to analyze the provided CERTIFICATE RAW TEXT and identify technical skills that are explicitly mentioned and supported by the document text.

CRITICAL AUDIT RULES:
1. Ground Truth Only: Every skill you identify MUST have explicit, verifiable supporting text in the document.
2. Verbatim Evidence: For every skill, you MUST copy the exact supporting text from the document as the "evidence" field. Never paraphrase, summarize, or invent evidence.
3. Strict Taxonomy Constraint:
You are provided with the authorized PostgreSQL SKILLS TAXONOMY.
Only select skills that exist in the supplied PostgreSQL taxonomy for the "skills" array. If a skill is explicitly supported by the text and matches a taxonomy skill (e.g. "Python Programming" -> "Python"), place it in the "skills" array with "skillName" set to the exact taxonomy name.
4. No Broad Leaps:
- "Artificial Intelligence" or "AI" alone must NEVER be mapped to "Machine Learning" or "Deep Learning" unless those specific terms appear in the certificate text.
- "Web Development" alone must NEVER be mapped to "React" or "Node.js" unless those specific terms appear in the text.
- "Programming" alone must NEVER be mapped to "JavaScript" or "Python" unless those specific terms appear in the text.
- Never infer unrelated skills.
- Never assume skills based on the issuer's reputation or name.
5. Unknown Skills:
If a specific technical skill is explicitly mentioned in the text with clear evidence, but does NOT exist in the provided taxonomy (e.g. Docker, Kubernetes, Cloud Systems), place it in the "unmatchedSkills" array:
{"name": "...", "confidence": 0.95, "evidence": "Exact quote from text"}
Do NOT insert unknown skills into the taxonomy list.
6. Confidence:
Provide a confidence score between 0.0 and 1.0 (use >= 0.85 only when clear, explicit evidence exists).
7. If no technical skills are mentioned, return empty arrays.
8. Do not determine certificate authenticity. Do not claim that the certificate is verified.`;

  const userPrompt = `AVAILABLE SKILLS TAXONOMY (from PostgreSQL):
${taxList}

CERTIFICATE RAW TEXT:
"""
${rawText}
"""`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      skills: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            skillName: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            evidence: { type: Type.STRING },
          },
          required: ['skillName', 'confidence', 'evidence'],
        },
      },
      unmatchedSkills: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            evidence: { type: Type.STRING },
          },
          required: ['name', 'confidence', 'evidence'],
        },
      },
      analysisNotes: { type: Type.STRING },
    },
    required: ['skills', 'unmatchedSkills', 'analysisNotes'],
  };

  try {
    const apiCallPromise = client.models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.1,
      },
    });

    const response = await withTimeout(apiCallPromise, timeoutMs, 'Gemini analysis timed out after 15s');
    const durationMs = Date.now() - start;

    const content = response.text;
    if (!content) {
      return {
        success: false,
        error: 'Gemini returned empty message content',
        code: 'EMPTY_RESPONSE',
        durationMs,
      };
    }

    const parsed = JSON.parse(content);
    return {
      success: true,
      data: parsed,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const isQuota = err.status === 429 || /quota|credits|billing|resource[ _]?exhausted/i.test(err.message || '');
    const isTimeout = /timed out/i.test(err.message || '');
    const code = isQuota ? 'QUOTA_EXCEEDED' : (isTimeout ? 'TIMEOUT' : (err.code || 'API_ERROR'));

    return {
      success: false,
      error: isQuota ? 'Gemini API quota exceeded or rate limit reached (429)' : err.message,
      code,
      durationMs,
    };
  }
}

/**
 * Main skill analysis function:
 * 1. Inspects OpenAI configuration.
 * 2. Fetches active taxonomy from PostgreSQL public.skills at runtime.
 * 3. Analyzes certificate raw_text:
 *    - Calls OpenAI if configured.
 *    - Validates AI response in Node.js (exact evidence matching against raw_text, confidence >= 0.85).
 *    - If AI call fails (e.g. quota exhausted, timeout), falls back cleanly to deterministic raw_text extraction.
 * 4. Returns structured result with timing metrics.
 * 
 * @param {string} rawText - Raw certificate text from PDF extraction or OCR
 * @param {object} pool - PostgreSQL database connection pool
 * @returns {Promise<{
 *   aiConfigured: boolean,
 *   aiStatus: string,
 *   model: string,
 *   skills: Array<{ skillId: string, skillName: string, category: string, confidence: number, evidence: string }>,
 *   unmatchedSkills: Array<{ name: string, confidence: number, evidence: string }>,
 *   timing: {
 *     taxonomyFetchDurationMs: number,
 *     aiDurationMs: number,
 *     validationDurationMs: number,
 *     totalDurationMs: number
 *   }
 * }>}
 */
async function analyzeCertificateSkills(rawText, pool) {
  const totalStart = Date.now();
  const isAiConfig = isGeminiConfigured();
  const model = getGeminiModel();
  let aiDurationMs = 0;
  let validationDurationMs = 0;

  // 1. Fetch current taxonomy dynamically from PostgreSQL public.skills
  const taxStart = Date.now();
  let taxonomy = [];
  try {
    const taxRes = await pool.query('SELECT id, name, category FROM skills ORDER BY name ASC');
    taxonomy = taxRes.rows || [];
  } catch (taxErr) {
    console.error('Failed to fetch skills taxonomy from database:', taxErr.message);
    taxonomy = [];
  }
  const taxFetchDuration = Date.now() - taxStart;

  if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
    return {
      aiConfigured: isAiConfig,
      aiStatus: isAiConfig ? 'SKIPPED_EMPTY_TEXT' : 'NOT CONFIGURED',
      model,
      skills: [],
      unmatchedSkills: [],
      timing: {
        taxonomyFetchDurationMs: taxFetchDuration,
        aiDurationMs: 0,
        validationDurationMs: 0,
        totalDurationMs: Date.now() - totalStart,
      },
    };
  }

  let finalMatchedSkills = [];
  let finalUnmatchedSkills = [];
  let aiStatus = 'NOT CONFIGURED';

  if (isAiConfig) {
    // 2. Call Google Gemini with 15-second strict timeout
    const aiResult = await callGeminiSkillAnalysis(rawText, taxonomy, AI_TIMEOUT_MS);
    aiDurationMs = aiResult.durationMs;

    if (aiResult.success && aiResult.data) {
      aiStatus = 'SUCCESS';
      const valStart = Date.now();
      const rawSkills = Array.isArray(aiResult.data.skills) ? aiResult.data.skills : [];
      const rawUnmatched = Array.isArray(aiResult.data.unmatchedSkills) ? aiResult.data.unmatchedSkills : [];

      // 3. Node.js Evidence & Confidence Validation for taxonomy skills
      const seenSkillIds = new Set();
      for (const item of rawSkills) {
        const sName = (item.skillName || item.skill || '').trim();
        const conf = typeof item.confidence === 'number' ? item.confidence : 0;
        const evidence = item.evidence || '';

        // Requirement: confidence >= 0.85
        if (conf < CONFIDENCE_THRESHOLD) {
          continue;
        }

        // Requirement: Evidence must actually exist in raw_text (Node.js validation)
        const isEvidenceValid = validateEvidenceAgainstRawText(evidence, rawText);
        if (!isEvidenceValid) {
          continue;
        }

        // Requirement: Must match PostgreSQL taxonomy
        const taxMatch = taxonomy.find(t => t.name.toLowerCase() === sName.toLowerCase());
        if (taxMatch && !seenSkillIds.has(taxMatch.id)) {
          seenSkillIds.add(taxMatch.id);
          finalMatchedSkills.push({
            skillId: taxMatch.id,
            skillName: taxMatch.name,
            category: taxMatch.category,
            confidence: conf,
            evidence,
          });
        }
      }

      // 4. Node.js Validation for unmatched skills
      for (const item of rawUnmatched) {
        const uName = (item.name || item.skill || '').trim();
        const conf = typeof item.confidence === 'number' ? item.confidence : 0;
        const evidence = item.evidence || '';

        if (conf >= CONFIDENCE_THRESHOLD && validateEvidenceAgainstRawText(evidence, rawText)) {
          // Verify it's genuinely not in taxonomy
          const inTax = taxonomy.some(t => t.name.toLowerCase() === uName.toLowerCase());
          if (!inTax) {
            finalUnmatchedSkills.push({
              name: uName,
              confidence: conf,
              evidence,
            });
          }
        }
      }

      validationDurationMs = Date.now() - valStart;
    } else {
      // AI call failed (e.g. 429 quota exhausted or timeout)
      aiStatus = `FAILED (${aiResult.error || 'Gemini call failed'}) - Safe deterministic fallback applied`;
      console.warn(`[SkillAnalysis] Gemini call status: ${aiStatus}`);

      // Perform deterministic candidate extraction with evidence validation from raw_text
      const valStart = Date.now();
      const candidates = extractCandidateSkills(rawText);
      const validatedCandidates = candidates.filter(c =>
        c.confidence >= CONFIDENCE_THRESHOLD && validateEvidenceAgainstRawText(c.evidence, rawText)
      );
      const { matched, unmatched } = matchSkillsToTaxonomy(validatedCandidates, taxonomy);
      finalMatchedSkills = matched;
      finalUnmatchedSkills = unmatched;
      validationDurationMs = Date.now() - valStart;
    }
  } else {
    // Gemini not configured: deterministic extraction
    aiStatus = 'NOT CONFIGURED - GEMINI_API_KEY not set in environment';
    const valStart = Date.now();
    const candidates = extractCandidateSkills(rawText);
    const validatedCandidates = candidates.filter(c =>
      c.confidence >= CONFIDENCE_THRESHOLD && validateEvidenceAgainstRawText(c.evidence, rawText)
    );
    const { matched, unmatched } = matchSkillsToTaxonomy(validatedCandidates, taxonomy);
    finalMatchedSkills = matched;
    finalUnmatchedSkills = unmatched;
    validationDurationMs = Date.now() - valStart;
  }

  return {
    aiConfigured: isAiConfig,
    aiStatus,
    model,
    skills: finalMatchedSkills,
    unmatchedSkills: finalUnmatchedSkills,
    timing: {
      taxonomyFetchDurationMs: taxFetchDuration,
      aiDurationMs,
      validationDurationMs,
      totalDurationMs: Date.now() - totalStart,
    },
  };
}

/**
 * Persists verified certificate skills into public.certificate_skills and stores
 * skill analysis evidence in public.certificates.verification_evidence JSONB.
 * 
 * Enforces ownership: certificate must belong to the authenticated student_id (req.user.id).
 * Uses ON CONFLICT (certificate_id, skill_id) DO NOTHING to prevent duplicates.
 * Safely merges evidence with existing JSONB without overwriting other verification keys.
 * 
 * @param {string} certificateId - Target certificate UUID
 * @param {string} studentId - Authenticated student UUID (req.user.id)
 * @param {Array<{ skillId: string, skillName?: string, confidence?: number, evidence?: string }>} skills - Matched skills to save
 * @param {object} pool - PostgreSQL pool
 * @param {object|null} fullAnalysis - Full analysis result object to store in verification_evidence
 * @returns {Promise<{ insertedCount: number, durationMs: number }>}
 */
async function saveCertificateSkills(certificateId, studentId, skills = [], pool, fullAnalysis = null) {
  const start = Date.now();

  if (!certificateId || !studentId) {
    return { insertedCount: 0, durationMs: 0 };
  }

  // 1. Enforce certificate ownership: verify certificate belongs to req.user.id
  const certCheck = await pool.query(
    'SELECT id, student_id FROM certificates WHERE id = $1 AND student_id = $2',
    [certificateId, studentId]
  );

  if (certCheck.rows.length === 0) {
    throw new Error('Unauthorized certificate skill assignment: certificate does not belong to authenticated user.');
  }

  let insertedCount = 0;

  // 2. Insert valid matched skills into certificate_skills
  if (Array.isArray(skills) && skills.length > 0) {
    for (const skill of skills) {
      try {
        const linkId = uuidv4();
        const proficiency = (skill.confidence || 0) >= 0.9 ? 'Advanced' : 'Intermediate';

        const res = await pool.query(
          `INSERT INTO certificate_skills (id, certificate_id, skill_id, proficiency_level, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (certificate_id, skill_id) DO NOTHING
           RETURNING id`,
          [linkId, certificateId, skill.skillId, proficiency]
        );

        if (res.rows.length > 0) {
          insertedCount++;
        }
      } catch (err) {
        console.warn(`Warning inserting skill ${skill.skillId} for certificate ${certificateId}:`, err.message);
      }
    }
  }

  // 3. Store validated skill evidence into certificates.verification_evidence JSONB
  // Merge safely using PostgreSQL || JSONB concatenation operator
  if (fullAnalysis) {
    try {
      const skillEvidencePayload = {
        aiConfigured: fullAnalysis.aiConfigured ?? true,
        aiStatus: fullAnalysis.aiStatus ?? 'UNKNOWN',
        model: fullAnalysis.model ?? getGeminiModel(),
        skills: (skills || []).map(s => ({
          skill: s.skillName || s.skill || s.name,
          confidence: s.confidence,
          evidence: s.evidence,
        })),
        unmatchedSkills: (fullAnalysis.unmatchedSkills || []).map(u => ({
          name: u.name,
          confidence: u.confidence,
          evidence: u.evidence,
        })),
        timing: fullAnalysis.timing || {},
        analyzedAt: new Date().toISOString(),
      };

      await pool.query(
        `UPDATE certificates
         SET verification_evidence = COALESCE(verification_evidence, '{}'::jsonb) || jsonb_build_object('skillAnalysis', $1::jsonb)
         WHERE id = $2 AND student_id = $3`,
        [JSON.stringify(skillEvidencePayload), certificateId, studentId]
      );
    } catch (evErr) {
      console.warn(`Warning updating verification_evidence for certificate ${certificateId}:`, evErr.message);
    }
  }

  return {
    insertedCount,
    durationMs: Date.now() - start,
  };
}

module.exports = {
  AI_TIMEOUT_MS,
  CONFIDENCE_THRESHOLD,
  isGeminiConfigured,
  getGeminiModel,
  callGeminiSkillAnalysis,
  isOpenAIConfigured,
  getOpenAIModel,
  normalizeText,
  validateEvidenceAgainstRawText,
  extractEvidenceFromText,
  extractCandidateSkills,
  matchSkillsToTaxonomy,
  analyzeCertificateSkills,
  saveCertificateSkills,
};
