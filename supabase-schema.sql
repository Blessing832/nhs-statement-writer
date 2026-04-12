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
