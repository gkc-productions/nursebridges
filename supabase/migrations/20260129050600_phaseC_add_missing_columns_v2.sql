-- Phase C v2: Add missing columns expected by admin API (idempotent)

create extension if not exists pgcrypto;

-- 1) JOBS: code expects jobs.patient_id but schema uses patient_user_id
alter table if exists public.jobs
  add column if not exists patient_id uuid;

-- Backfill patient_id from patient_user_id when present
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='jobs' and column_name='patient_user_id'
  ) then
    execute $q$
      update public.jobs
      set patient_id = coalesce(patient_id, patient_user_id)
      where patient_id is null
    $q$;
  end if;
end $$;

create index if not exists idx_jobs_patient_id on public.jobs(patient_id);

-- 2) NURSE_PROFILES: add license_state
alter table if exists public.nurse_profiles
  add column if not exists license_state text;

create index if not exists idx_nurse_profiles_license_state on public.nurse_profiles(license_state);

