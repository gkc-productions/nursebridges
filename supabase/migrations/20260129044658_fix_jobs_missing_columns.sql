-- Fix admin schema expectations (idempotent)
-- Adds missing columns to public.jobs without dropping any data.

-- jobs: address
alter table public.jobs
  add column if not exists address text;

-- jobs: start_time
alter table public.jobs
  add column if not exists start_time timestamptz;

-- (optional but commonly used by UIs)
alter table public.jobs
  add column if not exists end_time timestamptz;

alter table public.jobs
  add column if not exists updated_at timestamptz default now();

-- helpful indexes
create index if not exists idx_jobs_start_time on public.jobs(start_time);
