-- ==============================================================================
-- Automated Student Micro-Credential & Skill Verification Engine
-- Master PostgreSQL Database Schema (Canonical)
-- ==============================================================================

-- Enable UUID extension for PostgreSQL (supported across all standard versions)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. PROFILES
-- Stores user accounts, roles, and password credentials for local authentication
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'issuer' CHECK (role IN ('issuer', 'admin')),
    institution VARCHAR(255),
    bio TEXT,
    last_qualification VARCHAR(255),
    profile_photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 2. CERTIFICATES
-- Stores credentials submitted by students with verification status and file details
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    certificate_name VARCHAR(255) NOT NULL,
    issuer VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (
        status IN (
            'PROCESSING',
            'VERIFIED',
            'MANUAL_REVIEW',
            'VERIFICATION_TIMEOUT',
            'SUSPICIOUS',
            'REJECTED',
            'PENDING',
            'APPROVED'
        )
    ),
    verification_score INT DEFAULT 0,
    admin_notes TEXT,
    file_hash VARCHAR(64),
    raw_text TEXT,
    certificate_id VARCHAR(255),
    issue_date DATE,
    verification_url TEXT,
    verification_evidence JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_certificates_student_file_hash UNIQUE (student_id, file_hash)
);

-- Fast lookup index for certificate file content hashes
CREATE INDEX IF NOT EXISTS idx_certificates_file_hash ON certificates(file_hash);

-- ------------------------------------------------------------------------------
-- 3. SKILLS
-- Master catalog of unique competencies and skills extracted or recognized
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 4. CERTIFICATE_SKILLS
-- Junction table associating certificates with mapped skills and proficiency levels
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certificate_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    proficiency_level VARCHAR(50) DEFAULT 'Intermediate',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_certificate_skill UNIQUE (certificate_id, skill_id)
);

-- ------------------------------------------------------------------------------
-- 5. VERIFICATION_LOGS
-- Audit trail tracking credential verification attempts, verifiers, and outcomes
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    verifier_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    verification_status VARCHAR(50) NOT NULL,
    verification_method VARCHAR(50) DEFAULT 'qr_code',
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 6. BADGES
-- Digital visual badges awarded to students for completed and verified credentials
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    certificate_id UUID REFERENCES certificates(id) ON DELETE CASCADE,
    credential_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    image_url TEXT,
    criteria TEXT,
    credential_json JSONB NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_badges_certificate_id UNIQUE (certificate_id)
);

CREATE INDEX IF NOT EXISTS idx_badges_credential_id ON badges(credential_id);
CREATE INDEX IF NOT EXISTS idx_badges_student_id ON badges(student_id);
CREATE INDEX IF NOT EXISTS idx_badges_certificate_id ON badges(certificate_id);

-- ------------------------------------------------------------------------------
-- 7. ACTIVITY_LOGS
-- Stores co-curricular and extracurricular student activity records
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    activity_type VARCHAR(100) NOT NULL,
    organizer VARCHAR(255),
    description TEXT NOT NULL,
    activity_date DATE,
    evidence_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_student_id ON activity_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_activity_date ON activity_logs(activity_date);

-- ------------------------------------------------------------------------------
-- 8. ACTIVITY_SKILLS
-- Maps co-curricular activities to approved skills in the master skills taxonomy
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES activity_logs(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    evidence_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_activity_skill UNIQUE (activity_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_skills_activity_id ON activity_skills(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_skills_skill_id ON activity_skills(skill_id);

