-- Migration: track whether person specification was pasted when generating a statement
-- Run this in your Supabase dashboard → SQL Editor

ALTER TABLE statements
  ADD COLUMN IF NOT EXISTS pasted_person_spec TEXT;

-- Existing rows will have NULL (= no spec was pasted / pre-migration)
