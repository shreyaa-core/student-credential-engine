-- ==============================================================================
-- Automated Student Micro-Credential & Skill Verification Engine
-- Database Schema for Supabase PostgreSQL
-- ==============================================================================

-- Enable UUID extension (built-in for Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLE
-- Stores user accounts (Students, Issuers, Verifiers, Admins)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'issuer', 'verifier', 'admin')),
    institution TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. CERTIFICATES TABLE
-- Stores student micro-credentials and verifiable certificates
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    issuer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT,
    credential_url TEXT,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiration_date DATE,
    status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'revoked', 'expired')),
    certificate_hash TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. SKILLS TABLE
-- Master list of competencies and skills that can be verified
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    category TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. CERTIFICATE_SKILLS TABLE (Junction Table)
-- Associates credentials with specific skills and proficiency levels
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certificate_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    proficiency_level TEXT DEFAULT 'Intermediate' CHECK (proficiency_level IN ('Beginner', 'Intermediate', 'Advanced', 'Expert')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (certificate_id, skill_id)
);

-- ------------------------------------------------------------------------------
-- 5. VERIFICATION_LOGS TABLE
-- Audit log tracking every time a credential is submitted for verification
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    verifier_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    verification_status TEXT NOT NULL CHECK (verification_status IN ('verified', 'failed', 'revoked', 'expired')),
    verification_method TEXT NOT NULL DEFAULT 'qr_code' CHECK (verification_method IN ('qr_code', 'hash_lookup', 'api', 'manual')),
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. BADGES TABLE
-- Digital visual badges awarded to students for completed credentials
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    certificate_id UUID REFERENCES certificates(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    criteria TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
