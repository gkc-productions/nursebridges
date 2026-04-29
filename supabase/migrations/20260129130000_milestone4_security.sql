-- Milestone 4: Security, verification, audit logs (idempotent)

-- 1) Admin audit logs table
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- FK to profiles
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'admin_audit_logs_actor_id_fkey'
      and conrelid = 'public.admin_audit_logs'::regclass
  ) then
    alter table public.admin_audit_logs
      add constraint admin_audit_logs_actor_id_fkey
      foreign key (actor_id) references public.profiles(id)
      on delete cascade;
  end if;
end $$;

create index if not exists idx_admin_audit_logs_actor_id on public.admin_audit_logs(actor_id);
create index if not exists idx_admin_audit_logs_entity on public.admin_audit_logs(entity_type, entity_id);
create index if not exists idx_admin_audit_logs_created_at on public.admin_audit_logs(created_at);

-- 2) Nurse verification fields
alter table if exists public.nurse_profiles
  add column if not exists verification_status text default 'pending',
  add column if not exists verified_at timestamptz;

-- Normalize existing rows (safe)
update public.nurse_profiles
set verification_status = case
  when verification_status is not null then verification_status
  when is_active is true then 'approved'
  else 'pending'
end
where verification_status is null;

-- Optional check constraint (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nurse_profiles_verification_status_check'
      and conrelid = 'public.nurse_profiles'::regclass
  ) then
    alter table public.nurse_profiles
      add constraint nurse_profiles_verification_status_check
      check (verification_status in ('pending','approved','rejected'));
  end if;
end $$;

-- 3) Enable RLS on audit logs
alter table if exists public.admin_audit_logs enable row level security;

-- 4) Policies
-- Admin full access helper (uses is_admin() function created earlier)

-- profiles: admin full access insert/update/delete
DO $$
BEGIN
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles' and policyname='profiles_insert_admin'
  ) then
    create policy profiles_insert_admin
      on public.profiles
      for insert
      with check (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles' and policyname='profiles_delete_admin'
  ) then
    create policy profiles_delete_admin
      on public.profiles
      for delete
      using (public.is_admin());
  end if;
END $$;

-- nurse_profiles: admin update/delete/insert
DO $$
BEGIN
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='nurse_profiles' and policyname='nurse_profiles_insert_admin'
  ) then
    create policy nurse_profiles_insert_admin
      on public.nurse_profiles
      for insert
      with check (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='nurse_profiles' and policyname='nurse_profiles_delete_admin'
  ) then
    create policy nurse_profiles_delete_admin
      on public.nurse_profiles
      for delete
      using (public.is_admin());
  end if;
END $$;

-- jobs: admin insert/delete
DO $$
BEGIN
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='jobs' and policyname='jobs_insert_admin'
  ) then
    create policy jobs_insert_admin
      on public.jobs
      for insert
      with check (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='jobs' and policyname='jobs_delete_admin'
  ) then
    create policy jobs_delete_admin
      on public.jobs
      for delete
      using (public.is_admin());
  end if;
END $$;

-- applications: admin insert/update/delete
DO $$
BEGIN
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='applications' and policyname='applications_insert_admin'
  ) then
    create policy applications_insert_admin
      on public.applications
      for insert
      with check (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='applications' and policyname='applications_update_admin'
  ) then
    create policy applications_update_admin
      on public.applications
      for update
      using (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='applications' and policyname='applications_delete_admin'
  ) then
    create policy applications_delete_admin
      on public.applications
      for delete
      using (public.is_admin());
  end if;
END $$;

-- admin_audit_logs: admin full access
DO $$
BEGIN
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='admin_audit_logs' and policyname='admin_audit_logs_admin'
  ) then
    create policy admin_audit_logs_admin
      on public.admin_audit_logs
      for all
      using (public.is_admin())
      with check (public.is_admin());
  end if;
END $$;

-- 5) Block unverified nurses from applying
DO $$
BEGIN
  execute 'drop policy if exists "applications_insert_nurse" on public.applications';

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='applications' and policyname='applications_insert_nurse'
  ) then
    create policy applications_insert_nurse
      on public.applications
      for insert
      with check (
        nurse_user_id = auth.uid()
        and exists (
          select 1 from public.nurse_profiles np
          where np.nurse_id = auth.uid()
            and np.verification_status = 'approved'
        )
      );
  end if;
END $$;
