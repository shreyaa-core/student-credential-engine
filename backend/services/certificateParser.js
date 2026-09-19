// ==============================================================================
// Student Micro-Credential Verification Engine - Certificate Parser Service
// ==============================================================================

const fs = require('fs');
const path = require('path');
const pdfModule = require('pdf-parse');
const Tesseract = require('tesseract.js');
const { createCanvas } = require('@napi-rs/canvas');

/**
 * OCR Timeout configuration in milliseconds.
 * Set to 30 seconds to provide ample time for OCR processing
 * while guaranteeing the pipeline stays well under the 60s overall ceiling.
 */
const OCR_TIMEOUT_MS = 30000;

/**
 * Promise timeout wrapper to prevent any OCR operation from hanging indefinitely.
 */
function withTimeout(promise, ms, timeoutErrorMsg = 'Operation timed out') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(timeoutErrorMsg));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * 1. cleanExtractedText(rawText)
 * 
 * Reusable text-cleaning function:
 * - Normalizes excessive horizontal whitespace (tabs, consecutive spaces)
 * - Normalizes line breaks (preserves paragraphs while collapsing 3+ consecutive newlines)
 * - Trims leading and trailing whitespace
 * - Preserves URLs, certificate IDs, dates, names, and course titles
 * 
 * @param {string} rawText - Raw text from PDF parser or OCR
 * @returns {string} - Cleaned, normalized text
 */
