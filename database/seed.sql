-- ==============================================================================
-- Automated Student Micro-Credential & Skill Verification Engine
-- Canonical Skill Taxonomy Reference Data (Seed)
-- ==============================================================================

-- Insert canonical reference taxonomy skills
-- ON CONFLICT (name) DO NOTHING ensures safe, idempotent re-runs without duplication
INSERT INTO public.skills (name, category)
VALUES
    ('Python', 'Programming'),
    ('JavaScript', 'Programming'),
    ('React', 'Web Development'),
    ('Node.js', 'Web Development'),
    ('SQL', 'Database'),
    ('Machine Learning', 'Artificial Intelligence'),
    ('Deep Learning', 'Artificial Intelligence')
ON CONFLICT (name) DO NOTHING;
