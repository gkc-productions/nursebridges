-- Ensure nurse must be verified to apply to jobs

alter table public.nurse_profiles
  add column if not exists verification_status text not null default 'pending';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'::public.user_role
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

DROP POLICY IF EXISTS "applications_insert_nurse_or_admin" ON public.applications;

CREATE POLICY "applications_insert_nurse_or_admin" ON public.applications
FOR INSERT
WITH CHECK (
  public.is_admin()
  OR (
    nurse_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'nurse'::public.user_role
    )
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = applications.job_id AND j.status = 'open'::public.job_status
    )
    AND EXISTS (
      SELECT 1
      FROM public.nurse_profiles np
      WHERE np.nurse_id = auth.uid() AND np.verification_status = 'approved'
    )
  )
);
