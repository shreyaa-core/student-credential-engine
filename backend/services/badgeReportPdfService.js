// ==============================================================================
// Student Micro-Credential Verification Engine - Badge Report PDF Service
// ==============================================================================

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

/**
 * Sanitizes text to prevent pdf-lib StandardFonts encoding errors.
 * Standard Helvetica font in pdf-lib uses WinAnsiEncoding.
 * Replaces fancy bullets, em-dashes, and unsupported unicode with safe ASCII equivalents.
 */
function sanitizeText(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, '');
}

/**
 * Formats an ISO date string into a human-readable format.
 * Example: 2026-09-20T17:32:38.558Z -> 20 September 2026, 17:32 UTC
 */
function formatDateTime(isoString) {
  if (!isoString) return 'N/A';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return sanitizeText(isoString);
    return d.toUTCString().replace('GMT', 'UTC');
  } catch {
    return sanitizeText(isoString);
  }
}

/**
 * Formats a date string (YYYY-MM-DD or ISO).
 */
function formatDateOnly(dateStr) {
  if (!dateStr) return 'Not recorded';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return sanitizeText(dateStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return sanitizeText(dateStr);
  }
}

/**
 * Generates a real-time, dynamic Verified Credential Report PDF for an authenticated user.
 * 
 * @param {object} reportData - Clean report data object from badgeRoutes
 * @param {object} reportData.issuer - { id, fullName, role }
 * @param {number} reportData.verifiedCertificatesCount - Count of strictly VERIFIED certificates
 * @param {Array} reportData.verifiedCertificates - Array of verified certificate objects
 * @param {Array} reportData.overallSkills - Array of unique verified skills
 * @param {string} reportData.generatedAt - ISO timestamp of generation
 * 
 * @returns {Promise<Buffer>} - Buffer containing the binary PDF
 */
