-- Admin compat columns so /api/admin/* stops 400'ing.
-- Adds missing columns the admin API currently selects.

-- 1) profiles: admin expects profiles.name (you currently have full_name)
alter table if exists public.profiles
  add column if not exists name text;

-- Backfill once (safe if empty)
update public.profiles
set name = coalesce(name, full_name)
where name is null;

-- 2) nurse_profiles: admin expects nurse_profiles.id and license_state
alter table if exists public.nurse_profiles
  add column if not exists id uuid,
  add column if not exists license_state text;

-- If you already have nurse_id (common), mirror it into id
update public.nurse_profiles
set id = coalesce(id, nurse_id)
where id is null;

-- 3) jobs: admin expects patient_id, address, start_time, hourly_rate
alter table if exists public.jobs
  add column if not exists patient_id uuid,
  add column if not exists address text,
  add column if not exists start_time timestamptz,
  add column if not exists hourly_rate numeric;

-- Mirror patient_user_id -> patient_id if present
update public.jobs
set patient_id = coalesce(patient_id, patient_user_id)
where patient_id is null;
