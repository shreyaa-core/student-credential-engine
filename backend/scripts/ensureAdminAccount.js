/**
 * ensureAdminAccount.js
 *
 * Idempotent setup script: ensures exactly ONE admin account exists in PostgreSQL.
 *
 * Admin credentials:
 *   Email:    admin@test.in
 *   Password: Admin@1234 (stored as bcrypt hash, NEVER plaintext)
 *   Role:     admin
 *
 * Safety rules:
 *   - If admin@test.in already exists with role=admin → DO NOTHING.
 *   - If admin@test.in exists with wrong role → fix the role.
 *   - If admin@test.in does not exist → INSERT it.
 *   - Any other account that currently has role=admin → demote to issuer.
 *     (Keeps data intact, just changes their role.)
 *
 * Run with:  node backend/scripts/ensureAdminAccount.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const bcrypt = require('bcrypt');
const pool   = require('../config/database');

const ADMIN_EMAIL    = 'admin@test.in';
const ADMIN_PASSWORD = 'Admin@1234';
const ADMIN_NAME     = 'System Administrator';
const SALT_ROUNDS    = 10;

async function run() {
  console.log('='.repeat(60));
  console.log('Ensure Admin Account — Canonical Setup Script');
  console.log('='.repeat(60));

  try {
    // ── Step 1: Demote any NON-canonical admin accounts ──────────────────
    const demoteRes = await pool.query(
      `UPDATE profiles
          SET role = 'issuer'
        WHERE role = 'admin'
          AND LOWER(email) <> LOWER($1)
        RETURNING email`,
      [ADMIN_EMAIL]
    );
    if (demoteRes.rows.length > 0) {
      const demoted = demoteRes.rows.map(r => r.email);
      console.log(`[DEMOTED] ${demoted.length} non-canonical admin(s) → issuer: ${demoted.join(', ')}`);
    } else {
      console.log('[OK] No non-canonical admin accounts found.');
    }

    // ── Step 2: Check if canonical admin account already exists ──────────
    const existing = await pool.query(
      `SELECT id, full_name, email, role FROM profiles WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [ADMIN_EMAIL]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.role === 'admin') {
        console.log(`[OK] Canonical admin account already exists: ${row.email} (id: ${row.id})`);
        console.log('     Password is stored as a bcrypt hash — not changed by this script.');
        console.log('     If you need to reset the password, re-run this script after deleting the row.');
      } else {
        // Account exists but with wrong role — fix it
        await pool.query(
          `UPDATE profiles SET role = 'admin' WHERE LOWER(email) = LOWER($1)`,
          [ADMIN_EMAIL]
        );
        console.log(`[FIXED] Promoted ${ADMIN_EMAIL} from "${row.role}" → "admin".`);
      }
    } else {
      // ── Step 3: Insert canonical admin account ────────────────────────
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);
      const insertRes = await pool.query(
        `INSERT INTO profiles (full_name, email, password_hash, role, created_at)
         VALUES ($1, $2, $3, 'admin', NOW())
         RETURNING id, email, role`,
        [ADMIN_NAME, ADMIN_EMAIL, passwordHash]
      );
      const newRow = insertRes.rows[0];
      console.log(`[CREATED] Admin account inserted:`);
      console.log(`          id:    ${newRow.id}`);
      console.log(`          email: ${newRow.email}`);
      console.log(`          role:  ${newRow.role}`);
      console.log('          password: [bcrypt hash, not displayed]');
    }

    // ── Step 4: Final verification ────────────────────────────────────────
    const verify = await pool.query(
      `SELECT id, full_name, email, role FROM profiles WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [ADMIN_EMAIL]
    );
    const final = verify.rows[0];
    console.log('');
    console.log('[VERIFIED] Final admin account state:');
    console.log(`           id:    ${final.id}`);
    console.log(`           email: ${final.email}`);
    console.log(`           role:  ${final.role}`);
    console.log('='.repeat(60));
    console.log('Admin account setup complete.');

    // ── Step 5: Count total admin accounts (should be exactly 1) ─────────
    const countRes = await pool.query(`SELECT COUNT(*) FROM profiles WHERE role = 'admin'`);
    const adminCount = parseInt(countRes.rows[0].count, 10);
    if (adminCount === 1) {
      console.log(`[OK] Exactly 1 admin account exists in the database.`);
    } else {
      console.warn(`[WARN] Expected 1 admin, found ${adminCount}. Please investigate.`);
    }

  } catch (err) {
    console.error('[ERROR]', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
