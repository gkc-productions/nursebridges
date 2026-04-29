-- Milestone 2: RLS + roles + admin policies (idempotent)

-- A) Ensure profiles auto-created on auth.users insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    'patient',
    coalesce(new.raw_user_meta_data->>'full_name', null),
    coalesce(new.raw_user_meta_data->>'phone', null)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'on_auth_user_created'
  ) then
    create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
  end if;
end $$;

-- B) Enable RLS on core tables
alter table if exists public.profiles enable row level security;
alter table if exists public.nurse_profiles enable row level security;
alter table if exists public.jobs enable row level security;
alter table if exists public.applications enable row level security;

-- C) Policies
-- profiles: user can select/update own; admin can select/update all; user cannot change role
DO $$
BEGIN
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own'
  ) then
    create policy profiles_select_own
      on public.profiles
      for select
      using (id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own'
  ) then
    create policy profiles_update_own
      on public.profiles
      for update
      using (id = auth.uid())
      with check (
        id = auth.uid()
        and role = (select p.role from public.profiles p where p.id = auth.uid())
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_admin'
  ) then
    create policy profiles_select_admin
      on public.profiles
      for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_admin'
  ) then
    create policy profiles_update_admin
      on public.profiles
      for update
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
END $$;

-- nurse_profiles: nurse can select/update own; admin can select/update all
DO $$
BEGIN
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'nurse_profiles' and policyname = 'nurse_profiles_select_own'
  ) then
    create policy nurse_profiles_select_own
      on public.nurse_profiles
      for select
      using (nurse_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'nurse_profiles' and policyname = 'nurse_profiles_update_own'
  ) then
    create policy nurse_profiles_update_own
      on public.nurse_profiles
      for update
      using (nurse_id = auth.uid())
      with check (nurse_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'nurse_profiles' and policyname = 'nurse_profiles_select_admin'
  ) then
    create policy nurse_profiles_select_admin
      on public.nurse_profiles
      for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'nurse_profiles' and policyname = 'nurse_profiles_update_admin'
  ) then
    create policy nurse_profiles_update_admin
      on public.nurse_profiles
      for update
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
END $$;

-- jobs: patient can insert/select/update own; nurse can select open + assigned; admin can select/update all
DO $$
BEGIN
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'jobs' and policyname = 'jobs_insert_patient'
  ) then
    create policy jobs_insert_patient
      on public.jobs
      for insert
      with check (patient_user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'jobs' and policyname = 'jobs_select_patient'
  ) then
    create policy jobs_select_patient
      on public.jobs
      for select
      using (patient_user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'jobs' and policyname = 'jobs_update_patient'
  ) then
    create policy jobs_update_patient
      on public.jobs
      for update
      using (patient_user_id = auth.uid())
      with check (patient_user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'jobs' and policyname = 'jobs_select_open_for_nurse'
  ) then
    create policy jobs_select_open_for_nurse
      on public.jobs
      for select
      using (status = 'open'::public.job_status);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'jobs' and policyname = 'jobs_select_assigned_for_nurse'
  ) then
    create policy jobs_select_assigned_for_nurse
      on public.jobs
      for select
      using (
        exists (
          select 1 from public.applications a
          where a.job_id = jobs.id
            and a.nurse_user_id = auth.uid()
            and a.status = 'accepted'::public.application_status
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'jobs' and policyname = 'jobs_select_admin'
  ) then
    create policy jobs_select_admin
      on public.jobs
      for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'jobs' and policyname = 'jobs_update_admin'
  ) then
    create policy jobs_update_admin
      on public.jobs
      for update
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
END $$;

-- applications: nurse can insert/select own; patient can select for their jobs; admin can select all
DO $$
BEGIN
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'applications' and policyname = 'applications_insert_nurse'
  ) then
    create policy applications_insert_nurse
      on public.applications
      for insert
      with check (nurse_user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'applications' and policyname = 'applications_select_nurse'
  ) then
    create policy applications_select_nurse
      on public.applications
      for select
      using (nurse_user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'applications' and policyname = 'applications_select_patient_jobs'
  ) then
    create policy applications_select_patient_jobs
      on public.applications
      for select
      using (
        exists (
          select 1 from public.jobs j
          where j.id = applications.job_id
            and j.patient_user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'applications' and policyname = 'applications_select_admin'
  ) then
    create policy applications_select_admin
      on public.applications
      for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
END $$;
