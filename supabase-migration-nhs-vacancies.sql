-- NHS live vacancies table — populated by Apify webhook
create table if not exists nhs_vacancies (
  id            uuid primary key default gen_random_uuid(),
  external_id   text not null unique,
  title         text not null,
  employer      text,
  location      text,
  band          text,
  contract_type text,
  closing_date  text,
  url           text,
  scraped_at    timestamptz not null default now()
);

-- drop rows older than 7 days automatically
create index if not exists nhs_vacancies_scraped_at_idx on nhs_vacancies (scraped_at desc);
