const dns = require('dns');
const net = require('net');

/**
 * ============================================================================
 * STEP 3: REAL CERTIFICATE AUTHENTICITY VERIFICATION SERVICE
 * ============================================================================
 *
 * Provides safe, defensive issuer verification:
 * 1. Trusted Issuer Registry: NPTEL, Coursera, edX, Credly, Accredible.
 * 2. Strict URL validation (HTTPS only, domain whitelisting, pattern matching).
 * 3. Comprehensive SSRF protection (loopback, private IPv4/IPv6, cloud metadata, DNS inspection).
 * 4. Controlled redirect following (max 3 hops, re-verifies protocol, domain, and DNS at every hop).
 * 5. Strict timeouts (max 10s request budget, timeout => VERIFICATION_TIMEOUT, never REJECTED).
 * 6. Definitive Authenticity Rule: OFFICIAL DOMAIN + HTTP 200 != VERIFIED.
 *    VERIFIED requires authoritative, issuer-controlled evidence matching the credential.
 * ============================================================================
 */

/**
 * Text comparison helper:
 * Normalizes text by lowercasing, trimming, collapsing multiple whitespaces,
 * and normalizing punctuation harmlessly.
 */
function normalizeText(value) {
  if (!value || typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .trim()
    .replace(/[“"'`]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Credential ID comparison helper:
 * Strict normalization for EXACT equality checking.
 * Collapses internal whitespace, trims, and converts to uppercase.
 * ABC-123-XYZ must NEVER match ABC-123.
 */
function normalizeCredentialId(value) {
  if (!value || typeof value !== 'string') return '';
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

/**
 * Tests whether target text contains an EXACT match for a credential ID,
 * without loose partial substring matches.
 */
function containsExactCredentialId(content, rawId) {
  const normId = normalizeCredentialId(rawId);
  if (!normId || normId.length < 3) return false;

  // Search in uppercase normalized content
  const normContent = String(content || '').toUpperCase();
  const escaped = normId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boundaryRegex = new RegExp(`(^|[^A-Z0-9_-])${escaped}([^A-Z0-9_-]|$)`, 'i');
  return boundaryRegex.test(normContent);
}

/**
 * ----------------------------------------------------------------------------
 * ISSUER VERIFICATION ADAPTERS
 * ----------------------------------------------------------------------------
 */

/**
 * 1. NPTEL Verification Adapter
 */
function nptelAdapter({ html, url, certificateId, certificateName, studentName, httpStatus }) {
  const normHtml = (html || '').toLowerCase();
  const certIdClean = certificateId ? String(certificateId).trim() : '';

  // Check for explicit negative indicators from NPTEL portal
  const negativeIndicators = [
    'no certificate found',
    'invalid roll number',
    'invalid certificate',
    'no record found',
    'certificate does not exist',
    'not a valid certificate',
  ];

  for (const indicator of negativeIndicators) {
    if (normHtml.includes(indicator)) {
      return {
        status: 'SUSPICIOUS',
        confidence: 10,
        reason: `NPTEL verification portal explicitly reported credential not found ("${indicator}").`,
        evidence: {
          trustedDomain: true,
          httpStatus,
          certificateIdMatched: false,
          certificateNameMatched: false,
          holderNameMatched: false,
          issuerMatched: true,
          verificationPageFound: true,
          negativeIndicatorFound: true,
        },
      };
    }
  }

  // Positive evidence extraction
  const idMatched = certIdClean
    ? containsExactCredentialId(html, certIdClean) || containsExactCredentialId(url, certIdClean)
    : false;

  const courseNorm = normalizeText(certificateName);
  const nameMatched = courseNorm.length > 3
    ? normalizeText(html).includes(courseNorm)
    : false;

  const studentNorm = normalizeText(studentName);
  const holderMatched = studentNorm.length > 2
    ? normalizeText(html).includes(studentNorm)
    : false;

  const officialPageFound =
    normHtml.includes('nptel') ||
    normHtml.includes('national programme on technology enhanced learning') ||
    normHtml.includes('e-certificate') ||
    normHtml.includes('swayam');

  // Rule: VERIFIED requires exact certificate ID match AND official certificate proof
  if (idMatched && (nameMatched || holderMatched || officialPageFound)) {
    return {
      status: 'VERIFIED',
      confidence: 95,
      reason: 'Authoritative NPTEL credential evidence matched submitted certificate.',
      evidence: {
        trustedDomain: true,
        httpStatus,
        certificateIdMatched: true,
        certificateNameMatched: nameMatched,
        holderNameMatched: holderMatched,
        issuerMatched: true,
        verificationPageFound: officialPageFound,
      },
    };
  }

  // Official portal reached (HTTP 200) but evidence cannot be conclusively matched
  return {
    status: 'MANUAL_REVIEW',
    confidence: 50,
    reason: 'Official NPTEL portal reached, but certificate identifier could not be conclusively matched.',
    evidence: {
      trustedDomain: true,
      httpStatus,
      certificateIdMatched: idMatched,
      certificateNameMatched: nameMatched,
      holderNameMatched: holderMatched,
      issuerMatched: true,
      verificationPageFound: officialPageFound,
    },
  };
}

/**
 * 2. Coursera Verification Adapter
 */
function courseraAdapter({ html, url, certificateId, certificateName, studentName, httpStatus }) {
  const normHtml = (html || '').toLowerCase();
  const certIdClean = certificateId ? String(certificateId).trim() : '';

  const negativeIndicators = [
    'we couldn\'t find a record of this accomplishment',
    'we could not find a record',
    'invalid certificate',
    'certificate does not exist',
    'has been revoked',
  ];

  for (const indicator of negativeIndicators) {
    if (normHtml.includes(indicator)) {
      return {
        status: 'SUSPICIOUS',
        confidence: 10,
        reason: `Coursera portal explicitly reported credential not found ("${indicator}").`,
        evidence: {
          trustedDomain: true,
          httpStatus,
          certificateIdMatched: false,
          certificateNameMatched: false,
          holderNameMatched: false,
          issuerMatched: true,
          verificationPageFound: true,
          negativeIndicatorFound: true,
        },
      };
    }
  }

  // Match certificate code in URL path or page content
  const idMatched = certIdClean
    ? containsExactCredentialId(html, certIdClean) || containsExactCredentialId(url, certIdClean)
    : false;

  const courseNorm = normalizeText(certificateName);
  const nameMatched = courseNorm.length > 3
    ? normalizeText(html).includes(courseNorm)
    : false;

  const studentNorm = normalizeText(studentName);
  const holderMatched = studentNorm.length > 2
    ? normalizeText(html).includes(studentNorm)
    : false;

  const officialAccomplishmentFound =
    normHtml.includes('coursera') &&
    (normHtml.includes('completed') ||
     normHtml.includes('accomplishment') ||
     normHtml.includes('verified certificate'));

  if (idMatched && (nameMatched || holderMatched || officialAccomplishmentFound)) {
    return {
      status: 'VERIFIED',
      confidence: 95,
      reason: 'Authoritative Coursera accomplishment evidence matched submitted certificate.',
      evidence: {
        trustedDomain: true,
        httpStatus,
        certificateIdMatched: true,
        certificateNameMatched: nameMatched,
        holderNameMatched: holderMatched,
        issuerMatched: true,
        verificationPageFound: officialAccomplishmentFound,
      },
    };
  }

  return {
    status: 'MANUAL_REVIEW',
    confidence: 50,
    reason: 'Official Coursera portal reached, but automated authoritative confirmation evidence is pending manual review.',
    evidence: {
      trustedDomain: true,
      httpStatus,
      certificateIdMatched: idMatched,
      certificateNameMatched: nameMatched,
      holderNameMatched: holderMatched,
      issuerMatched: true,
      verificationPageFound: officialAccomplishmentFound,
    },
  };
}

/**
 * 3. edX Verification Adapter
 */
function edxAdapter({ html, url, certificateId, certificateName, studentName, httpStatus }) {
  const normHtml = (html || '').toLowerCase();
  const certIdClean = certificateId ? String(certificateId).trim() : '';

  const negativeIndicators = [
    'certificate not found',
    'invalid certificate',
    'could not be found',
    'certificate is not valid',
  ];

  for (const indicator of negativeIndicators) {
    if (normHtml.includes(indicator)) {
      return {
        status: 'SUSPICIOUS',
        confidence: 10,
        reason: `edX portal reported credential not found ("${indicator}").`,
        evidence: {
          trustedDomain: true,
          httpStatus,
          certificateIdMatched: false,
          certificateNameMatched: false,
          holderNameMatched: false,
          issuerMatched: true,
          verificationPageFound: true,
          negativeIndicatorFound: true,
        },
      };
    }
  }

  const idMatched = certIdClean
    ? containsExactCredentialId(html, certIdClean) || containsExactCredentialId(url, certIdClean)
    : false;

  const courseNorm = normalizeText(certificateName);
  const nameMatched = courseNorm.length > 3
    ? normalizeText(html).includes(courseNorm)
    : false;

  const studentNorm = normalizeText(studentName);
  const holderMatched = studentNorm.length > 2
    ? normalizeText(html).includes(studentNorm)
    : false;

  const officialPageFound =
    normHtml.includes('edx') &&
    (normHtml.includes('verified certificate') || normHtml.includes('certificate of achievement'));

  if (idMatched && (nameMatched || holderMatched || officialPageFound)) {
    return {
      status: 'VERIFIED',
      confidence: 95,
      reason: 'Authoritative edX credential evidence matched submitted certificate.',
      evidence: {
        trustedDomain: true,
        httpStatus,
        certificateIdMatched: true,
        certificateNameMatched: nameMatched,
        holderNameMatched: holderMatched,
        issuerMatched: true,
        verificationPageFound: officialPageFound,
      },
    };
  }

  return {
    status: 'MANUAL_REVIEW',
    confidence: 50,
    reason: 'Official edX portal reached, but credential evidence could not be conclusively validated.',
    evidence: {
      trustedDomain: true,
      httpStatus,
      certificateIdMatched: idMatched,
      certificateNameMatched: nameMatched,
      holderNameMatched: holderMatched,
      issuerMatched: true,
      verificationPageFound: officialPageFound,
    },
  };
}

/**
 * 4. Credly Verification Adapter
 */
function credlyAdapter({ html, url, certificateId, certificateName, studentName, httpStatus }) {
  const normHtml = (html || '').toLowerCase();
  const certIdClean = certificateId ? String(certificateId).trim() : '';

  const negativeIndicators = [
    'badge not found',
    'this badge does not exist',
    'badge has been revoked',
    'credential not found',
  ];

  for (const indicator of negativeIndicators) {
    if (normHtml.includes(indicator)) {
      return {
        status: 'SUSPICIOUS',
        confidence: 10,
        reason: `Credly portal reported credential not found ("${indicator}").`,
        evidence: {
          trustedDomain: true,
          httpStatus,
          certificateIdMatched: false,
          certificateNameMatched: false,
          holderNameMatched: false,
          issuerMatched: true,
          verificationPageFound: true,
          negativeIndicatorFound: true,
        },
      };
    }
  }

  const idMatched = certIdClean
    ? containsExactCredentialId(html, certIdClean) || containsExactCredentialId(url, certIdClean)
    : false;

  const courseNorm = normalizeText(certificateName);
  const nameMatched = courseNorm.length > 3
    ? normalizeText(html).includes(courseNorm)
    : false;

  const studentNorm = normalizeText(studentName);
  const holderMatched = studentNorm.length > 2
    ? normalizeText(html).includes(studentNorm)
    : false;

  const officialBadgeFound =
    normHtml.includes('credly') &&
    (normHtml.includes('badge') || normHtml.includes('skills') || normHtml.includes('issued by'));

  if (idMatched && (nameMatched || holderMatched || officialBadgeFound)) {
    return {
      status: 'VERIFIED',
      confidence: 95,
      reason: 'Authoritative Credly digital badge evidence matched submitted certificate.',
      evidence: {
        trustedDomain: true,
        httpStatus,
        certificateIdMatched: true,
        certificateNameMatched: nameMatched,
        holderNameMatched: holderMatched,
        issuerMatched: true,
        verificationPageFound: officialBadgeFound,
      },
    };
  }

  return {
    status: 'MANUAL_REVIEW',
    confidence: 50,
    reason: 'Official Credly badge portal reached, but badge details require manual review.',
    evidence: {
      trustedDomain: true,
      httpStatus,
      certificateIdMatched: idMatched,
      certificateNameMatched: nameMatched,
      holderNameMatched: holderMatched,
      issuerMatched: true,
      verificationPageFound: officialBadgeFound,
    },
  };
}

/**
 * 5. Accredible Verification Adapter
 */
function accredibleAdapter({ html, url, certificateId, certificateName, studentName, httpStatus }) {
  const normHtml = (html || '').toLowerCase();
  const certIdClean = certificateId ? String(certificateId).trim() : '';

  const negativeIndicators = [
    'credential not found',
    'certificate not found',
    'has been revoked',
    'invalid credential',
  ];

  for (const indicator of negativeIndicators) {
    if (normHtml.includes(indicator)) {
      return {
        status: 'SUSPICIOUS',
        confidence: 10,
        reason: `Accredible portal reported credential not found ("${indicator}").`,
        evidence: {
          trustedDomain: true,
          httpStatus,
          certificateIdMatched: false,
          certificateNameMatched: false,
          holderNameMatched: false,
          issuerMatched: true,
          verificationPageFound: true,
          negativeIndicatorFound: true,
        },
      };
    }
  }

  const idMatched = certIdClean
    ? containsExactCredentialId(html, certIdClean) || containsExactCredentialId(url, certIdClean)
    : false;

  const courseNorm = normalizeText(certificateName);
  const nameMatched = courseNorm.length > 3
    ? normalizeText(html).includes(courseNorm)
    : false;

  const studentNorm = normalizeText(studentName);
  const holderMatched = studentNorm.length > 2
    ? normalizeText(html).includes(studentNorm)
    : false;

  const officialFound =
    (normHtml.includes('accredible') || normHtml.includes('credential.net')) &&
    (normHtml.includes('credential') || normHtml.includes('certificate'));

  if (idMatched && (nameMatched || holderMatched || officialFound)) {
    return {
      status: 'VERIFIED',
      confidence: 95,
      reason: 'Authoritative Accredible credential evidence matched submitted certificate.',
      evidence: {
        trustedDomain: true,
        httpStatus,
        certificateIdMatched: true,
        certificateNameMatched: nameMatched,
        holderNameMatched: holderMatched,
        issuerMatched: true,
        verificationPageFound: officialFound,
      },
    };
  }

  return {
    status: 'MANUAL_REVIEW',
    confidence: 50,
    reason: 'Official Accredible portal reached, but credential details require manual confirmation.',
    evidence: {
      trustedDomain: true,
      httpStatus,
      certificateIdMatched: idMatched,
      certificateNameMatched: nameMatched,
      holderNameMatched: holderMatched,
      issuerMatched: true,
      verificationPageFound: officialFound,
    },
  };
}

/**
 * Controlled in-code Trusted Issuer Registry (Version 2).
 * Supported: NPTEL, Coursera, edX, Credly, Accredible.
 */
const TRUSTED_ISSUER_REGISTRY = [
  {
    name: 'NPTEL',
    aliases: [
      'nptel',
      'nptel noc',
      'national programme on technology enhanced learning',
      'iit madras',
      'swayam',
      'swayam nptel',
      'nptel online certification',
    ],
    allowedDomains: ['nptel.ac.in', 'archive.nptel.ac.in'],
    urlPatterns: [
      /^https:\/\/(archive\.)?nptel\.ac\.in\/noc\/[A-Za-z0-9_.\-\/]+/i,
      /^https:\/\/(archive\.)?nptel\.ac\.in\/courses\/[A-Za-z0-9_.\-\/]+/i,
      /^https:\/\/(archive\.)?nptel\.ac\.in\/[A-Za-z0-9_.\-\/?=&]+/i,
    ],
    verificationMethod: 'OFFICIAL_URL',
    adapter: nptelAdapter,
    isActive: true,
  },
  {
    name: 'Coursera',
    aliases: ['coursera', 'coursera inc', 'coursera inc.'],
    allowedDomains: ['coursera.org', 'www.coursera.org'],
    urlPatterns: [
      /^https:\/\/(www\.)?coursera\.org\/verify\/[A-Za-z0-9_-]+$/i,
      /^https:\/\/(www\.)?coursera\.org\/account\/accomplishments\/verify\/[A-Za-z0-9_-]+$/i,
      /^https:\/\/(www\.)?coursera\.org\/account\/accomplishments\/specialization\/certificate\/[A-Za-z0-9_-]+$/i,
      /^https:\/\/(www\.)?coursera\.org\/account\/accomplishments\/certificate\/[A-Za-z0-9_-]+$/i,
    ],
    verificationMethod: 'OFFICIAL_URL',
    adapter: courseraAdapter,
    isActive: true,
  },
  {
    name: 'edX',
    aliases: ['edx', 'edx inc', 'edx inc.'],
    allowedDomains: ['edx.org', 'www.edx.org', 'verify.edx.org', 'courses.edx.org'],
    urlPatterns: [
      /^https:\/\/(www\.)?verify\.edx\.org\/cert\/[a-f0-9-]+$/i,
      /^https:\/\/(www\.)?courses\.edx\.org\/certificates\/[a-f0-9]+$/i,
      /^https:\/\/(www\.)?edx\.org\/certificates\/[a-f0-9-]+$/i,
    ],
    verificationMethod: 'OFFICIAL_URL',
    adapter: edxAdapter,
    isActive: true,
  },
  {
    name: 'Credly',
    aliases: ['credly', 'credly (pearson)', 'youracclaim'],
    allowedDomains: ['credly.com', 'www.credly.com'],
    urlPatterns: [
      /^https:\/\/(www\.)?credly\.com\/badges\/[a-f0-9-]+(\/public_url)?$/i,
      /^https:\/\/(www\.)?credly\.com\/embedded_badge\/[a-f0-9-]+$/i,
    ],
    verificationMethod: 'OFFICIAL_URL',
    adapter: credlyAdapter,
    isActive: true,
  },
  {
    name: 'Accredible',
    aliases: ['accredible', 'credential.net', 'accredible.com'],
    allowedDomains: ['accredible.com', 'www.accredible.com', 'credential.net', 'www.credential.net'],
    urlPatterns: [
      /^https:\/\/(www\.)?credential\.net\/[a-zA-Z0-9-]+$/i,
      /^https:\/\/(www\.)?accredible\.com\/[a-zA-Z0-9-]+$/i,
    ],
    verificationMethod: 'OFFICIAL_URL',
    adapter: accredibleAdapter,
    isActive: true,
  },
];

/**
 * Checks if an IP string belongs to any private, loopback, link-local,
 * multicast, or cloud-metadata address space.
 * @param {string} ip - IPv4 or IPv6 address string.
 * @returns {boolean} True if the IP is private, reserved, or blocked; false if public.
 */
function isPrivateOrBlockedIp(ip) {
  if (!ip || typeof ip !== 'string') return false;

  const version = net.isIP(ip.trim());
  if (version === 0) return false;

  if (version === 4) {
    const parts = ip.trim().split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true;
    }
    const [a, b, c, d] = parts;

    // 0.0.0.0/8 - Current network
    if (a === 0) return true;

    // 10.0.0.0/8 - Private IPv4
    if (a === 10) return true;

    // 100.64.0.0/10 - Shared Address Space (Carrier-Grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;

    // 127.0.0.0/8 - Loopback
    if (a === 127) return true;

    // 169.254.0.0/16 - Link-Local & Cloud Metadata
    if (a === 169 && b === 254) return true;

    // 172.16.0.0/12 - Private IPv4 (172.16.0.0 - 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.0.0.0/24 - IETF Protocol Assignments
    if (a === 192 && b === 0 && c === 0) return true;

    // 192.0.2.0/24 - Documentation (TEST-NET-1)
    if (a === 192 && b === 0 && c === 2) return true;

    // 192.168.0.0/16 - Private IPv4
    if (a === 192 && b === 168) return true;

    // 198.18.0.0/15 - Benchmarking
    if (a === 198 && (b === 18 || b === 19)) return true;

    // 198.51.100.0/24 - Documentation (TEST-NET-2)
    if (a === 198 && b === 51 && c === 100) return true;

    // 203.0.113.0/24 - Documentation (TEST-NET-3)
    if (a === 203 && b === 0 && c === 113) return true;

    // 224.0.0.0/4 - Multicast
    if (a >= 224 && a <= 239) return true;

    // 240.0.0.0/4 - Reserved
    if (a >= 240) return true;

    return false;
  }

  if (version === 6) {
    const lower = ip.trim().toLowerCase();

    // IPv4-mapped IPv6 (::ffff:127.0.0.1)
    if (lower.startsWith('::ffff:')) {
      const v4part = lower.substring(7);
      if (net.isIPv4(v4part)) {
        return isPrivateOrBlockedIp(v4part);
      }
    }

    // Loopback (::1)
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;

    // Unspecified (::)
    if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return true;

    // Unique Local Addresses (fc00::/7)
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;

    // Link-Local (fe80::/10)
    if (/^fe[89ab]/i.test(lower)) return true;

    // Multicast (ff00::/8)
    if (lower.startsWith('ff')) return true;

    // Documentation / Discard prefix
    if (lower.startsWith('2001:db8:') || lower.startsWith('100:')) return true;

    return false;
  }

  return true;
}

/**
 * Finds an issuer in the trusted registry by name or alias.
 */
function findIssuerInRegistry(issuerName) {
  if (!issuerName || typeof issuerName !== 'string') return null;
  const clean = issuerName.trim().toLowerCase();

  return (
    TRUSTED_ISSUER_REGISTRY.find((entry) => {
      if (!entry.isActive) return false;
      if (entry.name.toLowerCase() === clean) return true;
      if (entry.aliases && entry.aliases.some((a) => a.toLowerCase() === clean)) return true;
      // Partial prefix check if specific (e.g. "Coursera - Stanford")
      if (clean.includes(entry.name.toLowerCase())) return true;
      return false;
    }) || null
  );
}

/**
 * Strictly verifies whether a normalized hostname matches an allowed domain list.
 * Prevents suffix spoofing (e.g. 'coursera.org.evil.com' or 'nptel.ac.in.attacker.com').
 */
function isDomainAllowed(hostname, allowedDomains) {
  if (!hostname || !Array.isArray(allowedDomains)) return false;
  const normHost = hostname.toLowerCase().trim().replace(/\.+$/, '');
  return allowedDomains.some((domain) => {
    const normDomain = domain.toLowerCase().trim().replace(/\.+$/, '');
    return normHost === normDomain;
  });
}

/**
 * Validates a certificate verification URL against trusted issuer policy and SSRF safety rules.
 */
function validateIssuerVerificationUrl(url, issuer) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return {
      valid: false,
      status: 'INVALID_URL',
      reason: 'Verification URL is missing or empty.',
    };
  }

  // 1. Parse URL
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return {
      valid: false,
      status: 'INVALID_URL',
      reason: 'Malformed URL syntax.',
    };
  }

  // 2. Require HTTPS protocol
  if (parsed.protocol !== 'https:') {
    return {
      valid: false,
      status: 'INVALID_URL',
      reason: `Insecure protocol "${parsed.protocol}". HTTPS is strictly required.`,
    };
  }

  // 3. Reject userinfo credentials
  if (parsed.username || parsed.password) {
    return {
      valid: false,
      status: 'INVALID_URL',
      reason: 'Userinfo credentials in URL are prohibited.',
    };
  }

  // 4. Reject non-standard ports
  if (parsed.port && parsed.port !== '443') {
    return {
      valid: false,
      status: 'INVALID_URL',
      reason: `Non-standard port "${parsed.port}" is prohibited.`,
    };
  }

  // 5. Normalize and validate hostname
  const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, '');
  if (!hostname) {
    return {
      valid: false,
      status: 'INVALID_URL',
      reason: 'Hostname is empty.',
    };
  }

  // Reject local and internal hostnames
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return {
      valid: false,
      status: 'INVALID_URL',
      reason: 'Local or internal hostnames are prohibited.',
    };
  }

  // Reject direct IP addresses
  if (net.isIP(hostname) !== 0 || isPrivateOrBlockedIp(hostname)) {
    return {
      valid: false,
      status: 'INVALID_URL',
      reason: 'Direct IP address access in verification URL is prohibited.',
    };
  }

  // 6. Check Trusted Issuer Registry
  const issuerEntry = findIssuerInRegistry(issuer);
  if (!issuerEntry) {
    return {
      valid: false,
      status: 'UNSUPPORTED_ISSUER',
      reason: `Issuer "${issuer}" is not configured in the trusted registry.`,
    };
  }

  // 7. Check domain against allowed whitelist (prevents suffix spoofing)
  if (!isDomainAllowed(hostname, issuerEntry.allowedDomains)) {
    return {
      valid: false,
      status: 'UNTRUSTED_ISSUER',
      reason: `Domain "${hostname}" is not an authorized verification domain for ${issuerEntry.name}.`,
      issuerEntry,
    };
  }

  // 8. Check URL path against issuer-specific URL patterns
  const fullUrl = parsed.href;
  const matchesPattern = issuerEntry.urlPatterns.some((pattern) => pattern.test(fullUrl));
  if (!matchesPattern) {
    return {
      valid: false,
      status: 'INVALID_URL',
      reason: `URL path does not match official verification pattern for ${issuerEntry.name}.`,
      issuerEntry,
    };
  }

  return {
    valid: true,
    status: 'VALID',
    parsedUrl: parsed,
    issuerEntry,
  };
}

