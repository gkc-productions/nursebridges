-- Fix RLS recursion for applications -> jobs (idempotent)

-- Helper: check if current user owns job, bypassing RLS
create or replace function public.patient_owns_job(p_job_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.jobs j
    where j.id = p_job_id
      and j.patient_user_id = auth.uid()
  );
$$;

-- Replace policy to use helper and avoid recursion
DO $$
BEGIN
  execute 'drop policy if exists "applications_select_patient_jobs" on public.applications';

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'applications'
      and policyname = 'applications_select_patient_jobs'
  ) then
    create policy applications_select_patient_jobs
      on public.applications
      for select
      using (public.patient_owns_job(job_id));
  end if;
END $$;
