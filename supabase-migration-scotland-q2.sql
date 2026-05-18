-- ============================================================
-- NHS Statement Writer – Scotland Q2 Variation Migration
-- Run in Supabase SQL editor. Safe to re-run.
-- ============================================================

-- Add scotland_q2_variation column to clients table (idempotent)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS scotland_q2_variation TEXT NOT NULL DEFAULT '';
