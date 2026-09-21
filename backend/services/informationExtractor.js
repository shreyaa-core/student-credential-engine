// ==============================================================================
// Student Micro-Credential & Skill Verification Engine - Information Extractor
// ==============================================================================

/**
 * Generic headings that must NOT be selected as a course/certificate title
 */
const GENERIC_HEADINGS = [
  /^certificate\s+of\s+completion$/i,
  /^certificate\s+of\s+achievement$/i,
  /^certificate\s+of\s+excellence$/i,
  /^certificate\s+of\s+participation$/i,
  /^certificate\s+of\s+appreciation$/i,
  /^certificate\s+of\s+attendance$/i,
  /^certificate\s+of\s+recognition$/i,
  /^certificate$/i,
  /^verified\s+certificate$/i,
  /^statement\s+of\s+accomplishment$/i,
  /^course\s+certificate$/i,
];

function isGenericTitle(str) {
  if (!str) return true;
  const clean = str.trim();
  return GENERIC_HEADINGS.some((regex) => regex.test(clean));
}

/**
 * 1. Normalize Date to YYYY-MM-DD
 * Parses various date formats reliably:
 * - "YYYY-MM-DD"
 * - "Month DD, YYYY" / "Month DD YYYY"
 * - "DD Month YYYY"
 * - "YYYY/MM/DD"
 * Returns null if parsing is unreliable or out of sensible range.
 */
