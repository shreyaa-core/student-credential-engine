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
  /^certificate\s+of\s+training$/i,
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
 * - "YYYY-MM-DD" / "YYYY/MM/DD"
 * - "DD.MM.YYYY" / "DD/MM/YYYY" / "DD-MM-YYYY"
 * - "Month DD, YYYY" / "Month DD YYYY"
 * - "DD Month YYYY"
 * - "Month YYYY" (defaults to 1st of month)
 */
function normalizeDate(rawDateStr) {
  if (!rawDateStr || typeof rawDateStr !== 'string') return null;

  const cleaned = rawDateStr.trim().replace(/^[,\-:\s]+|[,\-:\s]+$/g, '');
  if (!cleaned) return null;

  // 1. Direct YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const isoMatch = cleaned.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (year >= 1970 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 2. DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  const dmyNumericMatch = cleaned.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyNumericMatch) {
    const day = parseInt(dmyNumericMatch[1], 10);
    const month = parseInt(dmyNumericMatch[2], 10);
    const year = parseInt(dmyNumericMatch[3], 10);
    if (year >= 1970 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 3. DD Month YYYY (e.g. 24 June 2025, 14 April 2025, 15 Mar 2026)
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

  // 4. Month DD, YYYY (e.g. May 14, 2013, March 15, 2026, Sept 15, 2024)
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

  // 5. Month YYYY (e.g. September 2026)
  const myMatch = cleaned.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (myMatch) {
    const monthName = myMatch[1];
    const year = parseInt(myMatch[2], 10);
    const parsedMonth = new Date(`${monthName} 1, 2000`).getMonth();
    if (!isNaN(parsedMonth) && year >= 1970 && year <= 2100) {
      return `${year}-${String(parsedMonth + 1).padStart(2, '0')}-01`;
    }
  }

  // 6. Standard Date parsing fallback
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
 * Clean course title helper: strips trailing OCR garbage tokens and metadata
 */
function cleanCandidateTitle(raw) {
  if (!raw) return null;
  let title = raw.trim();
  // Strip quotes
  title = title.replace(/^[“"']+|[”"']+$/g, '').trim();
  // Strip leading "the course" or "the program"
  title = title.replace(/^the\s+(?:course|program|specialization)\s+(?:in|on|of)?\s*/i, '').trim();
  // Strip trailing metadata or OCR garbage like "Time: ...", "Grade: ...", "“lcoursera)-", "el /", "XN 0)", "7 =", "7 5)"
  title = title.replace(/\s+(?:time|hours|grade|during|from|issued|date|by|authorized|in\s+collaboration).*$/i, '').trim();
  title = title.replace(/\s+[“"'\(\[]+l?coursera[\)\]”"'\-_]*$/i, '').trim();
  title = title.replace(/\s+[a-zA-Z0-9]{1,2}\s+[\\\/|~=+\-_()]+.*$/, '').trim();
  title = title.replace(/\s+[0-9a-zA-Z\s]{1,4}[)\]}>]$/, '').trim();
  title = title.replace(/\s+[\\\/|~=+\-_()]+.*$/, '').trim();
  title = title.replace(/\s+[a-zA-Z0-9]{1,2}$/, '').trim();
  title = title.replace(/\s+[a-zA-Z0-9]{1,2}$/, '').trim();
  title = title.replace(/^[,\-:\s]+|[,\-:\s]+$/g, '').trim();

  // Ensure title contains at least one meaningful word (>= 3 alpha letters)
  const hasWord = /[a-zA-Z]{3,}/.test(title);
  const alphaCount = (title.match(/[a-zA-Z]/g) || []).length;
  const symbolCount = (title.match(/[^a-zA-Z0-9\s]/g) || []).length;

  if (hasWord && alphaCount >= 4 && alphaCount > symbolCount && !isGenericTitle(title) && title.length >= 3 && title.length < 120) {
    return title;
  }
  return null;
}

/**
 * 3. Extract Course or Program Name (Certificate Name)
 * Avoids generic headings like "CERTIFICATE OF COMPLETION"
 */
function extractCourseName(text) {
  if (!text) return null;

  // 1. Explicit labeled course headings: "Course: Python Basics", "Program: ...", "Specialization: ..."
  const labeledMatch = text.match(/(?:course(?:\s*name|\s*title)?|program(?:\s*name|\s*title)?|specialization(?:\s*name)?|certificate(?:\s*title)?)\s*[:\-]\s*["“]?([^\n\r,;]+)/i);
  if (labeledMatch && labeledMatch[1]) {
    const cleaned = cleanCandidateTitle(labeledMatch[1]);
    if (cleaned) return cleaned;
  }

  // 2. Preceding "an online non-credit course authorized by..." or "an online course offered by..."
  const onlineCoursePreceding = text.match(/([A-Za-z0-9\s\-',:&]{4,100}?)\s*[\r\n]+\s*(?:an\s+online\s+(?:non-credit\s+)?course|a\s+course\s+authorized\s+by)/i);
  if (onlineCoursePreceding && onlineCoursePreceding[1]) {
    const cleaned = cleanCandidateTitle(onlineCoursePreceding[1]);
    if (cleaned) return cleaned;
  }

  // 3. Multiline & inline completion phrases:
  // "has successfully completed [the requirements for] <Title>"
  const completionLines = [
    /(?:has\s+successfully\s+completed|successfully\s+completed|for\s+completing|completed\s+the\s+course|completion\s+of|awarded\s+for\s+completing)\s*(?:(?:all\s+)?the\s+requirements\s+for|(?:the\s+online\s+)?course)?\s*[:\-]?\s*([^\n\r]*)/i,
  ];

  for (const regex of completionLines) {
    const match = text.match(regex);
    if (match) {
      const remainderOnSameLine = (match[1] || '').trim();
      const cleanedSameLine = cleanCandidateTitle(remainderOnSameLine);
      if (cleanedSameLine && cleanedSameLine.length > 5) {
        return cleanedSameLine;
      }

      // If remainder is empty or noise (e.g. "A i", "an online course"), check the following lines
      const matchIndex = match.index + match[0].length;
      const textAfter = text.slice(matchIndex);
      const followingLines = textAfter.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);

      for (let i = 0; i < Math.min(6, followingLines.length); i++) {
        const candidate = followingLines[i];
        if (
          !isGenericTitle(candidate) &&
          !/(?:issued|date\s*:|verify|credential\s*id|professor|instructor|authorized\s*by|identity\s*of|international\s*research|executive\s*director)/i.test(candidate)
        ) {
          const cleanedNextLine = cleanCandidateTitle(candidate);
          if (cleanedNextLine) {
            return cleanedNextLine;
          }
        }
      }
    }
  }

  // 4. Phrases like "credential in Cloud Computing" or "certificate for..."
  const credentialInMatch = text.match(/(?:credential\s+in|course\s+in|certified\s+as(?:\s+a)?|program\s+in|certificate\s+for)\s+["“]?([^\n\r,]+)/i);
  if (credentialInMatch && credentialInMatch[1]) {
    const cleaned = cleanCandidateTitle(credentialInMatch[1]);
    if (cleaned) return cleaned;
  }

  // 5. Fallback: If line-based structure exists (e.g. "CERTIFICATE OF COMPLETION\n<Course Title>\nIssued to...")
  const lines = text.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isGenericTitle(line)) {
      for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
        const candidate = lines[j];
        if (
          !isGenericTitle(candidate) &&
          !/(?:issued\s+to|presented\s+to|awarded\s+to|this\s+is\s+to|certifies\s+that|accredited\s+by|authorized\s+by|may|june|july|august|september|october|november|december|january|february|march|april)/i.test(candidate)
        ) {
          const cleaned = cleanCandidateTitle(candidate);
          if (cleaned) return cleaned;
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

  // 1. Check prominent known educational platforms & universities
  const knownIssuers = [
    { name: 'Coursera', regex: /\b(?:coursera|courvera)\b/i },
    { name: 'NPTEL', regex: /\bnptel\b/i },
    { name: 'edX', regex: /\bedx\b/i },
    { name: 'Credly', regex: /\bcredly\b/i },
    { name: 'Accredible', regex: /\baccredible\b/i },
    { name: 'Udacity', regex: /\budacity\b/i },
    { name: 'Udemy', regex: /\budemy\b/i },
    { name: 'freeCodeCamp', regex: /\bfreecodecamp\b/i },
    { name: 'Google', regex: /\bgoogle\b/i },
    { name: 'Microsoft', regex: /\bmicrosoft\b/i },
    { name: 'IBM', regex: /\bibm\b/i },
    { name: 'Amazon Web Services', regex: /\b(?:amazon\s+web\s+services|aws)\b/i },
    { name: 'MIT Open Learning', regex: /\b(?:mit\s+open\s+learning|massachusetts\s+institute\s+of\s+technology)\b/i },
    { name: 'Stanford Online', regex: /\bstanford(?:\s+online)?\b/i },
    { name: 'Harvard University', regex: /\bharvard(?:\s+university)?\b/i },
    { name: 'University of Pennsylvania', regex: /\b(?:university\s+of\s+pennsylvania|penn)\b/i },
    { name: 'DeepLearning.AI', regex: /\bdeeplearning\.ai\b/i },
    { name: 'Meta', regex: /\bmeta\b/i },
  ];

  for (const { name, regex } of knownIssuers) {
    if (regex.test(text)) {
      return name;
    }
  }

  // 2. Check explicit phrases like "Issued by MIT", "Offered by Stanford", "In collaboration with ITM"
  const explicitPatterns = [
    /(?:issued\s+by|presented\s+by|provided\s+by|offered\s+by|authorized\s+by|certified\s+by|in\s+collaboration\s+with)\s*[:\-]?\s*([A-Za-z0-9&.\- ]{3,50})/i,
    /(?:institution|organization|provider|issuing\s+authority|platform)\s*[:\-]?\s*([A-Za-z0-9&.\- ]{3,50})/i,
    /(?:university\s+of\s+[A-Za-z ]+|[A-Za-z ]+\s+university|[A-Za-z ]+\s+institute\s+of\s+technology)/i,
  ];

  for (const regex of explicitPatterns) {
    const match = text.match(regex);
    if (match) {
      const matchedText = (match[1] || match[0]).trim();
      const cleaned = matchedText.replace(/\s+(?:date|on|verify|id|certificate|transforming).*$/i, '').trim();
      if (cleaned.length > 2 && !/^(the|an|a|this|for)$/i.test(cleaned)) {
        return cleaned;
      }
    }
  }

  return null;
}

/**
 * 5. Extract Verification URL
 * Normalizes OCR spacing and misrecognitions, prioritizing verify/credential paths.
 */
function extractVerificationUrl(text) {
  if (!text) return null;

  // 1. Standard URL extraction if explicit http/https URL exists
  const urlRegex = /(https?:\/\/[^\s"'<>]+)/gi;
  const matches = text.match(urlRegex);
  if (matches && matches.length > 0) {
    const cleanedUrls = matches
      .map((u) => u.replace(/[.,;:)\]}>]+$/, '').trim())
      .filter((u) => u.length > 8 && !u.includes('localhost') && !u.includes('127.0.0.1'));

    if (cleanedUrls.length > 0) {
      const prioritized = cleanedUrls.find((u) =>
        /(?:verify|verification|credential|certificate|accomplishments|badges)/i.test(u)
      );
      if (prioritized) return prioritized;
      return cleanedUrls[0];
    }
  }

  // 2. Check for Coursera verification URL patterns (handling OCR noise like courvera, vertfy, verlfy, verily, verity, spaces)
  const courseraPattern = /(?:verify\s+(?:at|ot)[\s\r\n]*)?(?:https?:\/\/)?(?:www\.)?(?:coursera|courvera)\s*[\.]\s*org\s*[\/]\s*(?:verify|vertfy|verlfy|verily|verity|accomplishments\/verify)\s*[\/]\s*([a-zA-Z0-9 ]{4,32})(?=[^a-zA-Z0-9 ]|$)/i;
  const courseraMatch = text.match(courseraPattern);
  if (courseraMatch && courseraMatch[1]) {
    const cleanCode = courseraMatch[1].replace(/[\s\r\n]+/g, '').trim().replace(/[.,;:)\]}>]+$/, '');
    if (cleanCode.length >= 4) {
      return `https://coursera.org/verify/${cleanCode}`;
    }
  }

  // 3. Generic OCR spaced URL normalization (single line): e.g. "edx . org / verify / ABC"
  const spacedUrlPattern = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9\-_]+(?:[ \t]*[\.][ \t]*[a-zA-Z0-9\-_]+)+)[ \t]*[\/][ \t]*(verify|credential|badges|accomplishments\/verify)[ \t]*[\/][ \t]*([a-zA-Z0-9\-_ ]{4,40})(?=[^a-zA-Z0-9\-_ ]|$)/i;
  const spacedMatch = text.match(spacedUrlPattern);
  if (spacedMatch) {
    const host = spacedMatch[1].replace(/\s+/g, '');
    const pathPrefix = spacedMatch[2].replace(/\s+/g, '');
    const code = spacedMatch[3].replace(/\s+/g, '').replace(/[.,;:)\]}>]+$/, '');
    return `https://${host}/${pathPrefix}/${code}`;
  }

  return null;
}

/**
 * 6. Extract Certificate ID / Credential Code
 * Supports:
 * - Certificate ID: / Credential ID:
 * - Certificate No: / Certificate Number: / Cert No:
 * - Credential No: / Credential Number:
 * - Verification ID: / Verify Code:
 * - Serial Number: / Serial No:
 * - Extraction from verification URL path (e.g. /verify/ABC123)
 */
function extractCertificateId(text, verificationUrl = null) {
  if (!text) return null;

  // 1. Explicit labeled identifiers
  const labeledPatterns = [
    /(?:certificate\s*(?:id|no|num|number|code|#)|credential\s*(?:id|no|num|number|code|#)|verification\s*(?:id|code|no|number|#)|serial\s*(?:number|no|#)|verify\s*code)\s*[:#\-]?\s*([a-zA-Z0-9\-_]{4,})/i,
    // Hex or UUID identifier
    /\b([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\b/,
    /\b(0x[0-9a-fA-F]{10,64})\b/,
  ];

  for (const regex of labeledPatterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const cleanId = match[1].trim().replace(/[.,;:]+$/, '');
      if (cleanId.length >= 4 && !/^(that|this|with|from|date|code|hero)$/i.test(cleanId)) {
        return cleanId;
      }
    }
  }

  // 2. Extract credential code from verification URL if present (e.g. coursera.org/verify/32080F2901)
  const urlToParse = verificationUrl || extractVerificationUrl(text);
  if (urlToParse) {
    const urlMatch = urlToParse.match(/(?:\/verify\/|\/credential\/|\/badges\/|\/accomplishments\/verify\/)([a-zA-Z0-9\-_]{4,})/i);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }
  }

  return null;
}

/**
 * 7. Extract Issue Date
 * Supports:
 * - Issued: / Issued on:
 * - Issue Date: / Date of Issue:
 * - Completed on: / Date of completion:
 * - Awarded on:
 * - Standalone dates (Month DD, YYYY / DD Month YYYY / YYYY-MM-DD / DD.MM.YYYY)
 */
function extractIssueDate(text) {
  if (!text) return null;

  const patterns = [
    // Preceded by standard date labels
    /(?:issue\s*date|date\s*of\s*issue|issued\s*(?:on)?|completed\s*(?:on)?|awarded\s*(?:on)?|date\s*of\s*completion|dated|date)\s*[:\-]?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i,
    // "FROM <date> TO <date>" -> Take the end date or start date
    /(?:from\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}\s+to\s+)(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
    /(?:from\s+)(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
    // Standalone Month DD, YYYY (e.g. May 14, 2013)
    /\b((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4})\b/i,
    // Standalone DD Month YYYY (e.g. 23 June 2025)
    /\b(\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4})\b/i,
    // Standalone DD.MM.YYYY or DD/MM/YYYY
    /\b(\d{1,2}[.-]\d{1,2}[.-]\d{4})\b/,
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
 * 8. Extract Purpose / Description
 * Extracts clear purpose statements such as:
 * - "for successfully completing..."
 * - "has successfully completed..."
 * - "awarded for..."
 * - "in recognition of..."
 * - "confirmed the identity of this individual..."
 * Returns null if unavailable (does not invent purpose).
 */
function extractPurpose(text, courseName = null) {
  if (!text || typeof text !== 'string') return null;

  const patterns = [
    // Coursera identity & participation confirmation
    /(?:confirmed\s+the\s+identity\s+of\s+this\s+individual\s+and\s+their\s+participation\s+in\s+the\s+course)/i,
    // "for successfully completing..." or "for completing..."
    /(?:in\s+recognition\s+of|in\s+appreciation\s+of|awarded\s+for|for\s+successfully\s+completing|for\s+completing|for\s+successful\s+completion\s+of|for\s+participation\s+in)\s+([^.\n\r]+(?:\.|\n|\r|$))/i,
    // "has successfully completed..."
    /(?:has\s+successfully\s+completed|has\s+completed)\s+([^.\n\r]+(?:\.|\n|\r|$))/i,
    // "this certificate is awarded to ... for ..."
    /(?:this\s+certificate\s+is\s+(?:awarded|presented)\s+(?:to\s+[A-Za-z\s.'-]+?\s+)?for)\s+([^.\n\r]+(?:\.|\n|\r|$))/i,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match) {
      let rawPurpose = match[0].trim();
      rawPurpose = rawPurpose.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
      // Strip trailing date or verification metadata
      rawPurpose = rawPurpose.replace(/\s+(?:issued\s*on|date\s*:|verify|certificate\s*id|credential\s*id).*$/i, '').trim();

      if (rawPurpose.length > 5 && rawPurpose.length <= 250) {
        const afterPhrase = rawPurpose.replace(/^(?:has\s+successfully\s+completed|has\s+completed|for\s+successfully\s+completing)\s*/i, '').trim();
        const alphaWords = afterPhrase.match(/[a-zA-Z]{3,}/g) || [];
        if (alphaWords.length < 2 && courseName) {
          return `has successfully completed ${courseName}`;
        }
        return rawPurpose;
      }
    }
  }

  if (courseName && /(?:has\s+successfully\s+completed|successfully\s+completed)/i.test(text)) {
    return `has successfully completed ${courseName}`;
  }

  return null;
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
 *   purpose: string|null,
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
      purpose: null,
      student_name: null,
      studentName: null,
    };
  }

  const studentName = extractStudentName(text);
  const courseName = extractCourseName(text);
  const issuer = extractIssuer(text);
  const verificationUrl = extractVerificationUrl(text);
  const certificateId = extractCertificateId(text, verificationUrl);
  const issueDate = extractIssueDate(text);
  const purpose = extractPurpose(text, courseName);

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
    purpose: purpose,
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
  extractPurpose,
  normalizeDate,
  isGenericTitle,
};
