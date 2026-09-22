// ==============================================================================
// Student Micro-Credential Verification Engine - Key Generation Script
// FOR LOCAL DEVELOPMENT ONLY
// In production, keys must be managed in a secure KMS/HSM service.
// ==============================================================================

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const KEYS_DIR = path.resolve(__dirname, '../.keys');
const KEY_FILE = path.join(KEYS_DIR, 'badge_signing_key.json');

/**
 * Generates or loads an Ed25519 Multikey pair for local development signing.
 * Does NOT overwrite existing keys.
 * 
 * @returns {Promise<object>} Exported keypair with publicKey and secretKey (Multikey format)
 */
async function ensureBadgeSigningKey() {
  if (fs.existsSync(KEY_FILE)) {
    const raw = fs.readFileSync(KEY_FILE, 'utf8');
    const existingKey = JSON.parse(raw);
    return existingKey;
  }

  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  const Ed25519Multikey = await import('@digitalbazaar/ed25519-multikey');
  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5000';
  const controller = process.env.BADGE_ISSUER_URL || `${appBaseUrl}/api/badges/issuer`;
  const keyId = `${controller}/keys/key-1`;

  const keyPair = await Ed25519Multikey.generate({
    id: keyId,
    controller,
  });

  const exported = await keyPair.export({
    publicKey: true,
    secretKey: true,
    includeContext: true,
  });
  exported.id = keyId;
  exported.controller = controller;

  // Persist locally with restricted file permissions
  fs.writeFileSync(KEY_FILE, JSON.stringify(exported, null, 2), { encoding: 'utf8', mode: 0o600 });
  console.log('[DEVELOPMENT ONLY] Generated local badge signing key pair at:', KEY_FILE);

  return exported;
}

if (require.main === module) {
  ensureBadgeSigningKey()
    .then((key) => {
      console.log('[DEVELOPMENT ONLY] Key ID:', key.id);
      console.log('[DEVELOPMENT ONLY] Controller:', key.controller);
      console.log('[DEVELOPMENT ONLY] Public Key Multibase:', key.publicKeyMultibase);
      console.log('[DEVELOPMENT ONLY] Key initialization complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[DEVELOPMENT ONLY] Error generating signing key:', err);
      process.exit(1);
    });
}

module.exports = {
  ensureBadgeSigningKey,
  KEY_FILE,
  KEYS_DIR,
};