function normalizeDate(rawDateStr) {
  if (!rawDateStr || typeof rawDateStr !== 'string') return null;

  const cleaned = rawDateStr.trim().replace(/^[,\-:\s]+|[,\-:\s]+$/g, '');
  if (!cleaned) return null;

  // 1. Direct YYYY-MM-DD or YYYY/MM/DD format
  const isoMatch = cleaned.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (year >= 1970 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 2. DD Month YYYY (e.g. 24 June 2025 or 15 Mar 2026)
  const dmyMatch = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const monthName = dmyMatch[2];
    const year = parseInt(dmyMatch[3], 10);
    const parsedMonth = new Date(`${monthName} 1, 2000`).getMonth();
    if (!isNaN(parsedMonth) && year >= 1970 && year <= 2100 && day >= 1 && day <= 31) {
      return `${year}-${String(parsedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 3. Month DD, YYYY (e.g. March 15, 2026 or Mar 15, 2026)
  const mdyMatch = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (mdyMatch) {
    const monthName = mdyMatch[1];
    const day = parseInt(mdyMatch[2], 10);
    const year = parseInt(mdyMatch[3], 10);
    const parsedMonth = new Date(`${monthName} 1, 2000`).getMonth();
    if (!isNaN(parsedMonth) && year >= 1970 && year <= 2100 && day >= 1 && day <= 31) {
      return `${year}-${String(parsedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 4. Standard Date parsing fallback
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = parsed.getMonth() + 1;
    const day = parsed.getDate();
    if (year >= 1970 && year <= 2100) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * 2. Extract Student Name using common certificate phrasing
 */
function extractStudentName(text) {
  if (!text) return null;

  const patterns = [
    // Matches "certify that Jane Doe has" or "awarded to John Doe for"
    /(?:this\s+is\s+to\s+certify\s+that|certifies\s+that|proudly\s+presented\s+to|presented\s+to|awarded\s+to)\s+([A-Za-z'.\-]+(?:\s+[A-Za-z'.\-]+){0,3}?)(?=\s+(?:has|for|in|on|\r|\n|$))/i,
    // Matches explicit "Name: Jane Doe"
    /(?:student(?:\s*name)?|recipient(?:\s*name)?|name)\s*[:\-]\s*([A-Za-z'.\-]+(?:\s+[A-Za-z'.\-]+){1,3})/i,
    // Multiline: "presented to" followed by the student name on the next line
    /(?:presented\s+to|awarded\s+to|certifies\s+that|certify\s+that)\s*[\r\n]+\s*([A-Z][a-zA-Z'.\-]+(?:\s+[A-Z][a-zA-Z'.\-]+){1,3})/i,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const cleanName = match[1].trim();
      if (cleanName.length > 2 && !/^(has|for|in|the|a|an|successful|completion)$/i.test(cleanName)) {
        return cleanName;
      }
    }
  }

  return null;
}

/**
 * 3. Extract Course or Program Name (Certificate Name)
 * Avoids generic headings like "CERTIFICATE OF COMPLETION"
 */
function extractCourseName(text) {
  if (!text) return null;

  const patterns = [
    // Matches "has successfully completed [the course] Full-Stack Web Development"
    /(?:has\s+successfully\s+completed(?:\s+the)?(?:\s+course)?|for\s+completing(?:\s+the)?(?:\s+course)?|completion\s+of(?:\s+the)?(?:\s+course)?|for\s+successful\s+completion\s+of)\s+["“]?([^"\n\r]+?)(?=["”\r\n]|$)/i,
    // Multiline: "has successfully completed" on one line, course name on next line
    /(?:has\s+successfully\s+completed|for\s+completing|awarded\s+for\s+completing)\s*[\r\n]+\s*["“]?([^\r\n"“”]+)/i,
    // Matches "Course: Data Structures" or "Program: Cloud Architecture"
    /(?:course(?:\s*title)?|program(?:\s*title)?|specialization(?:\s*name)?)\s*[:\-]\s*["“]?([^\n\r,]+)/i,
    // Matches "credential in Cloud Computing"
    /(?:credential\s+in|course\s+in|certified\s+as(?:\s+a)?)\s+["“]?([^\n\r,]+)/i,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      let course = match[1].trim();
      // Strip trailing filler words
      course = course.replace(/\s+(on|at|with|issued|date|by|grade|during|from).*$/i, '').trim();
      // Strip leading "the course"
      course = course.replace(/^the\s+course\s+/i, '').trim();
      // Strip quotes
      course = course.replace(/^[“"']+|[”"']+$/g, '').trim();

      if (!isGenericTitle(course) && course.length > 2 && course.length < 120) {
        return course;
      }
    }
  }

  // Fallback: If line-based structure exists (e.g. "CERTIFICATE OF COMPLETION\n<Course Title>\nIssued to...")
  const lines = text.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isGenericTitle(line)) {
      // Check candidate line right below generic heading
      for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j++) {
        const candidate = lines[j];
        if (
          !isGenericTitle(candidate) &&
          !/(?:issued\s+to|presented\s+to|awarded\s+to|this\s+is\s+to|certifies\s+that|accredited\s+by|authorized\s+by)/i.test(candidate) &&
          candidate.length > 3 &&
          candidate.length < 120
        ) {
          return candidate;
        }
      }
    }
  }

  return null;
}

/**
 * 4. Extract Issuing Organization / Authority
 * Detects explicit phrases and matches recognized providers.
 */
function extractIssuer(text) {
  if (!text) return null;

  // Check explicit phrases like "Issued by MIT", "Offered by Stanford"
  const explicitPatterns = [
    /(?:issued\s+by|presented\s+by|provided\s+by|offered\s+by|authorized\s+by)\s*[:\-]?\s*([A-Za-z0-9&.\- ]{3,50})/i,
    /(?:institution|organization|provider)\s*[:\-]?\s*([A-Za-z0-9&.\- ]{3,50})/i,
    /(?:university\s+of\s+[A-Za-z ]+|[A-Za-z ]+\s+university|[A-Za-z ]+\s+institute\s+of\s+technology)/i,
  ];

  for (const regex of explicitPatterns) {
    const match = text.match(regex);
    if (match) {
      const matchedText = (match[1] || match[0]).trim();
      const cleaned = matchedText.replace(/\s+(date|on|verify|id|certificate).*$/i, '').trim();
      if (cleaned.length > 2) {
        return cleaned;
      }
    }
  }

  // Check for prominent known educational platforms & universities
  const knownIssuers = [
    'Coursera',
    'NPTEL',
    'edX',
    'Credly',
    'Accredible',
    'Udacity',
    'Udemy',
    'freeCodeCamp',
    'Google',
    'Microsoft',
    'IBM',
    'Amazon Web Services',
    'AWS',
    'MIT Open Learning',
    'Stanford Online',
    'Harvard University',
  ];

  for (const issuer of knownIssuers) {
    const regex = new RegExp(`\\b${issuer}\\b`, 'i');
    if (regex.test(text)) {
      return issuer;
    }
  }

  return null;
}

/**
 * 5. Extract Certificate ID / Credential Code
 * Supports:
 * - Certificate ID:
 * - Credential ID:
 * - Certificate No:
 * - Certificate Number:
 * - Credential Number:
 * - Verification ID:
 * - Serial Number:
 * - UUID v4 & Hex hashes
 */
function extractCertificateId(text) {
  if (!text) return null;

  const patterns = [
    // Labeled identifiers
    /(?:certificate\s*(?:id|no|number|code)|credential\s*(?:id|no|number|code)|verification\s*(?:id|code|no|number)|serial\s*(?:number|no))\s*[:#\-]?\s*([a-zA-Z0-9\-_]{4,})/i,
    // UUID v4 format: 123e4567-e89b-12d3-a456-426614174000
    /\b([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\b/,
    // Hex hash format: 0x90a1b2c3d4e5f6...
    /\b(0x[0-9a-fA-F]{10,64})\b/,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const cleanId = match[1].trim().replace(/[.,;:]+$/, '');
      if (cleanId.length >= 4) {
        return cleanId;
      }
    }
  }

  return null;
}

/**
 * 6. Extract Issue Date
 * Supports:
 * - Issued: / Issued on:
 * - Issue Date: / Date of Issue:
 * - Completed: / Completed on:
 * - Awarded: / Awarded on:
 * - Date:
 * Normalizes to YYYY-MM-DD.
 */
function extractIssueDate(text) {
  if (!text) return null;

  const patterns = [
    // Preceded by standard date labels
    /(?:issue\s*date|date\s*of\s*issue|issued\s*(?:on)?|completed\s*(?:on)?|awarded\s*(?:on)?|date)\s*[:\-]?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    // Standalone Month DD, YYYY
    /\b((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4})\b/i,
    // Standalone DD Month YYYY
    /\b(\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4})\b/i,
    // Standalone YYYY-MM-DD
    /\b(\d{4}-\d{2}-\d{2})\b/,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const normalized = normalizeDate(match[1]);
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}

/**
 * 7. Extract Verification URL
 * Finds URLs in text, prioritizing those containing verification-related keywords.
 */
function extractVerificationUrl(text) {
  if (!text) return null;

  const urlRegex = /(https?:\/\/[^\s"'<>]+)/gi;
  const matches = text.match(urlRegex);
  if (!matches || matches.length === 0) {
    return null;
  }

  const cleanedUrls = matches
    .map((u) => u.replace(/[.,;:)\]}>]+$/, '').trim())
    .filter((u) => u.length > 8 && !u.includes('localhost') && !u.includes('127.0.0.1'));

  if (cleanedUrls.length === 0) return null;

  // Prioritize URLs containing verify / verification / credential / certificate
  const prioritized = cleanedUrls.find((u) =>
    /(?:verify|verification|credential|certificate)/i.test(u)
  );

  return prioritized || cleanedUrls[0] || null;
}

/**
 * Main Extraction Function: extractCertificateInfo(text)
 * 
 * Converts raw certificate text into structured metadata.
 * Returns null for missing fields (never fake placeholders).
 * Supports both snake_case and camelCase for clean backward-compatibility.
 * 
 * @param {string} text - Raw text extracted from PDF or OCR
 * @returns {{
 *   certificate_name: string|null,
 *   courseName: string|null,
 *   issuer: string|null,
 *   certificate_id: string|null,
 *   certificateId: string|null,
 *   issue_date: string|null,
 *   issueDate: string|null,
 *   verification_url: string|null,
 *   verificationUrl: string|null,
 *   student_name: string|null,
 *   studentName: string|null
 * }}
 */
function extractCertificateInfo(text = '') {
  if (!text || typeof text !== 'string') {
    return {
      certificate_name: null,
      courseName: null,
      issuer: null,
      certificate_id: null,
      certificateId: null,
      issue_date: null,
      issueDate: null,
      verification_url: null,
      verificationUrl: null,
      student_name: null,
      studentName: null,
    };
  }

  const studentName = extractStudentName(text);
  const courseName = extractCourseName(text);
  const issuer = extractIssuer(text);
  const certificateId = extractCertificateId(text);
  const issueDate = extractIssueDate(text);
  const verificationUrl = extractVerificationUrl(text);

  return {
    certificate_name: courseName,
    courseName: courseName,
    issuer: issuer,
    certificate_id: certificateId,
    certificateId: certificateId,
    issue_date: issueDate,
    issueDate: issueDate,
    verification_url: verificationUrl,
    verificationUrl: verificationUrl,
    student_name: studentName,
    studentName: studentName,
  };
}

module.exports = {
  extractCertificateInfo,
  extractStudentName,
  extractCourseName,
  extractIssuer,
  extractCertificateId,
  extractIssueDate,
  extractVerificationUrl,
  normalizeDate,
  isGenericTitle,
};
