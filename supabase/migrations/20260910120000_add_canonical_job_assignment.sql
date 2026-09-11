-- Add the canonical nurse assignment field required by arrival verification,
-- continuity, marketplace, and reporting workflows. Accepted applications
-- remain supporting evidence and the compatibility RLS helper remains intact.

do $$
begin
  if exists (
    select 1
    from public.applications
    where status = 'accepted'::public.application_status
    group by job_id
    having count(*) > 1
  ) then
    raise exception 'Cannot backfill canonical assignments: a job has multiple accepted applications';
  end if;
end $$;

alter table public.jobs
  add column if not exists assigned_nurse_user_id uuid;

update public.jobs as jobs
set assigned_nurse_user_id = accepted.nurse_user_id
from (
  select job_id, min(nurse_user_id::text)::uuid as nurse_user_id
  from public.applications
  where status = 'accepted'::public.application_status
  group by job_id
  having count(*) = 1
) as accepted
where jobs.id = accepted.job_id
  and jobs.assigned_nurse_user_id is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_assigned_nurse_user_id_fkey'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_assigned_nurse_user_id_fkey
      foreign key (assigned_nurse_user_id)
      references public.profiles(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_jobs_assigned_nurse_user_id
  on public.jobs(assigned_nurse_user_id);
