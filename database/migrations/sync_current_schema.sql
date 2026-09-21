-- ==============================================================================
-- Migration: Synchronize Current PostgreSQL Schema Safely
-- File: database/migrations/sync_current_schema.sql
-- Description: Non-destructive schema alignment for existing databases.
-- Adds missing columns, constraints, and indexes without dropping or truncating.
-- ==============================================================================

-- 1. Ensure pgcrypto extension is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Add profile management columns if missing
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_qualification VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT DEFAULT NULL;

-- 3. Add certificate processing and verification columns if missing
ALTER TABLE public.certificates
ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS raw_text TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS certificate_id VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS issue_date DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS verification_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS verification_evidence JSONB DEFAULT NULL;

-- 4. Create index on certificates(file_hash) if not exists
CREATE INDEX IF NOT EXISTS idx_certificates_file_hash ON public.certificates(file_hash);

-- 5. Create composite unique constraint on (student_id, file_hash) for user-scoped duplicate prevention
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_certificates_student_file_hash'
    ) THEN
        ALTER TABLE public.certificates
        ADD CONSTRAINT uq_certificates_student_file_hash UNIQUE (student_id, file_hash);
    END IF;
END $$;

-- 6. Ensure certificate status constraint supports all current statuses
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_certificates_status'
    ) THEN
        ALTER TABLE public.certificates
        ADD CONSTRAINT chk_certificates_status CHECK (
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
        );
    END IF;
END $$;
