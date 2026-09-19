-- ==============================================================================
-- Database Migration: Remove Email Verification Columns from Profiles Table
-- Project: Automated Student Micro-Credential & Skill Verification Engine
-- ==============================================================================

-- Drop index associated with verification_token if it exists
DROP INDEX IF EXISTS idx_profiles_verification_token;

-- Remove email verification columns from profiles table
ALTER TABLE profiles
    DROP COLUMN IF EXISTS is_verified,
    DROP COLUMN IF EXISTS verification_token,
    DROP COLUMN IF EXISTS verification_token_expires_at,
    DROP COLUMN IF EXISTS verified_at;
