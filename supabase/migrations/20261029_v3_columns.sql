-- V3 columns — safe ADD COLUMN IF NOT EXISTS; no existing data is deleted or altered

ALTER TABLE statements ADD COLUMN IF NOT EXISTS raw_statement TEXT;
ALTER TABLE statements ADD COLUMN IF NOT EXISTS prompt_version TEXT;
ALTER TABLE statements ADD COLUMN IF NOT EXISTS shortlisted TEXT;
ALTER TABLE statements ADD COLUMN IF NOT EXISTS interview TEXT;

-- Treat existing rows with null prompt_version as 'v2'
-- (application code already handles null as v2; this UPDATE is optional but keeps the DB tidy)
UPDATE statements SET prompt_version = 'v2' WHERE prompt_version IS NULL;
