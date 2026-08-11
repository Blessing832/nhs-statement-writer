-- Run this in Supabase SQL editor
CREATE TABLE IF NOT EXISTS vacancy_tracking (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_code TEXT NOT NULL,
  vacancy_id  TEXT NOT NULL,
  vacancy_title TEXT,
  status      TEXT NOT NULL CHECK (status IN ('done', 'closed')),
  marked_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (client_code, vacancy_id)
);

CREATE INDEX IF NOT EXISTS idx_vacancy_tracking_client ON vacancy_tracking (client_code);
CREATE INDEX IF NOT EXISTS idx_vacancy_tracking_marked ON vacancy_tracking (marked_at DESC);
