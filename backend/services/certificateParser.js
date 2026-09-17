// ==============================================================================
// Student Micro-Credential Verification Engine - Certificate Parser Service
// ==============================================================================

const fs = require('fs');
const path = require('path');
const pdfModule = require('pdf-parse');
const Tesseract = require('tesseract.js');

/**
 * 1. parsePDF(filePath)
 * 
 * Extracts raw textual content from a PDF document using pdf-parse.
 * Compatible with both class-based (v2) and function-based (v1) pdf-parse releases.
 * 
 * @param {string} filePath - Absolute or relative local path to the PDF file
 * @returns {Promise<string>} - Extracted text from the PDF
 */
async function parsePDF(filePath) {
  try {
    // Read PDF file into binary buffer
    const dataBuffer = fs.readFileSync(filePath);

    // Support pdf-parse v2 (class-based: new PDFParse({ data }))
    if (pdfModule.PDFParse) {
      const parser = new pdfModule.PDFParse({ data: dataBuffer });
      const result = await parser.getText();
      return result.text ? result.text.trim() : '';
    }

    // Support pdf-parse v1 (function-based: pdf(dataBuffer))
    if (typeof pdfModule === 'function') {
      const result = await pdfModule(dataBuffer);
      return result.text ? result.text.trim() : '';
    }

    throw new Error('Unsupported pdf-parse interface');
  } catch (error) {
    console.error('Error parsing PDF file:', error.message);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

/**
 * 2. parseImage(filePath)
 * 
 * Extracts text from image files (PNG, JPG, JPEG) using optical character recognition (OCR) via Tesseract.js.
 * 
 * @param {string} filePath - Path to the image file
 * @returns {Promise<string>} - Extracted OCR text from the image
 */
async function parseImage(filePath) {
  try {
    // Perform optical character recognition using English dictionary
    const { data } = await Tesseract.recognize(filePath, 'eng');
    return data && data.text ? data.text.trim() : '';
  } catch (error) {
    console.error('Error performing OCR on image:', error.message);
    throw new Error(`Failed to parse image via OCR: ${error.message}`);
  }
}

/**
 * 3. parseCertificate(filePath, fileType)
 * 
 * Determines whether the uploaded certificate is a PDF document or an image file,
 * then delegates to parsePDF or parseImage accordingly.
 * 
 * @param {string} filePath - Local path to the certificate file
 * @param {string} [fileType] - Optional MIME type or extension (e.g. 'application/pdf', 'image/png', 'pdf', 'jpg')
 * @returns {Promise<{ text: string, type: string }>} - Object containing extracted text and document type
 */
async function parseCertificate(filePath, fileType = '') {
  // Normalize file extension and type check
  const ext = path.extname(filePath).toLowerCase();
  const normalizedType = (fileType || '').toLowerCase();

  const isPDF =
    normalizedType.includes('pdf') ||
    ext === '.pdf';

  let extractedText = '';
  let documentType = '';

  if (isPDF) {
    extractedText = await parsePDF(filePath);
    documentType = 'pdf';
  } else {
    // Treat as image file (PNG, JPG, JPEG, etc.)
    extractedText = await parseImage(filePath);
    documentType = 'image';
  }

  return {
    text: extractedText,
    type: documentType,
  };
}

module.exports = {
  parsePDF,
  parseImage,
  parseCertificate,
};
