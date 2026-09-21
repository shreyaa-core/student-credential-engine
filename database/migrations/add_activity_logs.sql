-- ==============================================================================
-- Migration: Add Activity Logs & Activity Skills
-- File: database/migrations/add_activity_logs.sql
-- 
-- Non-destructive migration:
-- 1. Creates activity_logs table for student co-curricular activities
-- 2. Creates activity_skills junction table linking to canonical skills taxonomy
-- 3. Adds performance indexes and integrity constraints
-- ==============================================================================

-- 1. ACTIVITY_LOGS
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

-- 2. ACTIVITY_SKILLS
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
