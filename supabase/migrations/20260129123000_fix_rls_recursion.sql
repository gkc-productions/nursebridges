-- Fix RLS recursion between jobs/applications policies (idempotent)

-- Helper: check if current user is assigned to job via applications, bypassing RLS
create or replace function public.nurse_assigned_to_job(p_job_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.applications a
    where a.job_id = p_job_id
      and a.nurse_user_id = auth.uid()
      and a.status = 'accepted'::public.application_status
  );
$$;

-- Replace policy to use helper and avoid recursion
DO $$
BEGIN
  execute 'drop policy if exists "jobs_select_assigned_for_nurse" on public.jobs';

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'jobs'
      and policyname = 'jobs_select_assigned_for_nurse'
  ) then
    create policy jobs_select_assigned_for_nurse
      on public.jobs
      for select
      using (public.nurse_assigned_to_job(id));
  end if;
END $$;
