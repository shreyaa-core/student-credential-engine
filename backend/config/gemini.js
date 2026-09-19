// ==============================================================================
// Student Micro-Credential Verification Engine - Google Gemini Configuration
// ==============================================================================

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { GoogleGenAI } = require('@google/genai');

/**
 * Checks whether GEMINI_API_KEY is configured in the environment without exposing secrets.
 * @returns {boolean}
 */
function isGeminiConfigured() {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim().length > 0);
}

/**
 * Returns the configured Gemini model name.
 * @returns {string}
 */
function getGeminiModel() {
  return process.env.GEMINI_MODEL || 'gemini-3.6-flash';
}

/**
 * Returns an initialized GoogleGenAI client instance if configured, or null if missing.
 * @returns {GoogleGenAI|null}
 */
function getGeminiClient() {
  if (!isGeminiConfigured()) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY.trim(),
  });
}

/**
 * Performs a minimal, safe connectivity test against the Google Gemini API.
 * Does NOT send certificate data.
 * Does NOT send database information.
 * Does NOT print or expose any secret values.
 * 
 * @returns {Promise<{
 *   status: 'GEMINI_CONNECTED' | 'GEMINI_NOT_CONFIGURED' | 'GEMINI_INVALID_KEY' | 'GEMINI_QUOTA_ERROR' | 'GEMINI_OTHER_ERROR',
 *   message: string
 * }>}
 */
async function testGeminiConnectivity() {
  if (!isGeminiConfigured()) {
    return {
      status: 'GEMINI_NOT_CONFIGURED',
      message: 'GEMINI_API_KEY is not set in backend/.env.',
    };
  }

  const client = getGeminiClient();
  if (!client) {
    return {
      status: 'GEMINI_NOT_CONFIGURED',
      message: 'GEMINI_API_KEY is missing or empty.',
    };
  }

  const model = getGeminiModel();

  try {
    // Minimal probe: sending 'ping', max output tokens 1
    const response = await client.models.generateContent({
      model,
      contents: 'ping',
      config: {
        maxOutputTokens: 1,
      },
    });

    if (response) {
      return {
        status: 'GEMINI_CONNECTED',
        message: 'Google Gemini client authenticated and connected successfully.',
      };
    }

    return {
      status: 'GEMINI_OTHER_ERROR',
      message: 'Empty response received from Gemini API.',
    };
  } catch (error) {
    const errorMsg = error.message || '';
    const statusCode = error.status || error.statusCode;

    // Check for invalid API key / authentication failures
    if (
      statusCode === 400 ||
      statusCode === 401 ||
      statusCode === 403 ||
      /invalid[ _]?key|api[ _]?key[ _]?not[ _]?valid|unauthorized|permission[ _]?denied/i.test(errorMsg)
    ) {
      return {
        status: 'GEMINI_INVALID_KEY',
        message: 'The configured GEMINI_API_KEY was rejected by Google Gemini API.',
      };
    }

    // Check for rate limit or quota exhaustion
    if (
      statusCode === 429 ||
      /quota|rate[ _]?limit|resource[ _]?exhausted/i.test(errorMsg)
    ) {
      return {
        status: 'GEMINI_QUOTA_ERROR',
        message: 'Google Gemini API quota exceeded or rate limit reached (HTTP 429).',
      };
    }

    return {
      status: 'GEMINI_OTHER_ERROR',
      message: `Gemini connectivity failed: ${errorMsg}`,
    };
  }
}

module.exports = {
  isGeminiConfigured,
  getGeminiModel,
  getGeminiClient,
  testGeminiConnectivity,
};
