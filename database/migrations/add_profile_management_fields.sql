-- ==============================================================================
-- Migration: Add Profile Management Fields
-- Database: student_credential_engine
-- Table: public.profiles
-- ==============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_qualification VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT DEFAULT NULL;
