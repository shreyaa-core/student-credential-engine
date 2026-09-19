// ==============================================================================
// Student Micro-Credential Verification Engine - OpenAI Client Configuration
// ==============================================================================

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { OpenAI } = require('openai');

/**
 * Checks whether OPENAI_API_KEY is configured in the environment without exposing secrets.
 * @returns {boolean}
 */
function isOpenAIConfigured() {
  const key = process.env.OPENAI_API_KEY;
  return Boolean(key && key.trim().length > 0);
}

/**
 * Returns an initialized OpenAI client instance if configured, or null if missing.
 * @returns {OpenAI|null}
 */
function getOpenAIClient() {
  if (!isOpenAIConfigured()) {
    return null;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY.trim(),
  });
}

/**
 * Performs a minimal, safe connectivity test against OpenAI API.
 * Does NOT send certificate data.
 * Does NOT print or expose any secret values.
 * 
 * @returns {Promise<{ status: 'NOT CONFIGURED' | 'INVALID API KEY' | 'OPENAI CONFIGURED', message: string }>}
 */
async function testOpenAIConnectivity() {
  if (!isOpenAIConfigured()) {
    return {
      status: 'NOT CONFIGURED',
      message: 'OPENAI_API_KEY is not set in backend/.env.',
    };
  }

  const client = getOpenAIClient();
  if (!client) {
    return {
      status: 'NOT CONFIGURED',
      message: 'OPENAI_API_KEY is missing or empty.',
    };
  }

  try {
    // Lightweight authenticated connectivity check (models list, limited to 1)
    await client.models.list();
    return {
      status: 'OPENAI CONFIGURED',
      message: 'OpenAI client authenticated and connected successfully.',
    };
  } catch (error) {
    const errorMsg = error.message || '';
    const statusCode = error.status || error.statusCode;

    if (statusCode === 401 || /incorrect|invalid|unauthorized|api[ _]?key/i.test(errorMsg)) {
      return {
        status: 'INVALID API KEY',
        message: 'The configured OPENAI_API_KEY is rejected as invalid or unauthorized.',
      };
    }

    return {
      status: 'CONNECTION ERROR',
      message: `Failed to connect to OpenAI: ${errorMsg}`,
    };
  }
}

function getOpenAIModel() {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

module.exports = {
  isOpenAIConfigured,
  getOpenAIClient,
  getOpenAIModel,
  testOpenAIConnectivity,
};
