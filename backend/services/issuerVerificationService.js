const dns = require('dns');
const net = require('net');

/**
 * ============================================================================
 * STEP 4E-B: TRUSTED ISSUER VERIFICATION SERVICE (ISOLATED)
 * ============================================================================
 *
 * Provides safe, defensive issuer verification:
 * 1. Controlled Trusted Issuer Registry (Version 1).
 * 2. Strict URL validation (HTTPS only, domain whitelisting, pattern matching).
 * 3. Comprehensive SSRF protection (loopback, private IPv4/IPv6, cloud metadata, DNS inspection).
 * 4. Controlled redirect following (max 2, re-verifies protocol, domain, and DNS at every hop).
 * 5. Strict timeouts (max 10s request budget).
 * 6. Defensive authenticity classification: HTTP 200 != VERIFIED.
 * ============================================================================
 */

/**
 * Controlled in-code Trusted Issuer Registry (Version 1).
 * Only organizations with verified, authoritative public verification domains are listed.
 */
const TRUSTED_ISSUER_REGISTRY = [
  {
    name: 'Coursera',
    aliases: ['coursera', 'coursera inc', 'coursera inc.'],
    allowedDomains: ['coursera.org', 'www.coursera.org'],
    urlPatterns: [
      /^https:\/\/(www\.)?coursera\.org\/verify\/[A-Za-z0-9_-]+$/i,
      /^https:\/\/(www\.)?coursera\.org\/account\/accomplishments\/verify\/[A-Za-z0-9_-]+$/i,
      /^https:\/\/(www\.)?coursera\.org\/account\/accomplishments\/specialization\/certificate\/[A-Za-z0-9_-]+$/i,
      /^https:\/\/(www\.)?coursera\.org\/account\/accomplishments\/certificate\/[A-Za-z0-9_-]+$/i
    ],
    verificationMethod: 'OFFICIAL_URL',
    isActive: true
  },
  {
    name: 'edX',
    aliases: ['edx', 'edx inc', 'edx inc.'],
    allowedDomains: ['edx.org', 'verify.edx.org', 'courses.edx.org'],
    urlPatterns: [
      /^https:\/\/verify\.edx\.org\/cert\/[a-f0-9-]+$/i,
      /^https:\/\/courses\.edx\.org\/certificates\/[a-f0-9]+$/i
    ],
    verificationMethod: 'OFFICIAL_URL',
    isActive: true
  },
  {
    name: 'Credly',
    aliases: ['credly', 'credly (pearson)', 'youracclaim'],
    allowedDomains: ['credly.com', 'www.credly.com'],
    urlPatterns: [
      /^https:\/\/(www\.)?credly\.com\/badges\/[a-f0-9-]+(\/public_url)?$/i
    ],
    verificationMethod: 'OFFICIAL_URL',
    isActive: true
  },
  {
    name: 'Accredible',
    aliases: ['accredible', 'credential.net'],
    allowedDomains: ['accredible.com', 'www.accredible.com', 'credential.net', 'www.credential.net'],
    urlPatterns: [
      /^https:\/\/(www\.)?credential\.net\/[a-zA-Z0-9-]+$/i,
      /^https:\/\/(www\.)?accredible\.com\/[a-zA-Z0-9-]+$/i
    ],
    verificationMethod: 'OFFICIAL_URL',
    isActive: true
  }
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
  if (version === 0) return false; // Not an IP address

  if (version === 4) {
    const parts = ip.trim().split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
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

    // 169.254.0.0/16 - Link-Local & Cloud Metadata (AWS/GCP/Azure: 169.254.169.254)
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

    // 240.0.0.0/4 - Reserved for Future Use
    // 255.255.255.255 - Limited Broadcast
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
 * @param {string} issuerName - The issuer organization name.
 * @returns {object|null} The registry entry or null.
 */
function findIssuerInRegistry(issuerName) {
  if (!issuerName || typeof issuerName !== 'string') return null;
  const clean = issuerName.trim().toLowerCase();

  return TRUSTED_ISSUER_REGISTRY.find(entry => {
    if (!entry.isActive) return false;
    if (entry.name.toLowerCase() === clean) return true;
    if (entry.aliases && entry.aliases.some(a => a.toLowerCase() === clean)) return true;
    return false;
  }) || null;
}

/**
 * Strictly verifies whether a normalized hostname matches an allowed domain list.
 * Prevents suffix spoofing (e.g., 'coursera.org.evil.com').
 * @param {string} hostname - The hostname to test.
 * @param {string[]} allowedDomains - Array of exact allowed domains.
 * @returns {boolean} True if strictly authorized.
 */
function isDomainAllowed(hostname, allowedDomains) {
  if (!hostname || !Array.isArray(allowedDomains)) return false;
  const normHost = hostname.toLowerCase().trim();
  return allowedDomains.some(domain => {
    const normDomain = domain.toLowerCase().trim();
    return normHost === normDomain;
  });
}

/**
 * Validates a certificate verification URL against trusted issuer policy and SSRF safety rules.
 * @param {string} url - The candidate verification URL.
 * @param {string} issuer - The claimed issuer organization.
 * @returns {object} Validation result { valid, status, reason, parsedUrl, issuerEntry }
 */
function validateIssuerVerificationUrl(url, issuer) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return {
      valid: false,
      status: 'INVALID_URL',
      reason: 'Verification URL is missing or empty.'
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
      reason: 'Malformed URL syntax.'
    };
  }

  // 2. Require HTTPS protocol
  if (parsed.protocol !== 'https:') {
    return {
      valid: false,
      status: 'INVALID_URL',
      reason: `Insecure protocol "${parsed.protocol}". HTTPS is strictly required.`
    };
  }

  // 3. Reject userinfo tricks (e.g. https://user:pass@domain.com)
  if (parsed.username || parsed.password) {
    return {
      valid: false,
      status: 'INVALID_URL',
      reason: 'Userinfo credentials in URL are prohibited.'
    };
  }

  // 4. Reject non-standard ports
  if (parsed.port && parsed.port !== '443') {
    return {
      valid: false,
      status: 'INVALID_URL',
      reason: `Non-standard port "${parsed.port}" is prohibited.`
    };
  }

  // 5. Normalize and validate hostname
  const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, '');
  if (!hostname) {
    return {
      valid: false,
      status: 'INVALID_URL',
      reason: 'Hostname is empty.'
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
      reason: 'Local or internal hostnames are prohibited.'
    };
  }

  // Reject direct IP addresses (loopback, private, cloud metadata, or raw public IPs)
  if (net.isIP(hostname) !== 0 || isPrivateOrBlockedIp(hostname)) {
    return {
      valid: false,
      status: 'INVALID_URL',
      reason: 'Direct IP address access in verification URL is prohibited.'
    };
  }

  // 6. Check Trusted Issuer Registry
  const issuerEntry = findIssuerInRegistry(issuer);
  if (!issuerEntry) {
    return {
      valid: false,
      status: 'UNSUPPORTED_ISSUER',
      reason: `Issuer "${issuer}" is not configured in the trusted registry.`
    };
  }

  // 7. Check domain against allowed whitelist (prevents coursera.org.evil.com)
  if (!isDomainAllowed(hostname, issuerEntry.allowedDomains)) {
    return {
      valid: false,
      status: 'UNTRUSTED_ISSUER',
      reason: `Domain "${hostname}" is not an authorized verification domain for ${issuerEntry.name}.`,
      issuerEntry
    };
  }

  // 8. Check URL path against issuer-specific URL patterns
  const fullUrl = parsed.href;
  const matchesPattern = issuerEntry.urlPatterns.some(pattern => pattern.test(fullUrl));
  if (!matchesPattern) {
    return {
      valid: false,
      status: 'INVALID_URL',
      reason: `URL path does not match official verification pattern for ${issuerEntry.name}.`,
      issuerEntry
    };
  }

  return {
    valid: true,
    status: 'VALID',
    parsedUrl: parsed,
    issuerEntry
  };
}

