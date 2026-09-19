-- ==============================================================================
-- Migration: Add Certificate Verification & Processing Fields
-- Database: student_credential_engine
-- Table: public.certificates
-- ==============================================================================

-- 1. Add verification and document-processing columns
ALTER TABLE public.certificates
ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS raw_text TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS certificate_id VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS issue_date DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS verification_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS verification_evidence JSONB DEFAULT NULL;

-- 2. Create non-unique index on file_hash for fast duplicate detection
CREATE INDEX IF NOT EXISTS idx_certificates_file_hash ON public.certificates(file_hash);

-- 3. Add status check constraint supporting Version 1 statuses and legacy records
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