async function generateBadgeReportPdf(reportData = {}) {
  const {
    issuer = {},
    verifiedCertificatesCount = 0,
    verifiedCertificates = [],
    overallSkills = [],
    generatedAt = new Date().toISOString(),
  } = reportData;

  const pdfDoc = await PDFDocument.create();

  // Embed standard typography
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Palette definitions
  const primaryColor = rgb(0.08, 0.12, 0.22); // Deep navy slate
  const secondaryColor = rgb(0.25, 0.32, 0.44); // Mid slate
  const accentColor = rgb(0.31, 0.27, 0.9); // Indigo
  const verifiedGreen = rgb(0.02, 0.52, 0.34); // Emerald
  const lightGray = rgb(0.94, 0.95, 0.97); // Background panel
  const borderColor = rgb(0.85, 0.88, 0.92); // Panel border
  const textColor = rgb(0.12, 0.15, 0.2); // Main body text
  const mutedText = rgb(0.42, 0.48, 0.56); // Secondary text

  // A4 dimensions (in points): 595.28 x 841.89
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Pagination & Layout Helper
  function checkNewPage(neededSpace = 40) {
    if (y - neededSpace < margin + 40) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      return true;
    }
    return false;
  }

  // Draw Header Decorative Top Bar
  page.drawRectangle({
    x: 0,
    y: pageHeight - 6,
    width: pageWidth,
    height: 6,
    color: accentColor,
  });

  // --------------------------------------------------------------------------
  // HEADER SECTION
  // --------------------------------------------------------------------------
  page.drawText('DIGITAL BADGE', {
    x: margin,
    y: y,
    size: 10,
    font: boldFont,
    color: accentColor,
  });
  y -= 22;

  page.drawText('VERIFIED CREDENTIAL REPORT', {
    x: margin,
    y: y,
    size: 20,
    font: boldFont,
    color: primaryColor,
  });
  y -= 14;

  page.drawText('Official record of verified coursework micro-credentials and institutional skills', {
    x: margin,
    y: y,
    size: 9,
    font: regularFont,
    color: mutedText,
  });
  y -= 16;

  // Separator rule
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + contentWidth, y },
    thickness: 1,
    color: borderColor,
  });
  y -= 20;

  // --------------------------------------------------------------------------
  // 1. ISSUER / USER INFORMATION CARD
  // --------------------------------------------------------------------------
  const issuerCardHeight = 68;
  page.drawRectangle({
    x: margin,
    y: y - issuerCardHeight,
    width: contentWidth,
    height: issuerCardHeight,
    color: lightGray,
    borderColor: borderColor,
    borderWidth: 1,
  });

  const cardTextY = y - 18;
  page.drawText('ISSUER INFORMATION', {
    x: margin + 14,
    y: cardTextY,
    size: 8,
    font: boldFont,
    color: secondaryColor,
  });

  page.drawText(`Name:`, {
    x: margin + 14,
    y: cardTextY - 18,
    size: 10,
    font: boldFont,
    color: textColor,
  });
  page.drawText(sanitizeText(issuer.fullName || 'Authorized User'), {
    x: margin + 58,
    y: cardTextY - 18,
    size: 10,
    font: regularFont,
    color: textColor,
  });

  page.drawText(`Role:`, {
    x: margin + 260,
    y: cardTextY - 18,
    size: 10,
    font: boldFont,
    color: textColor,
  });
  page.drawText(sanitizeText(issuer.role || 'Issuer'), {
    x: margin + 295,
    y: cardTextY - 18,
    size: 10,
    font: regularFont,
    color: textColor,
  });

  page.drawText(`Generated:`, {
    x: margin + 14,
    y: cardTextY - 34,
    size: 9,
    font: boldFont,
    color: mutedText,
  });
  page.drawText(formatDateTime(generatedAt), {
    x: margin + 76,
    y: cardTextY - 34,
    size: 9,
    font: regularFont,
    color: mutedText,
  });

  y -= (issuerCardHeight + 24);

  // --------------------------------------------------------------------------
  // 2. VERIFIED CERTIFICATE SUMMARY
  // --------------------------------------------------------------------------
  checkNewPage(40);
  page.drawText('VERIFIED CERTIFICATE SUMMARY', {
    x: margin,
    y: y,
    size: 11,
    font: boldFont,
    color: primaryColor,
  });
  y -= 18;

  const countBadgeText = `Total Verified Certificates: ${verifiedCertificatesCount}`;
  page.drawText(countBadgeText, {
    x: margin,
    y: y,
    size: 12,
    font: boldFont,
    color: verifiedCertificatesCount > 0 ? verifiedGreen : secondaryColor,
  });
  y -= 22;

  // --------------------------------------------------------------------------
  // 3. VERIFIED CERTIFICATES DETAIL
  // --------------------------------------------------------------------------
  if (verifiedCertificatesCount === 0 || verifiedCertificates.length === 0) {
    // EMPTY STATE BLOCK
    checkNewPage(80);
    const emptyBoxHeight = 72;
    page.drawRectangle({
      x: margin,
      y: y - emptyBoxHeight,
      width: contentWidth,
      height: emptyBoxHeight,
      color: rgb(0.98, 0.98, 0.99),
      borderColor: borderColor,
      borderWidth: 1,
    });

    page.drawText('No verified credentials are currently available.', {
      x: margin + 16,
      y: y - 26,
      size: 11,
      font: boldFont,
      color: secondaryColor,
    });

    page.drawText(
      'Certificates will appear in this report once they have successfully completed authoritative verification.',
      {
        x: margin + 16,
        y: y - 44,
        size: 9,
        font: italicFont,
        color: mutedText,
      }
    );

    y -= (emptyBoxHeight + 24);
  } else {
    // RENDER LIST OF VERIFIED CERTIFICATES
    page.drawText('AUTHENTICATED ACHIEVEMENTS', {
      x: margin,
      y: y,
      size: 9,
      font: boldFont,
      color: secondaryColor,
    });
    y -= 14;

    verifiedCertificates.forEach((cert, index) => {
      const skillsList = Array.isArray(cert.skills) ? cert.skills : [];
      // Calculate estimated box height based on skills count
      const boxHeight = 76 + (skillsList.length > 0 ? Math.ceil(skillsList.length / 2) * 16 + 18 : 22);

      checkNewPage(boxHeight + 15);

      // Certificate Item Panel
      page.drawRectangle({
        x: margin,
        y: y - boxHeight,
        width: contentWidth,
        height: boxHeight,
        color: rgb(0.99, 1.0, 0.99),
        borderColor: rgb(0.78, 0.88, 0.82),
        borderWidth: 1,
      });

      let certY = y - 18;
      page.drawText(`Certificate ${index + 1}: ${sanitizeText(cert.certificateName || 'Untitled Certificate')}`, {
        x: margin + 14,
        y: certY,
        size: 11,
        font: boldFont,
        color: primaryColor,
      });

      certY -= 16;
      page.drawText(`Issuing Organization: `, {
        x: margin + 14,
        y: certY,
        size: 9,
        font: boldFont,
        color: secondaryColor,
      });
      page.drawText(sanitizeText(cert.issuer || 'Not specified'), {
        x: margin + 120,
        y: certY,
        size: 9,
        font: regularFont,
        color: textColor,
      });

      page.drawText(`Issue Date: `, {
        x: margin + 300,
        y: certY,
        size: 9,
        font: boldFont,
        color: secondaryColor,
      });
      page.drawText(formatDateOnly(cert.issueDate), {
        x: margin + 360,
        y: certY,
        size: 9,
        font: regularFont,
        color: textColor,
      });

      certY -= 18;
      page.drawText('Skills Learned:', {
        x: margin + 14,
        y: certY,
        size: 8.5,
        font: boldFont,
        color: accentColor,
      });

      certY -= 14;
      if (skillsList.length === 0) {
        page.drawText('None mapped', {
          x: margin + 24,
          y: certY,
          size: 8.5,
          font: italicFont,
          color: mutedText,
        });
      } else {
        // Render 2-column skills bullet items
        skillsList.forEach((skill, sIdx) => {
          const isSecondCol = sIdx % 2 === 1;
          const skillX = isSecondCol ? margin + 250 : margin + 24;
          const skillText = `- ${sanitizeText(skill.name)}${skill.proficiencyLevel ? ` (${sanitizeText(skill.proficiencyLevel)})` : ''}`;

          page.drawText(skillText, {
            x: skillX,
            y: certY,
            size: 8.5,
            font: regularFont,
            color: textColor,
          });

          if (isSecondCol || sIdx === skillsList.length - 1) {
            certY -= 14;
          }
        });
      }

      y -= (boxHeight + 14);
    });
  }

  // --------------------------------------------------------------------------
  // 4. OVERALL VERIFIED SKILLS SECTION
  // --------------------------------------------------------------------------
  if (overallSkills.length > 0) {
    checkNewPage(60);
    page.drawText('OVERALL VERIFIED SKILLS', {
      x: margin,
      y: y,
      size: 11,
      font: boldFont,
      color: primaryColor,
    });
    y -= 14;

    page.drawText('Unique competencies extracted and verified across all active credentials', {
      x: margin,
      y: y,
      size: 8.5,
      font: regularFont,
      color: mutedText,
    });
    y -= 16;

    overallSkills.forEach((skill) => {
      checkNewPage(16);
      const skillLine = `- ${sanitizeText(skill.name)}  ${skill.category ? `[${sanitizeText(skill.category)}]` : ''}`;
      page.drawText(skillLine, {
        x: margin + 8,
        y: y,
        size: 9,
        font: regularFont,
        color: textColor,
      });
      y -= 14;
    });

    y -= 10;
  }

  // --------------------------------------------------------------------------
  // 5. OFFICIAL VERIFICATION NOTICE & ATTESTATION FOOTER
  // --------------------------------------------------------------------------
  checkNewPage(70);
  y -= 10;
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + contentWidth, y },
    thickness: 1,
    color: borderColor,
  });
  y -= 16;

  page.drawText('OFFICIAL VERIFICATION NOTICE', {
    x: margin,
    y: y,
    size: 8,
    font: boldFont,
    color: secondaryColor,
  });
  y -= 12;

  const noticeTextLine1 = 'This report contains credentials and skills that have been authoritatively marked VERIFIED by the credential';
  const noticeTextLine2 = 'verification engine. Unverified, pending, under-review, or rejected records are strictly excluded from this report.';
  const noticeTextLine3 = `Report Generated: ${formatDateTime(generatedAt)} | Verification ID: SEC-${issuer.id?.substring(0, 8)?.toUpperCase() || 'SYS'}`;

  page.drawText(noticeTextLine1, {
    x: margin,
    y: y,
    size: 7.5,
    font: regularFont,
    color: mutedText,
  });
  y -= 10;

  page.drawText(noticeTextLine2, {
    x: margin,
    y: y,
    size: 7.5,
    font: regularFont,
    color: mutedText,
  });
  y -= 12;

  page.drawText(noticeTextLine3, {
    x: margin,
    y: y,
    size: 7.5,
    font: italicFont,
    color: mutedText,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

module.exports = {
  generateBadgeReportPdf,
};
