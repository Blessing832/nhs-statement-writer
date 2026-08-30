-- Migration: generate_errors table
-- Run this in Supabase SQL editor to enable generate failure logging.

create table if not exists generate_errors (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  client_id     uuid references clients(id) on delete set null,
  client_code   text,
  vacancy_url   text,
  error_type    text,   -- e.g. 'overloaded', 'auth', 'billing', 'unknown'
  error_message text,
  http_status   int
);

-- Admin can see counts without exposing statement content
create index if not exists generate_errors_created_at_idx on generate_errors(created_at desc);
create index if not exists generate_errors_client_id_idx  on generate_errors(client_id);
