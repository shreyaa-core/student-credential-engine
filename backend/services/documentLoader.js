// ==============================================================================
// Student Micro-Credential Verification Engine - Pinned Document Loader
// Ensures deterministic, offline-capable JSON-LD and Open Badges 3.0 processing
// without external runtime network dependencies on 1EdTech or W3C servers.
// ==============================================================================

const fs = require('fs');
const path = require('path');

const CONTEXTS_DIR = path.resolve(__dirname, '../config/contexts');

const CONTEXT_FILES = {
  'https://www.w3.org/ns/credentials/v2': 'credentials-v2.json',
  'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json': 'ob-v3p0.json',
  'https://w3id.org/security/data-integrity/v2': 'data-integrity-v2.json',
  'https://w3id.org/security/multikey/v1': 'multikey-v1.json',
  'https://www.w3.org/ns/did/v1': 'did-v1.json',
};

// Cache parsed context objects in memory
const contextCache = new Map();
for (const [uri, filename] of Object.entries(CONTEXT_FILES)) {
  const filePath = path.join(CONTEXTS_DIR, filename);
  if (fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      contextCache.set(uri, parsed);
    } catch (e) {
      console.warn(`[DocumentLoader] Failed to pre-parse context ${filename}:`, e.message);
    }
  }
}

/**
 * Creates a document loader with local context pinning and dynamic local issuer resolution.
 * 
 * @param {object} [options]
 * @param {string} [options.issuerId] - Issuer Profile URI
 * @param {string} [options.keyId] - Verification Method URI
 * @param {object} [options.publicKeyDocument] - Public key Multikey document
 * @param {object} [options.issuerDocument] - Issuer profile document
 * @returns {Function} documentLoader function compatible with jsonld-signatures
 */
function createDocumentLoader(options = {}) {
  const {
    issuerId,
    keyId,
    publicKeyDocument,
    issuerDocument,
  } = options;

  return async function documentLoader(url) {
    // 1. Check pinned standard contexts
    if (contextCache.has(url)) {
      return {
        contextUrl: null,
        documentUrl: url,
        document: contextCache.get(url),
      };
    }

    // 2. Check local public key document
    if (keyId && url === keyId && publicKeyDocument) {
      return {
        contextUrl: null,
        documentUrl: url,
        document: publicKeyDocument,
      };
    }

    // 3. Check local issuer profile document
    if (issuerId && url === issuerId && issuerDocument) {
      return {
        contextUrl: null,
        documentUrl: url,
        document: issuerDocument,
      };
    }

    throw new Error(`[DocumentLoader] Refusing external network fetch for unpinned URL: ${url}`);
  };
}

module.exports = {
  createDocumentLoader,
  contextCache,
};
