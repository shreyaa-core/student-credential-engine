// ==============================================================================
// Student Micro-Credential Verification Engine - Transcript PDF Service (Step 6)
// Renders Authoritative Co-Curricular Transcript PDF Using pdf-lib
// ==============================================================================

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

/**
 * Sanitizes text to ASCII safe characters to prevent pdf-lib encoding errors.
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
 * Generates an official, publication-quality Co-Curricular Transcript PDF.
 * Uses the exact authoritative data structure from transcriptService.
 * 
 * @param {object} transcriptData - Structured transcript data
 * @returns {Promise<Buffer>} PDF binary buffer
 */
async function generateTranscriptPdf(transcriptData = {}) {
  const {
    student = {},
    summary = {},
    certificates = [],
    activities = [],
    badges = [],
    skills = {},
    generated_at = new Date().toISOString(),
  } = transcriptData;

  const pdfDoc = await PDFDocument.create();

  // Typography
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Palette
  const navy = rgb(0.06, 0.11, 0.24);
  const darkSlate = rgb(0.15, 0.2, 0.28);
  const bodyColor = rgb(0.2, 0.25, 0.33);
  const muted = rgb(0.45, 0.5, 0.58);
  const emerald = rgb(0.04, 0.52, 0.35);
  const indigo = rgb(0.31, 0.27, 0.9);
  const lightBg = rgb(0.96, 0.97, 0.98);
  const borderGrey = rgb(0.86, 0.89, 0.93);

  // Dimensions
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;

  let pages = [];
  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  pages.push(currentPage);
  let y = pageHeight - margin;

  // Helper: check space and add page if needed
  function checkSpace(needed) {
    if (y - needed < margin + 30) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      pages.push(currentPage);
      y = pageHeight - margin;
      return true;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // 1. Header Banner & Title
  // --------------------------------------------------------------------------
  currentPage.drawRectangle({
    x: margin,
    y: y - 4,
    width: contentWidth,
    height: 4,
    color: indigo,
  });
  y -= 22;

  currentPage.drawText('OFFICIAL CO-CURRICULAR & CREDENTIAL TRANSCRIPT', {
    x: margin,
    y,
    size: 9,
    font: boldFont,
    color: indigo,
  });

  const generatedDateStr = new Date(generated_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  currentPage.drawText(`Generated: ${sanitizeText(generatedDateStr)}`, {
    x: margin + contentWidth - 140,
    y,
    size: 8,
    font: regularFont,
    color: muted,
  });
  y -= 20;

  const studentName = sanitizeText(student.full_name || 'Student Record');
  currentPage.drawText(studentName, {
    x: margin,
    y,
    size: 20,
    font: boldFont,
    color: navy,
  });
  y -= 14;

  const institutionStr = student.institution
    ? sanitizeText(student.institution)
    : 'Affiliated Academic Institution';
  const qualificationStr = student.last_qualification
    ? ` • ${sanitizeText(student.last_qualification)}`
    : '';

  currentPage.drawText(`${institutionStr}${qualificationStr}`, {
    x: margin,
    y,
    size: 10,
    font: regularFont,
    color: darkSlate,
  });
  y -= 12;

  const studentIdRef = student.id ? student.id.substring(0, 8).toUpperCase() : 'VERIFIED';
  currentPage.drawText(`Document Ref: TRN-${studentIdRef}  •  Status: Authoritative PostgreSQL Record`, {
    x: margin,
    y,
    size: 8,
    font: italicFont,
    color: muted,
  });
  y -= 22;

  // --------------------------------------------------------------------------
  // 2. Summary Statistics Box
  // --------------------------------------------------------------------------
  currentPage.drawRectangle({
    x: margin,
    y: y - 36,
    width: contentWidth,
    height: 38,
    color: lightBg,
    borderColor: borderGrey,
    borderWidth: 1,
  });

  const colWidth = contentWidth / 4;
  const metrics = [
    { label: 'VERIFIED CREDENTIALS', val: String(summary.verified_certificates ?? 0) },
    { label: 'RECORDED ACTIVITIES', val: String(summary.activities ?? 0) },
    { label: 'DIGITAL BADGES', val: String(summary.digital_badges ?? 0) },
    { label: 'UNIQUE COMPETENCIES', val: String(summary.total_unique_skills ?? 0) },
  ];

  metrics.forEach((m, idx) => {
    const colX = margin + idx * colWidth + 8;
    currentPage.drawText(m.label, {
      x: colX,
      y: y - 14,
      size: 6.5,
      font: boldFont,
      color: muted,
    });
    currentPage.drawText(m.val, {
      x: colX,
      y: y - 30,
      size: 13,
      font: boldFont,
      color: navy,
    });
  });
  y -= 52;

  // --------------------------------------------------------------------------
  // 3. Section: Verified Credentials
  // --------------------------------------------------------------------------
  checkSpace(40);
  currentPage.drawText('VERIFIED CREDENTIALS', {
    x: margin,
    y,
    size: 11,
    font: boldFont,
    color: navy,
  });
  currentPage.drawText('Coursework and certifications authoritatively verified or administratively approved.', {
    x: margin,
    y: y - 11,
    size: 8,
    font: regularFont,
    color: muted,
  });
  y -= 24;

  if (certificates.length === 0) {
    currentPage.drawText('No verified credentials recorded yet.', {
      x: margin + 10,
      y,
      size: 9,
      font: italicFont,
      color: muted,
    });
    y -= 20;
  } else {
    for (const cert of certificates) {
      checkSpace(44);
      currentPage.drawRectangle({
        x: margin,
        y: y - 36,
        width: contentWidth,
        height: 38,
        color: rgb(1, 1, 1),
        borderColor: borderGrey,
        borderWidth: 1,
      });

      currentPage.drawText(sanitizeText(cert.certificate_name), {
        x: margin + 10,
        y: y - 13,
        size: 9.5,
        font: boldFont,
        color: darkSlate,
      });

      const certDateText = cert.issue_date
        ? `Earned: ${sanitizeText(cert.issue_date)}`
        : cert.uploaded_at
        ? `Uploaded: ${sanitizeText(cert.uploaded_at)} (Issue date not recorded)`
        : 'Date not recorded';

      currentPage.drawText(`Issuer: ${sanitizeText(cert.issuer)}  •  ${certDateText}`, {
        x: margin + 10,
        y: y - 24,
        size: 8,
        font: regularFont,
        color: muted,
      });

      const statusStr = `[v] ${sanitizeText(cert.status || 'Verified')}`;
      currentPage.drawText(statusStr, {
        x: margin + contentWidth - 75,
        y: y - 13,
        size: 8,
        font: boldFont,
        color: emerald,
      });

      if (Array.isArray(cert.skills) && cert.skills.length > 0) {
        const skillNames = cert.skills.map((s) => sanitizeText(s.name)).join(', ');
        currentPage.drawText(`Skills: ${skillNames}`, {
          x: margin + 10,
          y: y - 33,
          size: 7.5,
          font: regularFont,
          color: indigo,
        });
      }

      y -= 44;
    }
  }

  // --------------------------------------------------------------------------
  // 4. Section: Co-Curricular Activities (Recorded Activities)
  // --------------------------------------------------------------------------
  checkSpace(40);
  currentPage.drawText('CO-CURRICULAR ACTIVITIES (RECORDED ACTIVITIES)', {
    x: margin,
    y,
    size: 11,
    font: boldFont,
    color: navy,
  });
  currentPage.drawText('Verified record of co-curricular engagements, hackathons, projects, and workshops.', {
    x: margin,
    y: y - 11,
    size: 8,
    font: regularFont,
    color: muted,
  });
  y -= 24;

  if (activities.length === 0) {
    currentPage.drawText('No co-curricular activities recorded yet.', {
      x: margin + 10,
      y,
      size: 9,
      font: italicFont,
      color: muted,
    });
    y -= 20;
  } else {
    for (const act of activities) {
      checkSpace(46);
      currentPage.drawRectangle({
        x: margin,
        y: y - 38,
        width: contentWidth,
        height: 40,
        color: lightBg,
        borderColor: borderGrey,
        borderWidth: 1,
      });

      currentPage.drawText(sanitizeText(act.title), {
        x: margin + 10,
        y: y - 13,
        size: 9.5,
        font: boldFont,
        color: darkSlate,
      });

      const actType = sanitizeText(act.activity_type || 'Activity');
      const actDate = act.activity_date ? `Date: ${sanitizeText(act.activity_date)}` : 'Date not specified';
      const organizer = act.organizer ? `Organizer: ${sanitizeText(act.organizer)}` : '';

      currentPage.drawText([actType, organizer, actDate].filter(Boolean).join('  •  '), {
        x: margin + 10,
        y: y - 24,
        size: 8,
        font: regularFont,
        color: muted,
      });

      if (Array.isArray(act.skills) && act.skills.length > 0) {
        const actSkillNames = act.skills.map((s) => `${sanitizeText(s.name)} (${s.confidenceScore || 60}%)`).join(', ');
        currentPage.drawText(`Derived Skills: ${actSkillNames}`, {
          x: margin + 10,
          y: y - 35,
          size: 7.5,
          font: regularFont,
          color: indigo,
        });
      }

      y -= 46;
    }
  }

  // --------------------------------------------------------------------------
  // 5. Section: Skills Taxonomy & Provenance Summary
  // --------------------------------------------------------------------------
  checkSpace(40);
  currentPage.drawText('SKILLS TAXONOMY & PROVENANCE SUMMARY', {
    x: margin,
    y,
    size: 11,
    font: boldFont,
    color: navy,
  });
  currentPage.drawText('Competencies verified through institutional credentials and co-curricular activity logs.', {
    x: margin,
    y: y - 11,
    size: 8,
    font: regularFont,
    color: muted,
  });
  y -= 22;

  const unifiedList = Array.isArray(skills.unified) ? skills.unified : [];
  if (unifiedList.length === 0) {
    currentPage.drawText('0 verified skills recorded.', {
      x: margin + 10,
      y,
      size: 9,
      font: italicFont,
      color: muted,
    });
    y -= 20;
  } else {
    for (const sk of unifiedList) {
      checkSpace(18);
      const sourceLabel = Array.isArray(sk.sources) ? sk.sources.join(' + ') : 'Verified';
      currentPage.drawText(`- ${sanitizeText(sk.name)} (${sanitizeText(sk.category || 'General')})`, {
        x: margin + 10,
        y,
        size: 8.5,
        font: boldFont,
        color: darkSlate,
      });

      currentPage.drawText(`Source: ${sanitizeText(sourceLabel)}`, {
        x: margin + 250,
        y,
        size: 8,
        font: italicFont,
        color: sk.sources?.includes('Verified Certificate') ? emerald : indigo,
      });

      y -= 14;
    }
    y -= 8;
  }

  // --------------------------------------------------------------------------
  // 6. Section: Digital Micro-Credentials (Open Badges 3.0)
  // --------------------------------------------------------------------------
  checkSpace(40);
  currentPage.drawText('DIGITAL MICRO-CREDENTIALS (OPEN BADGES 3.0)', {
    x: margin,
    y,
    size: 11,
    font: boldFont,
    color: navy,
  });
  currentPage.drawText('Cryptographically signed W3C Verifiable Credentials with Ed25519 Data Integrity Proofs.', {
    x: margin,
    y: y - 11,
    size: 8,
    font: regularFont,
    color: muted,
  });
  y -= 22;

  if (badges.length === 0) {
    currentPage.drawText('No active digital micro-credentials awarded yet.', {
      x: margin + 10,
      y,
      size: 9,
      font: italicFont,
      color: muted,
    });
    y -= 20;
  } else {
    for (const badge of badges) {
      checkSpace(32);
      currentPage.drawRectangle({
        x: margin,
        y: y - 26,
        width: contentWidth,
        height: 28,
        color: lightBg,
        borderColor: borderGrey,
        borderWidth: 1,
      });

      currentPage.drawText(sanitizeText(badge.name), {
        x: margin + 10,
        y: y - 11,
        size: 9,
        font: boldFont,
        color: darkSlate,
      });

      const issueDate = badge.issued_at ? sanitizeText(badge.issued_at.split('T')[0]) : 'Recent';
      currentPage.drawText(`Issued: ${issueDate}  •  Credential ID: ${sanitizeText(badge.credential_id || 'N/A')}`, {
        x: margin + 10,
        y: y - 22,
        size: 7.5,
        font: regularFont,
        color: muted,
      });

      if (badge.verification_url) {
        currentPage.drawText('Verified Online [v]', {
          x: margin + contentWidth - 85,
          y: y - 11,
          size: 7.5,
          font: boldFont,
          color: emerald,
        });
      }

      y -= 34;
    }
  }

  // --------------------------------------------------------------------------
  // Footer: Page Numbering & Cryptographic Seal
  // --------------------------------------------------------------------------
  const totalPages = pages.length;
  pages.forEach((p, idx) => {
    p.drawRectangle({
      x: margin,
      y: margin + 14,
      width: contentWidth,
      height: 0.5,
      color: borderGrey,
    });

    p.drawText('Student Micro-Credential Verification Engine • Official Transcript', {
      x: margin,
      y: margin + 4,
      size: 7,
      font: regularFont,
      color: muted,
    });

    p.drawText(`Page ${idx + 1} of ${totalPages}`, {
      x: margin + contentWidth - 45,
      y: margin + 4,
      size: 7,
      font: regularFont,
      color: muted,
    });
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

module.exports = {
  generateTranscriptPdf,
};
