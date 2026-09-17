// ==============================================================================
// Student Micro-Credential Verification Engine - Skill Mapping Service
// ==============================================================================

/**
 * Keyword to Skill dictionary mapping.
 * Defines target competencies and associated keyword triggers.
 */
const SKILL_RULES = [
  {
    skill: 'Python',
    keywords: ['python'],
    regex: /\bpython\b/i,
  },
  {
    skill: 'Machine Learning',
    keywords: ['machine learning'],
    regex: /\bmachine\s+learning\b/i,
  },
  {
    skill: 'Deep Learning',
    keywords: ['deep learning'],
    regex: /\bdeep\s+learning\b/i,
  },
  {
    skill: 'SQL',
    keywords: ['sql', 'mysql', 'postgresql'],
    regex: /\b(?:sql|mysql|postgresql)\b/i,
  },
  {
    skill: 'React',
    keywords: ['react'],
    regex: /\breact(?:\.js)?\b/i,
  },
  {
    skill: 'JavaScript',
    keywords: ['javascript'],
    regex: /\b(?:javascript|js)\b/i,
  },
];

/**
 * Maps a course name to an array of relevant skills based on keyword rules.
 * 
 * @param {string} courseName - Name of the course or credential (e.g., "Machine Learning with Python")
 * @returns {string[]} - Array of matching skill names (e.g., ["Machine Learning", "Python"])
 */
function mapSkillsFromCourse(courseName = '') {
  // Return empty array for invalid or non-string inputs
  if (!courseName || typeof courseName !== 'string') {
    return [];
  }

  const normalizedText = courseName.toLowerCase();
  const matchedSkills = [];

  for (const rule of SKILL_RULES) {
    // Check keyword containment or word-boundary regex match
    const containsKeyword = rule.keywords.some((kw) => normalizedText.includes(kw));
    const matchesRegex = rule.regex ? rule.regex.test(normalizedText) : false;

    if (containsKeyword || matchesRegex) {
      // Find the first index where the skill appears in the course name
      let firstIndex = -1;
      for (const kw of rule.keywords) {
        const idx = normalizedText.indexOf(kw);
        if (idx !== -1 && (firstIndex === -1 || idx < firstIndex)) {
          firstIndex = idx;
        }
      }

      matchedSkills.push({
        skill: rule.skill,
        index: firstIndex !== -1 ? firstIndex : 999,
      });
    }
  }

  // Sort matched skills by their appearance order in the course name
  matchedSkills.sort((a, b) => a.index - b.index);

  // Return unique skill names
  return [...new Set(matchedSkills.map((item) => item.skill))];
}

module.exports = {
  mapSkillsFromCourse,
  mapCourseToSkills: mapSkillsFromCourse,
  mapSkills: mapSkillsFromCourse,
  SKILL_RULES,
};
