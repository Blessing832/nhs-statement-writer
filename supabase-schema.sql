-- Run this in your Supabase SQL editor to set up the database

-- Clients table
create table clients (
  id uuid primary key default gen_random_uuid(),
  client_code text unique not null,
  full_name text not null,
  work_history text not null default '',
  qualifications text not null default '',
  skills text not null default '',
  background text not null default '',
  subscription_start timestamptz not null default now(),
  subscription_end timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Statements table (usage tracking)
create table statements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  vacancy_url text not null,
  job_title text not null default '',
  organisation text not null default '',
  generated_statement text not null,
  key_duties jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- Indexes
create index clients_client_code_idx on clients(client_code);
create index statements_client_id_idx on statements(client_id);

-- Row Level Security (blocks public access, admin uses service role key which bypasses this)
alter table clients enable row level security;
alter table statements enable row level security;

-- No public access (all access goes through service role key in API routes)
create policy "No public access to clients" on clients for all using (false);
create policy "No public access to statements" on statements for all using (false);

-- ============================================================
-- VACANCY MONITOR TABLES
-- Run this section in Supabase SQL editor to enable vacancy monitoring
-- ============================================================

-- Applicant job search preferences (one per applicant/client)
create table if not exists applicant_preferences (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade unique,
  locations text[] not null default '{}',
  bands text[] not null default '{}',
  role_keywords text[] not null default '{}',
  employment_type text not null default 'any',
  sources text[] not null default '{"england","scotland","civil-service","healthjobsuk"}',
  is_active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Vacancies found by the scraper across all job boards
create table if not exists vacancies (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  source text not null,
  title text not null,
  organisation text not null default '',
  location text not null default '',
  band text not null default '',
  employment_type text not null default '',
  url text not null,
  posted_at timestamptz,
  closes_at timestamptz,
  is_open boolean not null default true,
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(external_id, source)
);

-- Which vacancies matched which applicants
create table if not exists vacancy_matches (
  id uuid primary key default gen_random_uuid(),
  vacancy_id uuid references vacancies(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  status text not null default 'pending',
  matched_at timestamptz not null default now(),
  done_at timestamptz,
  unique(vacancy_id, client_id)
);

-- Log of each scan run
create table if not exists scan_log (
  id uuid primary key default gen_random_uuid(),
  scanned_at timestamptz not null default now(),
  new_vacancies_found int not null default 0,
  new_matches_found int not null default 0,
  sources_scanned text[] not null default '{}'
);

-- Indexes for vacancy monitor
create index if not exists applicant_preferences_client_id_idx on applicant_preferences(client_id);
create index if not exists vacancies_source_idx on vacancies(source);
create index if not exists vacancies_is_open_idx on vacancies(is_open);
create index if not exists vacancies_posted_at_idx on vacancies(posted_at desc);
create index if not exists vacancy_matches_client_id_idx on vacancy_matches(client_id);
create index if not exists vacancy_matches_status_idx on vacancy_matches(status);

-- Row Level Security for vacancy tables
alter table applicant_preferences enable row level security;
alter table vacancies enable row level security;
alter table vacancy_matches enable row level security;
alter table scan_log enable row level security;

create policy "No public access to applicant_preferences" on applicant_preferences for all using (false);
create policy "No public access to vacancies" on vacancies for all using (false);
create policy "No public access to vacancy_matches" on vacancy_matches for all using (false);
create policy "No public access to scan_log" on scan_log for all using (false);
