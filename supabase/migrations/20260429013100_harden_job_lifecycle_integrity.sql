-- Harden NurseBridge job/application lifecycle integrity (idempotent).
-- API owns cross-table transition rules; this migration adds safe database
-- invariants and indexes that prevent duplicate nurse applications.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jobs'
      and column_name = 'status'
      and udt_schema = 'public'
      and udt_name = 'job_status'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_status_lifecycle_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_status_lifecycle_check
      check (status::text in ('open', 'assigned', 'completed', 'cancelled'));
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'applications'
      and column_name = 'status'
      and udt_schema = 'public'
      and udt_name = 'application_status'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'applications_status_check'
      and conrelid = 'public.applications'::regclass
  ) then
    alter table public.applications
      add constraint applications_status_check
      check (status::text in ('applied', 'accepted', 'rejected', 'withdrawn'));
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs' and column_name = 'patient_user_id'
  ) then
    execute 'create index if not exists idx_jobs_patient_user_id on public.jobs(patient_user_id)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs' and column_name = 'status'
  ) then
    execute 'create index if not exists idx_jobs_status on public.jobs(status)';
    execute 'create index if not exists idx_jobs_status_created_at on public.jobs(status, created_at desc)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs' and column_name = 'assigned_nurse_user_id'
  ) then
    execute 'create index if not exists idx_jobs_assigned_nurse_user_id on public.jobs(assigned_nurse_user_id)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'applications' and column_name = 'job_id'
  ) then
    execute 'create index if not exists idx_apps_job_id on public.applications(job_id)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'applications' and column_name = 'nurse_user_id'
  ) then
    execute 'create index if not exists idx_apps_nurse_user_id on public.applications(nurse_user_id)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'applications'
      and column_name in ('job_id', 'nurse_user_id')
    group by table_schema, table_name
    having count(*) = 2
  ) then
    execute 'create index if not exists idx_applications_job_nurse on public.applications(job_id, nurse_user_id)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'nurse_profiles' and column_name = 'nurse_id'
  ) then
    execute 'create index if not exists idx_nurse_profiles_nurse_id on public.nurse_profiles(nurse_id)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'nurse_profiles' and column_name = 'verification_status'
  ) then
    execute 'create index if not exists idx_nurse_profiles_verification_status on public.nurse_profiles(verification_status)';
  end if;
end $$;

with duplicate_applications as (
  select id
  from (
    select
      id,
      row_number() over (
        partition by job_id, nurse_user_id
        order by created_at asc, id asc
      ) as duplicate_rank
    from public.applications
    where job_id is not null
      and nurse_user_id is not null
  ) ranked
  where duplicate_rank > 1
)
delete from public.applications applications
using duplicate_applications
where applications.id = duplicate_applications.id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_job_id_nurse_user_id_key'
      and conrelid = 'public.applications'::regclass
  ) then
    alter table public.applications
      add constraint applications_job_id_nurse_user_id_key
      unique (job_id, nurse_user_id);
  end if;
end $$;
