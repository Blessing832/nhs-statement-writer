-- Run this in Supabase SQL editor before deploying the code changes
ALTER TABLE nhs_vacancies
  ADD COLUMN IF NOT EXISTS date_posted TEXT,
  ADD COLUMN IF NOT EXISTS scrape_date TEXT;
