-- ============================================================
-- NHS Statement Writer – Vacancy Monitor Migration
-- Run this in your Supabase SQL editor (safe to re-run)
-- ============================================================

-- 1. Add permanent_only column (idempotent)
ALTER TABLE applicant_preferences
  ADD COLUMN IF NOT EXISTS permanent_only boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2. Remove duplicate test profiles created during development
--    (real profiles exist under the original codes)
-- ============================================================

-- Delete matches → preferences → client for each test duplicate
-- (cascade handles preferences + matches automatically via ON DELETE CASCADE)
DELETE FROM clients WHERE client_code IN (
  'VICTOR001', 'LEWA001', 'FISOPE001',
  'NKEM001', 'OLADIPUPO001', 'MONA001'
);

-- ============================================================
-- 3. Create new client profiles that don't yet exist
-- ============================================================

-- Wasiu's Wife (Bristol, Band 3, Care)
INSERT INTO clients (client_code, full_name, subscription_end)
VALUES ('WASIUWIFE01', 'Wasiu Wife', now() + interval '1 year')
ON CONFLICT (client_code) DO NOTHING;

-- Oma (Anywhere, Band 3, Care, Sponsorship)
INSERT INTO clients (client_code, full_name, subscription_end)
VALUES ('OMA00001', 'Oma', now() + interval '1 year')
ON CONFLICT (client_code) DO NOTHING;

-- ============================================================
-- 4. Upsert applicant preferences for all named clients
--    Matches by full_name — must match exactly as stored in DB
-- ============================================================

-- Helper: upsert preferences by name
-- Format: INSERT ... SELECT id FROM clients WHERE full_name ILIKE '...'
-- ON CONFLICT (client_id) DO UPDATE SET ...