function cleanExtractedText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  return rawText
    // Replace Windows CRLF and form feeds with standard newlines
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\f/g, '\n')
    // Replace non-breaking spaces and tabs with normal space
    .replace(/[\t\u00A0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
    // Collapse multiple horizontal spaces into a single space on each line
    .split('\n')
    .map((line) => line.replace(/[ ]+/g, ' ').trim())
    .join('\n')
    // Collapse 3 or more consecutive blank lines into 2 (preserves paragraph breaks)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 2. isSufficientText(text)
 * 
 * Deterministic text-quality check to decide whether PDF parser output is meaningful
 * or merely empty/scanned artifacts (such as lone page numbers like "-- 1 of 1 --").
 * 
 * Quality Thresholds:
 * - Total trimmed character length >= 50
 * - Total alphabetic characters ([a-zA-Z]) >= 30
 * - Readable words (tokens matching /^[a-zA-Z0-9_\-']{2,}$/) >= 8
 * 
 * If all 3 conditions are satisfied, text is sufficient and OCR is skipped.
 * Otherwise, OCR fallback is triggered.
 * 
 * @param {string} text - Cleaned text from PDF parser
 * @returns {boolean} - True if text meets quality thresholds
 */
function isSufficientText(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length < 50) return false;

  const alphaMatches = trimmed.match(/[a-zA-Z]/g);
  const alphaCount = alphaMatches ? alphaMatches.length : 0;
  if (alphaCount < 30) return false;

  const words = trimmed.split(/\s+/).filter((w) => /^[a-zA-Z0-9_\-']{2,}$/.test(w));
  if (words.length < 8) return false;

  return true;
}

/**
 * 3. parsePDF(filePath, fileBuffer)
 * 
 * Extracts raw textual content from a PDF document using pdf-parse across all pages.
 * Supports both class-based (v2) and function-based (v1) pdf-parse interfaces.
 * 
 * @param {string} filePath - Path to the PDF file
 * @param {Buffer} [fileBuffer] - Optional direct file binary buffer
 * @returns {Promise<string>} - Cleaned text extracted from the PDF
 */
async function parsePDF(filePath, fileBuffer = null) {
  try {
    const dataBuffer = fileBuffer || fs.readFileSync(filePath);

    if (pdfModule.PDFParse) {
      const parser = new pdfModule.PDFParse({ data: dataBuffer });
      const result = await parser.getText();
      return cleanExtractedText(result.text || '');
    }

    if (typeof pdfModule === 'function') {
      const result = await pdfModule(dataBuffer);
      return cleanExtractedText(result.text || '');
    }

    throw new Error('Unsupported pdf-parse interface');
  } catch (error) {
    console.error('Error parsing PDF natively:', error.message);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

/**
 * 4. renderPdfToImageBuffers(filePathOrBuffer, maxPages)
 * 
 * Renders pages of a scanned/image-based PDF to high-resolution PNG image buffers
 * using pdfjs-dist and @napi-rs/canvas.
 * 
 * @param {string|Buffer} filePathOrBuffer - Path or Buffer of the PDF
 * @param {number} [maxPages=5] - Maximum number of pages to render
 * @returns {Promise<Buffer[]>} - Array of PNG buffers in document order
 */
async function renderPdfToImageBuffers(filePathOrBuffer, maxPages = 5) {
  let pdfjsLib;
  try {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  } catch (_) {
    pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
  }

  const data = Buffer.isBuffer(filePathOrBuffer)
    ? new Uint8Array(filePathOrBuffer)
    : new Uint8Array(fs.readFileSync(filePathOrBuffer));

  const doc = await pdfjsLib.getDocument({ data }).promise;
  const imageBuffers = [];
  const totalPages = Math.min(doc.numPages, maxPages);

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');

    await page.render({
      canvasContext: ctx,
      viewport: viewport,
    }).promise;

    imageBuffers.push(canvas.toBuffer('image/png'));
  }

  return imageBuffers;
}

/**
 * 5. parseImage(imageSource, timeoutMs)
 * 
 * Extracts text from image files (PNG, JPG, JPEG) or image buffers using Tesseract.js.
 * Governed by OCR_TIMEOUT_MS to prevent blocking the server.
 * 
 * @param {string|Buffer} imageSource - Image file path or binary buffer
 * @param {number} [timeoutMs=OCR_TIMEOUT_MS] - Timeout limit in ms
 * @returns {Promise<string>} - Extracted and cleaned OCR text
 */
async function parseImage(imageSource, timeoutMs = OCR_TIMEOUT_MS) {
  try {
    return await withTimeout(
      Tesseract.recognize(imageSource, 'eng').then((res) => cleanExtractedText(res.data?.text || '')),
      timeoutMs,
      `OCR processing exceeded timeout limit of ${timeoutMs / 1000}s`
    );
  } catch (error) {
    console.error('Error performing Tesseract OCR on image:', error.message);
    throw new Error(`Failed to parse image via OCR: ${error.message}`);
  }
}

/**
 * 6. parseScannedPdf(filePathOrBuffer, timeoutMs)
 * 
 * Renders pages of a scanned PDF to images and executes Tesseract OCR on each page in document order.
 * 
 * @param {string|Buffer} filePathOrBuffer - Path or Buffer of the PDF
 * @param {number} [timeoutMs=OCR_TIMEOUT_MS] - Timeout limit in ms
 * @returns {Promise<string>} - Combined cleaned OCR text across all rendered pages
 */
async function parseScannedPdf(filePathOrBuffer, timeoutMs = OCR_TIMEOUT_MS) {
  const pageImages = await renderPdfToImageBuffers(filePathOrBuffer);
  const ocrTexts = [];

  for (const imgBuf of pageImages) {
    const pageText = await parseImage(imgBuf, timeoutMs);
    if (pageText) {
      ocrTexts.push(pageText);
    }
  }

  return cleanExtractedText(ocrTexts.join('\n\n'));
}

/**
 * 7. parseCertificate(filePath, fileType, fileBuffer)
 * 
 * Main certificate text extraction pipeline:
 * 1. For PDF files:
 *    a. First attempts native PDF text extraction using pdf-parse across all pages.
 *    b. Checks text quality with isSufficientText.
 *    c. If sufficient, returns native text (OCR skipped).
 *    d. If insufficient (scanned/image PDF), falls back to renderPdfToImageBuffers + Tesseract OCR.
 * 2. For Image files (PNG, JPG, JPEG):
 *    Directly executes Tesseract OCR on the image.
 * 3. Handles timeouts and processing errors gracefully without crashing.
 * 
 * @param {string} filePath - Path to certificate file on disk
 * @param {string} [fileType=''] - MIME type or file extension
 * @param {Buffer} [fileBuffer=null] - Direct memory buffer if available
 * @returns {Promise<{
 *   text: string,
 *   type: string,
 *   method: 'pdf_parse' | 'tesseract_ocr' | 'failed',
 *   ocrUsed: boolean,
 *   durationMs: number,
 *   error?: string
 * }>}
 */
async function parseCertificate(filePath, fileType = '', fileBuffer = null) {
  const ext = path.extname(filePath || '').toLowerCase();
  const normalizedType = (fileType || '').toLowerCase();
  const isPDF = normalizedType.includes('pdf') || ext === '.pdf';
  const startTime = Date.now();

  if (isPDF) {
    let pdfText = '';
    let pdfDuration = 0;

    // Phase 1: Native PDF text extraction
    try {
      const pdfStart = Date.now();
      pdfText = await parsePDF(filePath, fileBuffer);
      pdfDuration = Date.now() - pdfStart;
    } catch (pdfErr) {
      console.warn('Native PDF extraction failed, proceeding to OCR fallback:', pdfErr.message);
      pdfText = '';
    }

    // Phase 2: Check text sufficiency
    if (isSufficientText(pdfText)) {
      return {
        text: pdfText,
        type: 'pdf',
        method: 'pdf_parse',
        ocrUsed: false,
        durationMs: Date.now() - startTime,
      };
    }

    // Phase 3: Scanned PDF fallback to Tesseract OCR
    console.log(`Notice: PDF text insufficient (${pdfText.length} chars). Initiating Tesseract OCR fallback...`);
    try {
      const ocrStart = Date.now();
      const combinedOcrText = await parseScannedPdf(fileBuffer || filePath, OCR_TIMEOUT_MS);
      return {
        text: combinedOcrText,
        type: 'pdf',
        method: 'tesseract_ocr',
        ocrUsed: true,
        durationMs: Date.now() - startTime,
        ocrDurationMs: Date.now() - ocrStart,
        pdfParseDurationMs: pdfDuration,
      };
    } catch (ocrErr) {
      console.error('Tesseract OCR fallback failed or timed out:', ocrErr.message);
      return {
        text: '',
        type: 'pdf',
        method: 'failed',
        ocrUsed: true,
        durationMs: Date.now() - startTime,
        error: ocrErr.message,
      };
    }
  } else {
    // Image certificate processing (PNG, JPG, JPEG)
    try {
      const imgSource = fileBuffer || filePath;
      const ocrText = await parseImage(imgSource, OCR_TIMEOUT_MS);
      return {
        text: ocrText,
        type: 'image',
        method: 'tesseract_ocr',
        ocrUsed: true,
        durationMs: Date.now() - startTime,
      };
    } catch (imgErr) {
      console.error('Image OCR failed or timed out:', imgErr.message);
      return {
        text: '',
        type: 'image',
        method: 'failed',
        ocrUsed: true,
        durationMs: Date.now() - startTime,
        error: imgErr.message,
      };
    }
  }
}

module.exports = {
  OCR_TIMEOUT_MS,
  withTimeout,
  cleanExtractedText,
  isSufficientText,
  parsePDF,
  renderPdfToImageBuffers,
  parseImage,
  parseScannedPdf,
  parseCertificate,
};
