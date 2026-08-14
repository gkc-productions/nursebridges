-- NurseBridge REPAIR migration
-- Goal: align existing tables to expected columns without dropping data.

create extension if not exists pgcrypto;

-- Ensure enums exist
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

-- 1) JOBS: ensure patient_user_id exists, rename from old columns if needed
do $$
begin
  -- If patient_user_id missing, try rename user_id -> patient_user_id
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='jobs' and column_name='patient_user_id'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='jobs' and column_name='user_id'
    ) then
      execute 'alter table public.jobs rename column user_id to patient_user_id';
    elsif exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='jobs' and column_name='patient_id'
    ) then
      execute 'alter table public.jobs rename column patient_id to patient_user_id';
    else
      execute 'alter table public.jobs add column patient_user_id uuid';
    end if;
  end if;

  -- Make it NOT NULL if table is empty or column already populated
  -- (If you have data and NULLs, we leave it nullable for now to avoid breaking.)
end $$;

-- Ensure status column exists and is correct enum
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='jobs' and column_name='status'
  ) then
    execute 'alter table public.jobs add column status public.job_status not null default ''open''';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='jobs' and column_name='title'
  ) then
    execute 'alter table public.jobs add column title text';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='jobs' and column_name='description'
  ) then
    execute 'alter table public.jobs add column description text';
  end if;
end $$;

-- Ensure timestamps exist
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='jobs' and column_name='created_at') then
    execute 'alter table public.jobs add column created_at timestamptz not null default now()';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='jobs' and column_name='updated_at') then
    execute 'alter table public.jobs add column updated_at timestamptz not null default now()';
  end if;
end $$;

-- 2) APPLICATIONS: align nurse_user_id + job_id + status
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='applications' and column_name='nurse_user_id'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='applications' and column_name='nurse_id'
    ) then
      execute 'alter table public.applications rename column nurse_id to nurse_user_id';
    elsif exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='applications' and column_name='user_id'
    ) then
      -- common mistake: user_id intended nurse
      execute 'alter table public.applications rename column user_id to nurse_user_id';
    else
      execute 'alter table public.applications add column nurse_user_id uuid';
    end if;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='applications' and column_name='job_id'
  ) then
    execute 'alter table public.applications add column job_id uuid';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='applications' and column_name='status'
  ) then
    execute 'alter table public.applications add column status public.application_status not null default ''applied''';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='applications' and column_name='created_at'
  ) then
    execute 'alter table public.applications add column created_at timestamptz not null default now()';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='applications' and column_name='updated_at'
  ) then
    execute 'alter table public.applications add column updated_at timestamptz not null default now()';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='applications' and column_name='note'
  ) then
    execute 'alter table public.applications add column note text';
  end if;
end $$;

-- 3) Constraints / FKs (add only if missing)
do $$
begin
  -- jobs.patient_user_id -> auth.users
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema='public' and table_name='jobs' and constraint_type='FOREIGN KEY'
      and constraint_name='jobs_patient_user_id_fkey'
  ) then
    begin
      execute 'alter table public.jobs add constraint jobs_patient_user_id_fkey foreign key (patient_user_id) references auth.users(id) on delete cascade';
    exception when others then
      -- if existing data violates, skip for now
      null;
    end;
  end if;

  -- applications.job_id -> jobs.id
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema='public' and table_name='applications' and constraint_type='FOREIGN KEY'
      and constraint_name='applications_job_id_fkey'
  ) then
    begin
      execute 'alter table public.applications add constraint applications_job_id_fkey foreign key (job_id) references public.jobs(id) on delete cascade';
    exception when others then
      null;
    end;
  end if;

  -- applications.nurse_user_id -> auth.users
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema='public' and table_name='applications' and constraint_type='FOREIGN KEY'
      and constraint_name='applications_nurse_user_id_fkey'
  ) then
    begin
      execute 'alter table public.applications add constraint applications_nurse_user_id_fkey foreign key (nurse_user_id) references auth.users(id) on delete cascade';
    exception when others then
      null;
    end;
  end if;
end $$;

-- 4) Indexes (now safe)
create index if not exists idx_jobs_patient_user_id on public.jobs(patient_user_id);
create index if not exists idx_jobs_status on public.jobs(status);
create index if not exists idx_apps_job_id on public.applications(job_id);
create index if not exists idx_apps_nurse_user_id on public.applications(nurse_user_id);

-- 5) RLS enable (safe)
alter table public.jobs enable row level security;
alter table public.applications enable row level security;

-- Replace policies safely (drop + recreate)
do $$
begin
  execute 'drop policy if exists "jobs_select_open_or_owner" on public.jobs';
  execute 'drop policy if exists "jobs_insert_patient" on public.jobs';
  execute 'drop policy if exists "jobs_update_owner" on public.jobs';

  execute 'drop policy if exists "applications_select_related" on public.applications';
  execute 'drop policy if exists "applications_insert_nurse" on public.applications';
  execute 'drop policy if exists "applications_update_related" on public.applications';
end $$;

create policy "jobs_select_open_or_owner"
on public.jobs for select
using (status = 'open'::public.job_status OR patient_user_id = auth.uid());

create policy "jobs_insert_patient"
on public.jobs for insert
with check (patient_user_id = auth.uid());

create policy "jobs_update_owner"
on public.jobs for update
using (patient_user_id = auth.uid())
with check (patient_user_id = auth.uid());

create policy "applications_select_related"
on public.applications for select
using (
  nurse_user_id = auth.uid()
  OR exists (
    select 1 from public.jobs j
    where j.id = applications.job_id
      and j.patient_user_id = auth.uid()
  )
);

create policy "applications_insert_nurse"
on public.applications for insert
with check (nurse_user_id = auth.uid());

create policy "applications_update_related"
on public.applications for update
using (
  nurse_user_id = auth.uid()
  OR exists (
    select 1 from public.jobs j
    where j.id = applications.job_id
      and j.patient_user_id = auth.uid()
  )
)
with check (true);
