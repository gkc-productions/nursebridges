-- Harden open-job visibility so only approved nurses can browse open jobs.
-- This keeps Mobile/direct Supabase access aligned with API role checks.

create or replace function public.is_approved_nurse()
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.profiles p
    join public.nurse_profiles np on np.nurse_id = p.id
    where p.id = auth.uid()
      and p.role = 'nurse'::public.user_role
      and np.verification_status = 'approved'
  );
$$;

do $$
begin
  execute 'drop policy if exists "jobs_select_open_or_owner" on public.jobs';
  execute 'drop policy if exists "jobs_select_open_for_nurse" on public.jobs';

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'jobs'
      and policyname = 'jobs_select_open_for_nurse'
  ) then
    create policy jobs_select_open_for_nurse
      on public.jobs
      for select
      using (
        status = 'open'::public.job_status
        and public.is_approved_nurse()
      );
  end if;
end $$;
