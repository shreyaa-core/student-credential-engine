-- ==============================================================================
-- Student Micro-Credential Verification Engine - Migration
-- Upgrade badges table to Open Badges 3.0 Standard
-- ==============================================================================

-- 1. Add Open Badges 3.0 required columns if they do not exist
ALTER TABLE badges ADD COLUMN IF NOT EXISTS credential_id VARCHAR(255);
ALTER TABLE badges ADD COLUMN IF NOT EXISTS credential_json JSONB;
ALTER TABLE badges ADD COLUMN IF NOT EXISTS issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Allow image_url to be optional/nullable if not already
ALTER TABLE badges ALTER COLUMN image_url DROP NOT NULL;

-- 2. Add Unique constraints and indexes safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_badges_certificate_id'
  ) THEN
    ALTER TABLE badges ADD CONSTRAINT uq_badges_certificate_id UNIQUE (certificate_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_badges_credential_id'
  ) THEN
    ALTER TABLE badges ADD CONSTRAINT uq_badges_credential_id UNIQUE (credential_id);
  END IF;
END $$;

-- 3. Lookup indexes
CREATE INDEX IF NOT EXISTS idx_badges_credential_id ON badges(credential_id);
CREATE INDEX IF NOT EXISTS idx_badges_student_id ON badges(student_id);
CREATE INDEX IF NOT EXISTS idx_badges_certificate_id ON badges(certificate_id);
