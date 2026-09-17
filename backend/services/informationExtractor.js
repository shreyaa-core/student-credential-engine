// ==============================================================================
// Student Micro-Credential Verification Engine - Information Extractor Service
// ==============================================================================

/**
 * 1. Extract Student Name using common certificate phrasing
 * Looks for patterns like "certify that [Name] has", "awarded to [Name]", etc.
 */
function extractStudentName(text) {
  const patterns = [
    // Matches "certify that Jane Doe has" or "awarded to John Doe for"
    /(?:this is to certify that|certifies that|proudly presented to|presented to|awarded to)\s+([A-Za-z'.\-]+(?:\s+[A-Za-z'.\-]+){0,3}?)(?=\s+(?:has|for|in|on|\r|\n|$))/i,
    // Matches explicit "Name: Jane Doe"
    /(?:student(?:\s*name)?|recipient(?:\s*name)?|name)\s*[:\-]\s*([A-Za-z'.\-]+(?:\s+[A-Za-z'.\-]+){1,3})/i,
    // Multiline: "presented to" followed by the student name on the next line
    /(?:presented to|awarded to|certifies that)\s*[\r\n]+\s*([A-Z][a-zA-Z'.\-]+(?:\s+[A-Z][a-zA-Z'.\-]+){1,3})/i,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const cleanName = match[1].trim();
      // Filter out non-names
      if (cleanName.length > 2 && !/^(has|for|in|the|a|an|successful|completion)$/i.test(cleanName)) {
        return cleanName;
      }
    }
  }

  return '';
}

/**
 * 2. Extract Course or Program Name
 */
function extractCourseName(text) {
  const patterns = [
    // Matches "completed the course Full-Stack Web Development"
    /(?:has successfully completed(?:\s+the)?(?:\s+course)?|for completing(?:\s+the)?(?:\s+course)?|completion of(?:\s+the)?(?:\s+course)?|course in|certificate in)\s+["“]?([^"\n\r]+?)(?=["”\r\n]|$)/i,
    // Matches "Course: Data Structures" or "Program: Cloud Architecture"
    /(?:course(?:\s*title)?|program(?:\s*title)?|specialization)\s*[:\-]\s*([^\n\r,]+)/i,
    // Matches "credential in Cloud Computing"
    /(?:credential in|certified as(?:\s+a)?)\s+([^\n\r,]+)/i,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      let course = match[1].trim();
      // Strip trailing filler words like "Issued by", "on", "at"
      course = course.replace(/\s+(on|at|with|issued|date|by|grade).*$/i, '').trim();
      // Strip leading "the course" if still present
      course = course.replace(/^the\s+course\s+/i, '').trim();
      if (course.length > 2 && course.length < 100) {
        return course;
      }
    }
  }

  return '';
}

/**
 * 3. Extract Issuing Organization / Authority
 */
function extractIssuer(text) {
  // Check explicit phrases like "Issued by MIT", "Offered by Stanford"
  const explicitPatterns = [
    /(?:issued by|offered by|authorized by|institution|organization|provider)\s*[:\-]?\s*([A-Za-z0-9&.\- ]{3,50})/i,
    /(?:university of [A-Za-z ]+|[A-Za-z ]+ university|[A-Za-z ]+ institute of technology)/i,
  ];

  for (const regex of explicitPatterns) {
    const match = text.match(regex);
    if (match) {
      const matchedText = (match[1] || match[0]).trim();
      return matchedText.replace(/\s+(date|on|verify|id).*$/i, '').trim();
    }
  }

  // Check for prominent known educational platforms
  const knownIssuers = [
    'MIT Open Learning',
    'Stanford Online',
    'Harvard University',
    'Coursera',
    'edX',
    'Udacity',
    'Udemy',
    'freeCodeCamp',
    'Google',
    'Microsoft',
    'IBM',
    'Amazon Web Services',
    'AWS',
  ];

  for (const issuer of knownIssuers) {
    const regex = new RegExp(`\\b${issuer}\\b`, 'i');
    if (regex.test(text)) {
      return issuer;
    }
  }

  return '';
}

/**
 * 4. Extract Certificate ID / Credential Code
 */
function extractCertificateId(text) {
  const patterns = [
    // Certificate ID: CERT-123456 or Credential ID: 90a1b2c3d4
    /(?:certificate\s*(?:id|no|number|code)|credential\s*id|verify\s*code|serial\s*number)\s*[:#\-]?\s*([a-zA-Z0-9\-_]{6,})/i,
    // UUID v4 format: 123e4567-e89b-12d3-a456-426614174000
    /\b([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\b/,
    // Hex hash format: 0x90a1b2c3d4e5f6...
    /\b(0x[0-9a-fA-F]{10,64})\b/,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return '';
}

/**
 * 5. Extract Issue Date
 */
function extractIssueDate(text) {
  const patterns = [
    // Preceded by "Issue Date:", "Date:", "Issued on:"
    /(?:issue\s*date|date\s*of\s*issue|issued\s*on|date)\s*[:\-]?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    // Month DD, YYYY (e.g. March 15, 2026 or Mar 15, 2026)
    /\b((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4})\b/i,
    // YYYY-MM-DD (e.g. 2026-03-15)
    /\b(\d{4}-\d{2}-\d{2})\b/,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return '';
}

/**
 * Main Extraction Function: extractCertificateInfo(text)
 * 
 * Converts raw certificate text into structured JSON metadata.
 * 
 * @param {string} text - Raw text extracted from PDF or OCR
 * @returns {{
 *   studentName: string,
 *   courseName: string,
 *   issuer: string,
 *   certificateId: string,
 *   issueDate: string
 * }}
 */
function extractCertificateInfo(text = '') {
  if (!text || typeof text !== 'string') {
    return {
      studentName: '',
      courseName: '',
      issuer: '',
      certificateId: '',
      issueDate: '',
    };
  }

  return {
    studentName: extractStudentName(text),
    courseName: extractCourseName(text),
    issuer: extractIssuer(text),
    certificateId: extractCertificateId(text),
    issueDate: extractIssueDate(text),
  };
}

module.exports = {
  extractCertificateInfo,
  extractStudentName,
  extractCourseName,
  extractIssuer,
  extractCertificateId,
  extractIssueDate,
};