-- Leo — Newport, Band 2-3, any type
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['Newport'],
  ARRAY['Band 2', 'Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'any',
  ARRAY['england','scotland','healthjobsuk']::text[],
  false,
  true
FROM clients WHERE full_name ILIKE 'Leo'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Gbemi — Sheffield / Manchester, Band 3, sponsorship (permanent + full-time)
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['Sheffield', 'Manchester'],
  ARRAY['Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'full-time',
  ARRAY['england','scotland','healthjobsuk']::text[],
  true,
  true
FROM clients WHERE full_name ILIKE 'Gbemi'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Shakirat — Sheffield, Band 3, sponsorship
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['Sheffield'],
  ARRAY['Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'full-time',
  ARRAY['england','scotland','healthjobsuk']::text[],
  true,
  true
FROM clients WHERE full_name ILIKE 'Shakirat'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Toye — Sheffield, Band 3, care only (no admin)
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['Sheffield'],
  ARRAY['Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'any',
  ARRAY['england','scotland','healthjobsuk']::text[],
  false,
  true
FROM clients WHERE full_name ILIKE 'Toye'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Bolu — London, Band 3, Admin / Project Management, sponsorship
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['London'],
  ARRAY['Band 3'],
  ARRAY['administrator', 'admin', 'project manager', 'project coordinator', 'project support',
        'administrative assistant', 'medical secretary', 'clerical officer', 'ward clerk'],
  'any',
  ARRAY['england','scotland','healthjobsuk']::text[],
  true,
  true
FROM clients WHERE full_name ILIKE 'Bolu'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Wasiu's Wife — Bristol, Band 3, Care
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['Bristol'],
  ARRAY['Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'any',
  ARRAY['england','healthjobsuk']::text[],
  false,
  true
FROM clients WHERE client_code = 'WASIUWIFE01'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Shina — Derby / Sherwood, Band 3, Care
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['Derby', 'Nottingham', 'Sherwood'],
  ARRAY['Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'any',
  ARRAY['england','healthjobsuk']::text[],
  false,
  true
FROM clients WHERE full_name ILIKE 'Shina'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Oladipupo — Sheffield, Band 3, Care, full-time permanent
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['Sheffield'],
  ARRAY['Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'full-time',
  ARRAY['england','healthjobsuk']::text[],
  true,
  true
FROM clients WHERE full_name ILIKE 'Oladipupo'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Ridah — Sheffield / Rotherham / Barnsley, Band 3, Care
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['Sheffield', 'Rotherham', 'Barnsley'],
  ARRAY['Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'any',
  ARRAY['england','healthjobsuk']::text[],
  false,
  true
FROM clients WHERE full_name ILIKE 'Ridah'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Lewa — Anywhere, Band 3, Care, full-time permanent
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['anywhere'],
  ARRAY['Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'full-time',
  ARRAY['england','scotland','healthjobsuk']::text[],
  true,
  true
FROM clients WHERE full_name ILIKE 'Lewa'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Fisope — Anywhere, Band 3, Care, full-time permanent
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['anywhere'],
  ARRAY['Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'full-time',
  ARRAY['england','scotland','healthjobsuk']::text[],
  true,
  true
FROM clients WHERE full_name ILIKE 'Fisope'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Angela (Scotland focus) — Scotland and England, Band 3, Care, full-time permanent
-- Uses LIMIT 1 to avoid ambiguity if multiple Angelas exist; adjust name as needed
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['Scotland', 'England'],
  ARRAY['Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'full-time',
  ARRAY['england','scotland','healthjobsuk']::text[],
  true,
  true
FROM clients WHERE full_name ILIKE 'Angela' ORDER BY created_at ASC LIMIT 1
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Asmau — Scotland and England, Band 3, Care, full-time permanent
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['Scotland', 'England'],
  ARRAY['Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'full-time',
  ARRAY['england','scotland','healthjobsuk']::text[],
  true,
  true
FROM clients WHERE full_name ILIKE 'Asmau'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Nkem — Lancashire / Greater Manchester, Band 3, Care, full-time permanent, sponsorship
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['Lancashire', 'Manchester'],
  ARRAY['Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'full-time',
  ARRAY['england','healthjobsuk']::text[],
  true,
  true
FROM clients WHERE full_name ILIKE 'Nkem'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Prince — Lancashire / Greater Manchester, Band 3, Care, full-time permanent, sponsorship
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['Lancashire', 'Manchester'],
  ARRAY['Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'full-time',
  ARRAY['england','healthjobsuk']::text[],
  true,
  true
FROM clients WHERE full_name ILIKE 'Prince'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Mona — Lancashire / Manchester / Anywhere, Bands 3-5, full-time permanent, sponsorship
-- Wide range of NHS admin/information/project roles
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['Lancashire', 'Manchester', 'anywhere'],
  ARRAY['Band 3', 'Band 4', 'Band 5'],
  ARRAY[
    'clinical coder', 'cancer pathway', 'data quality', 'information analyst',
    'workforce', 'hr officer', 'research assistant', 'safeguarding admin',
    'complaints officer', 'pals officer', 'quality improvement',
    'digital systems', 'epr support', 'rtt validator', 'mdt coordinator',
    'waiting list coordinator', 'validation officer', 'service improvement',
    'epr trainer', 'performance analyst', 'transformation project',
    'access officer', 'administrator', 'admin', 'project coordinator',
    'project support', 'project manager'
  ],
  'full-time',
  ARRAY['england','healthjobsuk']::text[],
  true,
  true
FROM clients WHERE full_name ILIKE 'Mona'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Victor — Anywhere, Band 3, Care, full-time permanent, sponsorship
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['anywhere'],
  ARRAY['Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'full-time',
  ARRAY['england','scotland','healthjobsuk']::text[],
  true,
  true
FROM clients WHERE full_name ILIKE 'Victor'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Dora — Anywhere, Band 3, Care, full-time permanent, sponsorship
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['anywhere'],
  ARRAY['Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'full-time',
  ARRAY['england','scotland','healthjobsuk']::text[],
  true,
  true
FROM clients WHERE full_name ILIKE 'Dora'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Joke — Birmingham and within 1 hour, Band 3, Care, full-time permanent
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['Birmingham', 'Coventry', 'Wolverhampton', 'Leicester', 'Warwick'],
  ARRAY['Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'full-time',
  ARRAY['england','healthjobsuk']::text[],
  true,
  true
FROM clients WHERE full_name ILIKE 'Joke'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Sharon — Anywhere, Band 3, Care, full-time permanent, sponsorship
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['anywhere'],
  ARRAY['Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'full-time',
  ARRAY['england','scotland','healthjobsuk']::text[],
  true,
  true
FROM clients WHERE full_name ILIKE 'Sharon'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Derick — Anywhere, Band 3, Care, full-time permanent, sponsorship
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['anywhere'],
  ARRAY['Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'full-time',
  ARRAY['england','scotland','healthjobsuk']::text[],
  true,
  true
FROM clients WHERE full_name ILIKE 'Derick'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Bosei — Anywhere, Band 3, Care, full-time permanent, sponsorship
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['anywhere'],
  ARRAY['Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'full-time',
  ARRAY['england','scotland','healthjobsuk']::text[],
  true,
  true
FROM clients WHERE full_name ILIKE 'Bosei'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Jubilee — Anywhere, Band 3, Care, full-time permanent, sponsorship
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['anywhere'],
  ARRAY['Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'full-time',
  ARRAY['england','scotland','healthjobsuk']::text[],
  true,
  true
FROM clients WHERE full_name ILIKE 'Jubilee'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Oma — Anywhere, Band 3, Care, full-time permanent, sponsorship (new profile)
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['anywhere'],
  ARRAY['Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'full-time',
  ARRAY['england','scotland','healthjobsuk']::text[],
  true,
  true
FROM clients WHERE client_code = 'OMA00001'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- Lateef — Sheffield, Band 3, Care, full-time permanent, sponsorship
INSERT INTO applicant_preferences
  (client_id, locations, bands, role_keywords, employment_type, sources, permanent_only, is_active)
SELECT id,
  ARRAY['Sheffield'],
  ARRAY['Band 3'],
  ARRAY['support worker', 'care assistant', 'care worker', 'healthcare assistant'],
  'full-time',
  ARRAY['england','healthjobsuk']::text[],
  true,
  true
FROM clients WHERE full_name ILIKE 'Lateef'
ON CONFLICT (client_id) DO UPDATE SET
  locations     = EXCLUDED.locations,
  bands         = EXCLUDED.bands,
  role_keywords = EXCLUDED.role_keywords,
  employment_type = EXCLUDED.employment_type,
  sources       = EXCLUDED.sources,
  permanent_only = EXCLUDED.permanent_only,
  is_active     = true,
  updated_at    = now();

-- ============================================================
-- 5. Verify results
-- ============================================================
SELECT
  c.client_code,
  c.full_name,
  p.locations,
  p.bands,
  p.employment_type,
  p.permanent_only,
  p.sources,
  p.is_active
FROM applicant_preferences p
JOIN clients c ON c.id = p.client_id
ORDER BY c.full_name;