/**
 * Resolves DNS for a hostname and validates all returned IP records against private/SSRF ranges.
 */
async function resolveAndValidateDns(hostname) {
  try {
    const records = await dns.promises.lookup(hostname, { all: true });
    if (!records || records.length === 0) {
      return { valid: false, reason: `DNS lookup returned no records for "${hostname}".` };
    }

    for (const record of records) {
      if (isPrivateOrBlockedIp(record.address)) {
        return {
          valid: false,
          reason: `Resolved IP "${record.address}" belongs to a private, reserved, or blocked range.`,
          blockedIp: record.address,
        };
      }
    }

    return { valid: true, records };
  } catch (err) {
    return {
      valid: false,
      reason: `DNS resolution failed for "${hostname}": ${err.message}`,
    };
  }
}

/**
 * Deterministically constructs an official verification URL for known issuers
 * when verificationUrl is null/absent but an exact certificate ID exists.
 */
function tryConstructVerificationUrl(issuer, certificateId) {
  if (!issuer || !certificateId) return null;
  const cleanId = String(certificateId).trim();
  const issuerEntry = findIssuerInRegistry(issuer);
  if (!issuerEntry) return null;

  if (issuerEntry.name === 'Coursera' && /^[A-Za-z0-9_-]{8,32}$/.test(cleanId)) {
    return `https://www.coursera.org/verify/${encodeURIComponent(cleanId)}`;
  }

  if (issuerEntry.name === 'NPTEL' && /^NPTEL[0-9A-Z_-]+$/i.test(cleanId)) {
    return `https://archive.nptel.ac.in/noc/E_Certificate/verify?certId=${encodeURIComponent(cleanId)}`;
  }

  if (issuerEntry.name === 'edX' && /^[a-f0-9-]{16,40}$/i.test(cleanId)) {
    return `https://verify.edx.org/cert/${encodeURIComponent(cleanId)}`;
  }

  return null;
}

