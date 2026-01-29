-- Phase C: Add missing columns expected by admin API (idempotent)
-- Goal: make API queries succeed without rewriting routes.

create extension if not exists pgcrypto;

-- 1) JOBS: add hourly_rate (and a couple common fields we already saw missing earlier)
alter table if exists public.jobs
  add column if not exists hourly_rate numeric;

alter table if exists public.jobs
  add column if not exists address text;

alter table if exists public.jobs
  add column if not exists start_time timestamptz;

-- Optional: basic index for filtering/sorting
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='jobs' and column_name='start_time') then
    execute 'create index if not exists idx_jobs_start_time on public.jobs(start_time)';
  end if;
end $$;

-- 2) PROFILES: code expects profiles.name, but schema has full_name
alter table if exists public.profiles
  add column if not exists name text;

-- Backfill name from full_name if name is null/empty
update public.profiles
set name = coalesce(nullif(name,''), full_name)
where name is null or name = '';

-- 3) NURSE_PROFILES: code expects nurse_profiles.id
alter table if exists public.nurse_profiles
  add column if not exists id uuid;

-- Fill id for existing rows
update public.nurse_profiles
set id = coalesce(id, gen_random_uuid())
where id is null;

-- Make id non-null going forward (only if column exists and table exists)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='nurse_profiles' and column_name='id'
  ) then
    begin
      alter table public.nurse_profiles alter column id set default gen_random_uuid();
    exception when others then
      -- ignore if cannot set default
      null;
    end;

    begin
      alter table public.nurse_profiles alter column id set not null;
    exception when others then
      -- ignore if existing data blocks it (shouldn't after update)
      null;
    end;

    -- unique constraint so code can safely treat it like an identifier
    begin
      alter table public.nurse_profiles add constraint nurse_profiles_id_key unique (id);
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;

