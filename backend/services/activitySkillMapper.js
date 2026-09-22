// ==============================================================================
// Student Micro-Credential Verification Engine - Activity Skill Mapper Service
// ==============================================================================

const pool = require('../config/database');

/**
 * Deterministic mapping rules for canonical skills in the master taxonomy.
 * Each rule defines targeted regex patterns and associated confidence levels.
 */
const TAXONOMY_RULES = [
  {
    skillName: 'Python',
    patterns: [
      { regex: /\bpython3?\b/i, confidence: 95 },
      { regex: /\b(?:pandas|numpy|flask|django|fastapi)\b/i, confidence: 85 },
      { regex: /\bpy\b/i, confidence: 65 }
    ]
  },
  {
    skillName: 'JavaScript',
    patterns: [
      { regex: /\b(?:javascript|ecmascript)\b/i, confidence: 95 },
      { regex: /(?<!(?:node|react|vue|next)[\.\s_-]*)\b(?:js|vanilla\s+js)\b/i, confidence: 80 }
    ]
  },
  {
    skillName: 'React',
    patterns: [
      { regex: /\b(?:react(?:\.js)?|reactjs|jsx)\b/i, confidence: 95 },
      { regex: /\breact\b/i, confidence: 90 }
    ]
  },
  {
    skillName: 'Node.js',
    patterns: [
      { regex: /\b(?:node\.?js|nodejs)\b/i, confidence: 95 },
      { regex: /\bexpress(?:\.js)?\b/i, confidence: 85 }
    ]
  },
  {
    skillName: 'SQL',
    patterns: [
      { regex: /\b(?:sql|postgresql|postgres|mysql|sqlite|pl\/sql)\b/i, confidence: 95 },
      { regex: /\b(?:relational\s+database|database\s+queries?)\b/i, confidence: 80 }
    ]
  },
  {
    skillName: 'Machine Learning',
    patterns: [
      { regex: /\bmachine\s+learning\b/i, confidence: 95 },
      { regex: /\b(?:scikit-learn|supervised\s+learning|unsupervised\s+learning|random\s+forest|clustering|classification\s+model|regression\s+model)\b/i, confidence: 85 },
      { regex: /\bml\b/i, confidence: 70 }
    ]
  },
  {
    skillName: 'Deep Learning',
    patterns: [
      { regex: /\bdeep\s+learning\b/i, confidence: 95 },
      { regex: /\b(?:neural\s+networks?|convolutional\s+neural\s+network|cnn|rnn|lstm|transformer|transformers|pytorch|tensorflow|keras)\b/i, confidence: 90 }
    ]
  }
];

/**
 * Helper to extract a surrounding context snippet for auditability and evidence.
 *
 * @param {string} fullText - The full concatenated text
 * @param {number} matchIndex - Starting index of the matched substring
 * @param {number} matchLength - Length of matched substring
 * @returns {string} - Clean contextual evidence snippet
 */
function extractEvidenceSnippet(fullText, matchIndex, matchLength) {
  const start = Math.max(0, matchIndex - 35);
  const end = Math.min(fullText.length, matchIndex + matchLength + 45);
  let snippet = fullText.substring(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < fullText.length) snippet = snippet + '...';
  return snippet;
}

/**
 * Analyzes activity text (title, activity_type, organizer, description)
 * and maps it against canonical skills present in the PostgreSQL skills table.
 *
 * NOTE: The taxonomy in PostgreSQL `skills` table is authoritative.
 * Non-taxonomy terms (e.g. Leadership, Public Speaking) are ignored.
 * The `skills` table is NEVER mutated by this mapper.
 *
 * @param {object} activityData - { title, activity_type, organizer, description }
 * @param {object} dbClient - PostgreSQL client or pool for transactional queries
 * @returns {Promise<Array<{ skill_id: string, skill_name: string, category: string, confidence_score: number, evidence_text: string }>>}
 */
async function mapSkillsForActivity(
  { title = '', activity_type = '', organizer = '', description = '' } = {},
  dbClient = pool
) {
  // 1. Fetch authorized taxonomy skills directly from PostgreSQL
  const dbRes = await dbClient.query('SELECT id, name, category FROM skills');
  const canonicalSkills = dbRes.rows || [];

  const skillNameToRow = new Map();
  for (const s of canonicalSkills) {
    skillNameToRow.set(s.name.toLowerCase().trim(), s);
  }

  // 2. Prepare combined search text
  const combinedText = [title, activity_type, organizer, description]
    .filter(Boolean)
    .join('\n')
    .trim();

  if (!combinedText) {
    return [];
  }

  const mapped = [];

  // 3. Match against taxonomy rules
  for (const rule of TAXONOMY_RULES) {
    const canonicalRow = skillNameToRow.get(rule.skillName.toLowerCase());
    // If the skill is not in the database catalog, skip completely (never invent skills)
    if (!canonicalRow) {
      continue;
    }

    let highestConfidence = 0;
    let bestEvidence = '';

    for (const pat of rule.patterns) {
      const match = pat.regex.exec(combinedText);
      if (match) {
        if (pat.confidence > highestConfidence) {
          highestConfidence = pat.confidence;
          bestEvidence = extractEvidenceSnippet(combinedText, match.index, match[0].length);
        }
      }
    }

    // Strict threshold >= 60
    if (highestConfidence >= 60) {
      mapped.push({
        skill_id: canonicalRow.id,
        skill_name: canonicalRow.name,
        category: canonicalRow.category,
        confidence_score: highestConfidence,
        evidence_text: bestEvidence || `Matched technical keyword for ${rule.skillName}`
      });
    }
  }

  return mapped;
}

module.exports = {
  TAXONOMY_RULES,
  mapSkillsForActivity,
  extractEvidenceSnippet
};