/**
 * Standardized verification result builder.
 */
function buildVerificationResult({
  success,
  status,
  reason,
  issuer,
  method = 'OFFICIAL_URL',
  httpStatus = null,
  verificationUrl = null,
  confidence = 0,
  evidence = null,
  latencyMs = 0,
}) {
  return {
    success: Boolean(success),
    status,
    issuer: issuer || 'UNKNOWN',
    method,
    httpStatus,
    verificationUrl,
    reason: reason || '',
    confidence: typeof confidence === 'number' ? confidence : 0,
    certificateIdMatched: Boolean(evidence?.certificateIdMatched),
    evidence: {
      trustedDomain: Boolean(evidence?.trustedDomain),
      httpStatus: httpStatus || null,
      certificateIdMatched: Boolean(evidence?.certificateIdMatched),
      certificateNameMatched: Boolean(evidence?.certificateNameMatched),
      holderNameMatched: Boolean(evidence?.holderNameMatched),
      issuerMatched: Boolean(evidence?.issuerMatched),
      verificationPageFound: Boolean(evidence?.verificationPageFound),
      ...(evidence || {}),
    },
    latencyMs,
  };
}

/**
 * Main verification execution function.
 *
 * Executes an outbound HTTPS verification check with strict timeouts,
 * controlled redirects (max 3), full SSRF validation, and issuer-specific evidence evaluation.
 *
 * NOTE: OFFICIAL DOMAIN + HTTP 200 != VERIFIED.
 *
 * @param {object} options
 * @param {string} options.issuer - Declared issuer organization.
 * @param {string} [options.verificationUrl] - Extracted or supplied verification URL.
 * @param {string} [options.certificateId] - Extracted certificate ID.
 * @param {string} [options.certificateName] - Course or certificate name.
 * @param {string} [options.studentName] - Student / holder name.
 * @returns {Promise<object>} Standardized verification result.
 */
