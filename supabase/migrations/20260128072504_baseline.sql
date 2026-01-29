-- NurseBridge Baseline (SAFE + idempotent)
-- This file MUST NEVER fail even if tables/columns already exist with different shapes.
-- We only create objects if missing, and we only create indexes when the target column exists.

-- 0) Extensions
create extension if not exists pgcrypto;

-- 1) Enums (safe)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('patient','nurse','admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type public.job_status as enum ('open','assigned','completed','cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'application_status') then
    create type public.application_status as enum ('applied','accepted','rejected','withdrawn');
  end if;
end $$;

-- 2) Tables (create-only; do NOT assume final column names here)
-- Profiles (optional; safe)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'patient',
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Jobs (create-only; keep minimal so it won't conflict with existing schema)
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Applications (create-only)
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- 3) Helper indexes (ONLY if the column exists)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='jobs' and column_name='patient_user_id'
  ) then
    execute 'create index if not exists idx_jobs_patient_user_id on public.jobs(patient_user_id)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='jobs' and column_name='status'
  ) then
    execute 'create index if not exists idx_jobs_status on public.jobs(status)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='applications' and column_name='job_id'
  ) then
    execute 'create index if not exists idx_apps_job_id on public.applications(job_id)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='applications' and column_name='nurse_user_id'
  ) then
    execute 'create index if not exists idx_apps_nurse_user_id on public.applications(nurse_user_id)';
  end if;
end $$;

-- 4) RLS enable (safe)
alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;

-- No policies here (repair migration will standardize policies after columns are aligned).
