-- ============================================================
-- NHS Statement Writer – Opening Style Migration
-- Run in Supabase SQL editor. Safe to re-run.
-- ============================================================

-- Add opening_style column to clients table (idempotent)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS opening_style TEXT NOT NULL DEFAULT '';