async function verifyIssuerCertificate({
  issuer,
  verificationUrl,
  certificateId,
  certificateName,
  studentName,
}) {
  const startTime = Date.now();
  const certIdClean = certificateId ? String(certificateId).trim() : null;

  // Handle missing verification URL
  let targetUrl = verificationUrl ? String(verificationUrl).trim() : null;
  if (!targetUrl) {
    targetUrl = tryConstructVerificationUrl(issuer, certificateId);
  }

  if (!targetUrl) {
    const issuerEntry = findIssuerInRegistry(issuer);
    return buildVerificationResult({
      success: false,
      status: 'MANUAL_REVIEW',
      issuer: issuerEntry ? issuerEntry.name : (issuer || 'UNKNOWN'),
      reason: 'Certificate has no public verification URL. Queued for manual verification.',
      verificationUrl: null,
      confidence: 0,
      evidence: {
        trustedDomain: false,
        httpStatus: null,
        certificateIdMatched: false,
        certificateNameMatched: false,
        holderNameMatched: false,
        issuerMatched: Boolean(issuerEntry),
        verificationPageFound: false,
      },
      latencyMs: Date.now() - startTime,
    });
  }

  // 1. Initial URL validation
  const validation = validateIssuerVerificationUrl(targetUrl, issuer);
  if (!validation.valid) {
    return buildVerificationResult({
      success: false,
      status: validation.status,
      reason: validation.reason,
      issuer: validation.issuerEntry ? validation.issuerEntry.name : (issuer || 'UNKNOWN'),
      verificationUrl: targetUrl,
      confidence: 0,
      evidence: {
        trustedDomain: false,
        httpStatus: null,
        certificateIdMatched: false,
        certificateNameMatched: false,
        holderNameMatched: false,
        issuerMatched: Boolean(validation.issuerEntry),
        verificationPageFound: false,
      },
      latencyMs: Date.now() - startTime,
    });
  }

  const { issuerEntry } = validation;
  let currentUrl = validation.parsedUrl.href;
  let redirectCount = 0;
  const maxRedirects = 3;

  // 2. Request loop with controlled redirect handling and 10s budget
  while (redirectCount <= maxRedirects) {
    const currentParsed = new URL(currentUrl);

    // SSRF Pre-flight: Resolve DNS and check all resolved IPs
    const dnsCheck = await resolveAndValidateDns(currentParsed.hostname);
    if (!dnsCheck.valid) {
      return buildVerificationResult({
        success: false,
        status: dnsCheck.blockedIp ? 'UNTRUSTED_ISSUER' : 'MANUAL_REVIEW',
        reason: dnsCheck.reason,
        issuer: issuerEntry.name,
        verificationUrl: currentUrl,
        confidence: 0,
        evidence: {
          trustedDomain: false,
          httpStatus: null,
          certificateIdMatched: false,
          certificateNameMatched: false,
          holderNameMatched: false,
          issuerMatched: true,
          verificationPageFound: false,
        },
        latencyMs: Date.now() - startTime,
      });
    }

    // Outbound HTTPS request with 10s timeout budget
    const controller = new AbortController();
    const timeoutRemaining = Math.max(1000, 10000 - (Date.now() - startTime));
    const timeoutId = setTimeout(() => controller.abort(), timeoutRemaining);

    let response;
    try {
      response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'StudentCredentialEngine-IssuerVerifier/1.0',
          'Accept': 'text/html,application/json,application/xhtml+xml',
        },
      });
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout =
        err.name === 'AbortError' ||
        err.name === 'TimeoutError' ||
        err.code === 20 ||
        Date.now() - startTime >= 10000;

      if (isTimeout) {
        return buildVerificationResult({
          success: false,
          status: 'VERIFICATION_TIMEOUT',
          reason: 'Issuer verification request timed out.',
          issuer: issuerEntry.name,
          verificationUrl: currentUrl,
          confidence: 0,
          evidence: {
            trustedDomain: true,
            httpStatus: null,
            certificateIdMatched: false,
            certificateNameMatched: false,
            holderNameMatched: false,
            issuerMatched: true,
            verificationPageFound: false,
          },
          latencyMs: Date.now() - startTime,
        });
      }

      return buildVerificationResult({
        success: false,
        status: 'MANUAL_REVIEW',
        reason: `Network error connecting to issuer endpoint: ${err.message}`,
        issuer: issuerEntry.name,
        verificationUrl: currentUrl,
        confidence: 0,
        evidence: {
          trustedDomain: true,
          httpStatus: null,
          certificateIdMatched: false,
          certificateNameMatched: false,
          holderNameMatched: false,
          issuerMatched: true,
          verificationPageFound: false,
        },
        latencyMs: Date.now() - startTime,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // 3. Handle HTTP Redirects (301, 302, 303, 307, 308) under strict control
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        return buildVerificationResult({
          success: false,
          status: 'MANUAL_REVIEW',
          reason: 'Issuer endpoint returned redirect without Location header.',
          issuer: issuerEntry.name,
          verificationUrl: currentUrl,
          httpStatus: response.status,
          latencyMs: Date.now() - startTime,
        });
      }

      redirectCount++;
      if (redirectCount > maxRedirects) {
        return buildVerificationResult({
          success: false,
          status: 'MANUAL_REVIEW',
          reason: `Exceeded maximum permitted redirect depth (${maxRedirects}).`,
          issuer: issuerEntry.name,
          verificationUrl: currentUrl,
          httpStatus: response.status,
          latencyMs: Date.now() - startTime,
        });
      }

      // Resolve redirect URL
      let nextUrl;
      try {
        nextUrl = new URL(location, currentUrl).href;
      } catch {
        return buildVerificationResult({
          success: false,
          status: 'INVALID_URL',
          reason: `Invalid redirect Location header: "${location}".`,
          issuer: issuerEntry.name,
          verificationUrl: currentUrl,
          httpStatus: response.status,
          latencyMs: Date.now() - startTime,
        });
      }

      // Re-validate redirect target URL against trusted issuer policy
      const redirectValidation = validateIssuerVerificationUrl(nextUrl, issuerEntry.name);
      if (!redirectValidation.valid) {
        return buildVerificationResult({
          success: false,
          status: redirectValidation.status === 'UNTRUSTED_ISSUER' ? 'UNTRUSTED_ISSUER' : 'MANUAL_REVIEW',
          reason: `Redirect target rejected: ${redirectValidation.reason}`,
          issuer: issuerEntry.name,
          verificationUrl: nextUrl,
          httpStatus: response.status,
          latencyMs: Date.now() - startTime,
        });
      }

      currentUrl = nextUrl;
      continue;
    }

    // 4. Handle HTTP Response Codes
    const latencyMs = Date.now() - startTime;

    // 404 / 410 = Explicitly not found / expired on official portal
    if (response.status === 404 || response.status === 410) {
      return buildVerificationResult({
        success: false,
        status: 'SUSPICIOUS',
        reason: `Issuer portal reported credential not found or expired (HTTP ${response.status}).`,
        issuer: issuerEntry.name,
        verificationUrl: currentUrl,
        httpStatus: response.status,
        confidence: 0,
        evidence: {
          trustedDomain: true,
          httpStatus: response.status,
          certificateIdMatched: false,
          certificateNameMatched: false,
          holderNameMatched: false,
          issuerMatched: true,
          verificationPageFound: false,
          notFoundStatus: true,
        },
        latencyMs,
      });
    }

    // 5xx = Issuer server error -> temporary unavailability => MANUAL_REVIEW, NOT REJECTED
    if (response.status >= 500) {
      return buildVerificationResult({
        success: false,
        status: 'MANUAL_REVIEW',
        reason: `Issuer verification server temporary error (HTTP ${response.status}). Queued for review.`,
        issuer: issuerEntry.name,
        verificationUrl: currentUrl,
        httpStatus: response.status,
        confidence: 0,
        evidence: {
          trustedDomain: true,
          httpStatus: response.status,
          certificateIdMatched: false,
          certificateNameMatched: false,
          holderNameMatched: false,
          issuerMatched: true,
          verificationPageFound: false,
        },
        latencyMs,
      });
    }

    // Read bounded slice of response body (max 64KB)
    let bodySnippet = '';
    try {
      if (response.body) {
        const reader = response.body.getReader();
        let bytesRead = 0;
        const chunks = [];
        while (bytesRead < 65536) {
          const { done, value } = await reader.read();
          if (done || !value) break;
          chunks.push(value);
          bytesRead += value.length;
        }
        reader.cancel();
        const totalBuffer = Buffer.concat(chunks);
        bodySnippet = totalBuffer.toString('utf8');
      } else if (typeof response.text === 'function') {
        bodySnippet = await response.text();
      }
    } catch {
      // Body reading defensive fallback
    }

    // 5. Execute issuer-specific adapter
    if (typeof issuerEntry.adapter === 'function') {
      const adapterResult = issuerEntry.adapter({
        html: bodySnippet,
        url: currentUrl,
        certificateId: certIdClean,
        certificateName,
        studentName,
        httpStatus: response.status,
      });

      return buildVerificationResult({
        success: adapterResult.status === 'VERIFIED',
        status: adapterResult.status,
        reason: adapterResult.reason,
        issuer: issuerEntry.name,
        method: issuerEntry.verificationMethod,
        httpStatus: response.status,
        verificationUrl: currentUrl,
        confidence: adapterResult.confidence || 0,
        evidence: {
          trustedDomain: true,
          httpStatus: response.status,
          redirectCount,
          ...adapterResult.evidence,
        },
        latencyMs,
      });
    }

    // Fallback: If no adapter is configured, HTTP 200 alone must NEVER return VERIFIED
    return buildVerificationResult({
      success: false,
      status: 'MANUAL_REVIEW',
      reason: 'Official verification endpoint reached, but automated adapter is pending.',
      issuer: issuerEntry.name,
      verificationUrl: currentUrl,
      httpStatus: response.status,
      confidence: 50,
      evidence: {
        trustedDomain: true,
        httpStatus: response.status,
        certificateIdMatched: false,
        certificateNameMatched: false,
        holderNameMatched: false,
        issuerMatched: true,
        verificationPageFound: true,
        redirectCount,
      },
      latencyMs,
    });
  }

  return buildVerificationResult({
    success: false,
    status: 'MANUAL_REVIEW',
    reason: 'Issuer verification could not be completed.',
    issuer: issuerEntry.name,
    verificationUrl: currentUrl,
    httpStatus: null,
    latencyMs: Date.now() - startTime,
  });
}

module.exports = {
  TRUSTED_ISSUER_REGISTRY,
  isPrivateOrBlockedIp,
  findIssuerInRegistry,
  isDomainAllowed,
  validateIssuerVerificationUrl,
  resolveAndValidateDns,
  tryConstructVerificationUrl,
  normalizeText,
  normalizeCredentialId,
  containsExactCredentialId,
  verifyIssuerCertificate,
};