/**
 * Resolves DNS for a hostname and validates all returned IP records against private/SSRF ranges.
 * @param {string} hostname - The hostname to inspect.
 * @returns {Promise<object>} { valid: boolean, reason?: string, records?: Array }
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
          blockedIp: record.address
        };
      }
    }

    return { valid: true, records };
  } catch (err) {
    return {
      valid: false,
      reason: `DNS resolution failed for "${hostname}": ${err.message}`
    };
  }
}

/**
 * Executes an outbound HTTPS verification check with strict timeouts,
 * controlled redirects, and full SSRF validation.
 *
 * NOTE: HTTP 200 does NOT automatically equal VERIFIED.
 *
 * @param {object} options
 * @param {string} options.issuer - Declared issuer organization.
 * @param {string} options.verificationUrl - Extracted or supplied verification URL.
 * @param {string} [options.certificateId] - Extracted certificate ID.
 * @returns {Promise<object>} Standardized verification result.
 */
async function verifyIssuerCertificate({ issuer, verificationUrl, certificateId }) {
  const startTime = Date.now();
  const certIdClean = certificateId ? String(certificateId).trim() : null;

  // 1. Initial URL validation
  const validation = validateIssuerVerificationUrl(verificationUrl, issuer);
  if (!validation.valid) {
    return {
      success: false,
      status: validation.status,
      reason: validation.reason,
      issuer: validation.issuerEntry ? validation.issuerEntry.name : (issuer || 'UNKNOWN'),
      method: validation.issuerEntry ? validation.issuerEntry.verificationMethod : 'OFFICIAL_URL',
      httpStatus: null,
      certificateIdMatched: false,
      latencyMs: Date.now() - startTime
    };
  }

  const { issuerEntry } = validation;
  let currentUrl = validation.parsedUrl.href;
  let redirectCount = 0;
  const maxRedirects = 2;

  // 2. Request loop with controlled redirect handling and 10s overall budget
  while (redirectCount <= maxRedirects) {
    const currentParsed = new URL(currentUrl);

    // SSRF Pre-flight: Resolve DNS and check all resolved IPs
    const dnsCheck = await resolveAndValidateDns(currentParsed.hostname);
    if (!dnsCheck.valid) {
      return {
        success: false,
        status: dnsCheck.blockedIp ? 'UNTRUSTED_ISSUER' : 'NOT_REACHABLE',
        reason: dnsCheck.reason,
        issuer: issuerEntry.name,
        method: issuerEntry.verificationMethod,
        httpStatus: null,
        certificateIdMatched: false,
        latencyMs: Date.now() - startTime
      };
    }

    // Prepare outbound HTTPS request with AbortController timeout (10s budget)
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
          'Accept': 'text/html,application/json'
        }
      });
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout =
        err.name === 'AbortError' ||
        err.name === 'TimeoutError' ||
        err.code === 20 ||
        (Date.now() - startTime) >= 10000;

      if (isTimeout) {
        return {
          success: false,
          status: 'VERIFICATION_TIMEOUT',
          reason: 'Issuer verification request timed out.',
          issuer: issuerEntry.name,
          method: issuerEntry.verificationMethod,
          httpStatus: null,
          certificateIdMatched: false,
          latencyMs: Date.now() - startTime
        };
      }

      return {
        success: false,
        status: 'NOT_REACHABLE',
        reason: `Network error connecting to issuer endpoint: ${err.message}`,
        issuer: issuerEntry.name,
        method: issuerEntry.verificationMethod,
        httpStatus: null,
        certificateIdMatched: false,
        latencyMs: Date.now() - startTime
      };
    } finally {
      clearTimeout(timeoutId);
    }

    // 3. Handle HTTP Redirects (301, 302, 303, 307, 308) under strict control
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        return {
          success: false,
          status: 'MANUAL_REVIEW',
          reason: 'Issuer endpoint returned redirect without Location header.',
          issuer: issuerEntry.name,
          method: issuerEntry.verificationMethod,
          httpStatus: response.status,
          certificateIdMatched: false,
          latencyMs: Date.now() - startTime
        };
      }

      redirectCount++;
      if (redirectCount > maxRedirects) {
        return {
          success: false,
          status: 'MANUAL_REVIEW',
          reason: 'Exceeded maximum permitted redirect depth (2).',
          issuer: issuerEntry.name,
          method: issuerEntry.verificationMethod,
          httpStatus: response.status,
          certificateIdMatched: false,
          latencyMs: Date.now() - startTime
        };
      }

      // Resolve relative or absolute redirect destination
      let nextUrl;
      try {
        nextUrl = new URL(location, currentUrl).href;
      } catch {
        return {
          success: false,
          status: 'INVALID_URL',
          reason: `Invalid redirect Location header: "${location}".`,
          issuer: issuerEntry.name,
          method: issuerEntry.verificationMethod,
          httpStatus: response.status,
          certificateIdMatched: false,
          latencyMs: Date.now() - startTime
        };
      }

      // Re-validate redirect destination URL against trusted issuer policy
      const redirectValidation = validateIssuerVerificationUrl(nextUrl, issuerEntry.name);
      if (!redirectValidation.valid) {
        return {
          success: false,
          status: redirectValidation.status === 'UNTRUSTED_ISSUER' ? 'UNTRUSTED_ISSUER' : 'MANUAL_REVIEW',
          reason: `Redirect target rejected: ${redirectValidation.reason}`,
          issuer: issuerEntry.name,
          method: issuerEntry.verificationMethod,
          httpStatus: response.status,
          certificateIdMatched: false,
          latencyMs: Date.now() - startTime
        };
      }

      currentUrl = nextUrl;
      continue; // Process the validated redirect
    }

    // 4. Handle HTTP Response Codes
    const latencyMs = Date.now() - startTime;

    // Explicit 404 / 410 = Certificate not found / expired / rejected
    if (response.status === 404 || response.status === 410) {
      return {
        success: false,
        status: 'REJECTED',
        reason: `Issuer portal reported credential not found or expired (HTTP ${response.status}).`,
        issuer: issuerEntry.name,
        method: issuerEntry.verificationMethod,
        httpStatus: response.status,
        certificateIdMatched: false,
        latencyMs
      };
    }

    // 5xx = Issuer server error
    if (response.status >= 500) {
      return {
        success: false,
        status: 'NOT_REACHABLE',
        reason: `Issuer verification server error (HTTP ${response.status}).`,
        issuer: issuerEntry.name,
        method: issuerEntry.verificationMethod,
        httpStatus: response.status,
        certificateIdMatched: false,
        latencyMs
      };
    }

    // Read a safe, bounded slice of the response body (max 32KB) without retaining entire HTML
    let bodySnippet = '';
    try {
      const reader = response.body.getReader();
      let bytesRead = 0;
      const chunks = [];
      while (bytesRead < 32768) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        bytesRead += value.length;
      }
      reader.cancel(); // Cancel remaining stream to free memory
      const totalBuffer = Buffer.concat(chunks);
      bodySnippet = totalBuffer.toString('utf8').toLowerCase();
    } catch {
      // Body reading is optional / defensive; ignore if failed
    }

    // Check certificate ID match in URL path or query
    let idMatched = false;
    if (certIdClean) {
      const parsedFinal = new URL(currentUrl);
      const pathnameLower = parsedFinal.pathname.toLowerCase();
      const certIdLower = certIdClean.toLowerCase();
      if (pathnameLower.includes(certIdLower)) {
        idMatched = true;
      }
    }

    // Check for negative indicators in response body snippet
    const negativeIndicators = [
      'certificate not found',
      'credential not found',
      'invalid certificate',
      'invalid credential',
      'no record found',
      'has been revoked'
    ];
    for (const indicator of negativeIndicators) {
      if (bodySnippet.includes(indicator)) {
        return {
          success: false,
          status: 'REJECTED',
          reason: `Issuer response indicates credential is not recognized or revoked ("${indicator}").`,
          issuer: issuerEntry.name,
          method: issuerEntry.verificationMethod,
          httpStatus: response.status,
          certificateIdMatched: false,
          latencyMs
        };
      }
    }

    // =========================================================================
    // CORE AUTHENTICITY PRINCIPLE: HTTP 200 != VERIFIED
    // =========================================================================
    // Reaching an HTML verification page with HTTP 200 proves endpoint reachability,
    // but without an authoritative signed API or cryptographic verification payload,
    // Version 1 conservatively reports VERIFICATION_UNCONFIRMED to prevent false
    // verification claims.
    // =========================================================================
    if (response.status === 200) {
      return {
        success: false,
        status: 'VERIFICATION_UNCONFIRMED',
        reason: 'Verification endpoint is reachable, but automated authoritative confirmation evidence is pending manual or API verification.',
        issuer: issuerEntry.name,
        method: issuerEntry.verificationMethod,
        httpStatus: 200,
        certificateIdMatched: idMatched,
        evidence: {
          domain: currentParsed.hostname,
          reachable: true,
          urlPatternMatched: true,
          redirectCount
        },
        latencyMs
      };
    }

    // Default unhandled status
    return {
      success: false,
      status: 'MANUAL_REVIEW',
      reason: `Unexpected HTTP status ${response.status} from issuer portal.`,
      issuer: issuerEntry.name,
      method: issuerEntry.verificationMethod,
      httpStatus: response.status,
      certificateIdMatched: idMatched,
      latencyMs
    };
  }

  return {
    success: false,
    status: 'MANUAL_REVIEW',
    reason: 'Issuer verification could not be completed.',
    issuer: issuerEntry.name,
    method: issuerEntry.verificationMethod,
    httpStatus: null,
    certificateIdMatched: false,
    latencyMs: Date.now() - startTime
  };
}

module.exports = {
  TRUSTED_ISSUER_REGISTRY,
  isPrivateOrBlockedIp,
  findIssuerInRegistry,
  isDomainAllowed,
  validateIssuerVerificationUrl,
  resolveAndValidateDns,
  verifyIssuerCertificate
};
