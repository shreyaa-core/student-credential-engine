-- ==============================================================================
-- Database Migration: Add Email Verification Columns to Profiles Table
-- Project: Automated Student Micro-Credential & Skill Verification Engine
-- ==============================================================================

-- 1. Add email verification columns using ALTER TABLE and IF NOT EXISTS
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Create index on verification_token to optimize token verification queries
CREATE INDEX IF NOT EXISTS idx_profiles_verification_token 
    ON profiles(verification_token);

-- 3. Document added columns with PostgreSQL COMMENT ON COLUMN
COMMENT ON COLUMN profiles.is_verified IS 'Indicates whether the user has verified their email address';
COMMENT ON COLUMN profiles.verification_token IS 'Cryptographically secure single-use token sent via email for account verification';
COMMENT ON COLUMN profiles.verification_token_expires_at IS 'Expiration timestamp for the email verification token';
COMMENT ON COLUMN profiles.verified_at IS 'Timestamp when the user successfully completed email verification';

-- 4. Grandfather existing user accounts so existing profiles remain verified and able to log in
UPDATE profiles
SET is_verified = TRUE
WHERE is_verified IS NULL OR is_verified = FALSE;
