// ==============================================================================
// Student Micro-Credential Verification Engine - QR Code Service
// ==============================================================================

const QRCode = require('qrcode');

/**
 * Generates a QR code image as a Base64 Data URL for credential verification.
 * 
 * @param {string} url - Verification URL to encode
 * @param {object} [options] - Optional custom options for the QR generator
 * @returns {Promise<string>} - Base64 encoded QR image Data URL (data:image/png;base64,...)
 */
async function generateQRCode(url, options = {}) {
  try {
    if (!url || typeof url !== 'string') {
      throw new Error('A valid URL string is required to generate a QR code.');
    }

    // Default configuration for clear and readable QR code output
    const defaultOptions = {
      errorCorrectionLevel: 'H', // High error correction (30% recovery)
      type: 'image/png',
      margin: 2,
      width: 300,
      ...options,
    };

    // Generate Base64 Data URL image string
    const qrImageData = await QRCode.toDataURL(url, defaultOptions);

    return qrImageData;
  } catch (error) {
    console.error('Error generating QR code:', error.message);
    throw new Error(`Failed to generate QR code: ${error.message}`);
  }
}

module.exports = {
  generateQRCode,
};
