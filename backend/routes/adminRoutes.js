// ==============================================================================
// Student Micro-Credential Verification Engine - Admin Routes
// ==============================================================================

const express = require('express');
const pool = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Admin authentication & authorization middleware:
// Strictly enforces valid authentication (HTTP 401) and admin role authorization (HTTP 403).
const adminAuth = [requireAuth, requireRole('admin')];

/**
 * 1. GET /api/admin/certificates
 * 
 * Purpose:
 * Get all uploaded certificates from the PostgreSQL database.
 * 
 * Return:
 * Array of certificates with:
 * - id
 * - certificate_name
 * - issuer
 * - status
 * - verification_score
 * - created_at
 */
router.get(['/certificates', '/'], adminAuth, async (req, res) => {
  try {
    // Query certificates table from PostgreSQL for administrative review
    const result = await pool.query(`
      SELECT id, certificate_name, issuer, status, verification_score, verification_url, verification_evidence, created_at 
      FROM certificates 
      ORDER BY created_at DESC;
    `);

    // Ensure all requested fields are normalized in the response
    const certificates = (result.rows || []).map((item) => ({
      id: item.id,
      certificate_name: item.certificate_name,
      issuer: item.issuer,
      status: item.status,
      verification_score: item.verification_score !== undefined ? item.verification_score : 0,
      verification_url: item.verification_url || null,
      verification_evidence: item.verification_evidence || null,
      created_at: item.created_at,
    }));

    return res.status(200).json(certificates);
  } catch (err) {
    console.error('Error fetching certificates for admin:', err.message);
    return res.status(500).json({
      error: err.message || 'Failed to fetch certificates for administration.',
    });
  }
});

/**
 * 2. GET /api/admin/certificates/:id/status
 * 
 * Purpose:
 * Check certificate status or view API instructions if testing in a web browser.
 */
router.get(['/certificates/:id/status', '/:id/status'], adminAuth, async (req, res) => {
  const { id } = req.params;

  // If user entered literal ':id' or a placeholder in the browser
  if (!id || id === ':id' || id === 'placeholder') {
    return res.status(200).json({
      endpoint: 'PUT /api/admin/certificates/:id/status',
      description: 'This endpoint is designed to update certificate verification status via HTTP PUT.',
      instructions: 'To update status, send an HTTP PUT request with JSON payload or use the Admin Dashboard.',
      expectedPayload: {
        status: 'APPROVED | REJECTED | PENDING',
        admin_notes: 'Optional remarks'
      },
      exampleUrl: 'http://localhost:5000/api/admin/certificates/<certificate-id>/status',
      frontendAdminDashboard: 'http://localhost:3000/admin'
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, certificate_name, issuer, status, verification_score, admin_notes, created_at 
       FROM certificates 
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: `Certificate with id "${id}" not found.`
      });
    }

    return res.status(200).json({
      success: true,
      certificate: result.rows[0]
    });
  } catch (err) {
    console.error('Error fetching certificate status:', err.message);
    return res.status(500).json({
      error: err.message || 'Failed to fetch certificate status.'
    });
  }
});

/**
 * 3. PUT /api/admin/certificates/:id/status
 * 
 * Purpose:
 * Update certificate status and optional administrative notes.
 * 
 * Input:
 * {
 *   status: "APPROVED",
 *   admin_notes: "Verified certificate"
 * }
 * 
 * Database:
 * Updates certificates table in PostgreSQL.
 */
router.put(['/certificates/:id/status', '/:id/status'], adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    // Check if literal ':id' was passed
    if (id === ':id') {
      return res.status(400).json({
        error: "Please replace ':id' in the URL with a real certificate ID (e.g. /api/admin/certificates/<uuid>/status)."
      });
    }

    // Validation: status is required
    if (!status) {
      return res.status(400).json({
        error: 'Status is required.',
      });
    }

    // Normalize status to canonical verified state:
    // When an Admin approves a certificate, it transitions to canonical 'VERIFIED' with score 100.
    let canonicalStatus = status.trim().toUpperCase();
    let score = 50;

    if (canonicalStatus === 'APPROVED' || canonicalStatus === 'VERIFIED') {
      canonicalStatus = 'VERIFIED';
      score = 100;
    } else if (canonicalStatus === 'REJECTED') {
      canonicalStatus = 'REJECTED';
      score = 0;
    } else {
      canonicalStatus = 'MANUAL_REVIEW';
      score = 50;
    }

    // Update certificate in PostgreSQL database
    const updateQuery = `
      UPDATE certificates 
      SET status = $1, admin_notes = $2, verification_score = $3
      WHERE id = $4
      RETURNING id, certificate_name, issuer, status, verification_score, admin_notes, created_at;
    `;

    const result = await pool.query(updateQuery, [canonicalStatus, admin_notes || null, score, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: `Certificate with id "${id}" not found.`,
      });
    }

    const updatedCertificate = result.rows[0];

    return res.status(200).json({
      success: true,
      message: 'Certificate status updated successfully',
      certificate: updatedCertificate,
    });
  } catch (err) {
    console.error('Error updating certificate status:', err.message);
    return res.status(500).json({
      error: err.message || 'Failed to update certificate status.',
    });
  }
});

module.exports = router;
