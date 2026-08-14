-- Milestones 3-5: nurse workspace, owned operations, continuity, and gated commerce.
-- This migration does not enable payment processing or store payment credentials.

create extension if not exists pgcrypto;

alter table public.nurse_profiles
  add column if not exists onboarding_step text not null default 'profile',
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists professional_summary text,
  add column if not exists years_experience integer,
  add column if not exists service_radius_miles integer,
  add column if not exists availability_status text not null default 'unavailable',
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'nurse_profiles_onboarding_step_check') then
    alter table public.nurse_profiles add constraint nurse_profiles_onboarding_step_check
      check (onboarding_step in ('profile','credentials','availability','review','complete'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'nurse_profiles_availability_status_check') then
    alter table public.nurse_profiles add constraint nurse_profiles_availability_status_check
      check (availability_status in ('available','limited','unavailable'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'nurse_profiles_experience_check') then
    alter table public.nurse_profiles add constraint nurse_profiles_experience_check
      check (years_experience is null or years_experience between 0 and 70);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'nurse_profiles_service_radius_check') then
    alter table public.nurse_profiles add constraint nurse_profiles_service_radius_check
      check (service_radius_miles is null or service_radius_miles between 1 and 250);
  end if;
end $$;

create table if not exists public.nurse_availability_windows (
  id uuid primary key default gen_random_uuid(),
  nurse_user_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'America/New_York',
  recurrence text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nurse_availability_time_check check (ends_at > starts_at),
  constraint nurse_availability_recurrence_check check (recurrence in ('none','weekly')),
  constraint nurse_availability_window_length_check check (ends_at <= starts_at + interval '31 days')
);
create index if not exists nurse_availability_nurse_time_idx
  on public.nurse_availability_windows(nurse_user_id, starts_at, ends_at);

create table if not exists public.operations_cases (
  id uuid primary key default gen_random_uuid(),
  case_type text not null,
  subject_type text not null,
  subject_id uuid,
  title text not null,
  description text,
  status text not null default 'open',
  priority text not null default 'normal',
  owner_user_id uuid references public.profiles(id) on delete set null,
  reported_by_user_id uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  handoff_note text,
  resolution_summary text,
  version integer not null default 1,
  last_activity_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operations_case_type_check check (case_type in ('intake','credential','matching','support','incident','service_recovery','finance')),
  constraint operations_case_status_check check (status in ('open','triaged','in_progress','waiting','resolved','closed')),
  constraint operations_case_priority_check check (priority in ('low','normal','high','urgent')),
  constraint operations_case_title_length check (char_length(title) between 1 and 180),
  constraint operations_case_description_length check (char_length(coalesce(description, '')) <= 4000),
  constraint operations_case_handoff_length check (char_length(coalesce(handoff_note, '')) <= 2000),
  constraint operations_case_resolution_length check (char_length(coalesce(resolution_summary, '')) <= 4000)
);
create index if not exists operations_cases_queue_idx on public.operations_cases(status, priority, due_at);
create index if not exists operations_cases_owner_idx on public.operations_cases(owner_user_id, status);
create index if not exists operations_cases_subject_idx on public.operations_cases(subject_type, subject_id);

create table if not exists public.admin_team_members (
  admin_user_id uuid primary key references public.profiles(id) on delete cascade,
  operations_role text not null default 'operator',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_team_role_check check (operations_role in ('operator','supervisor','credential_reviewer','support','finance'))
);

create table if not exists public.operations_case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.operations_cases(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete restrict,
  body text not null,
  visibility text not null default 'internal',
  created_at timestamptz not null default now(),
  constraint operations_case_note_body_check check (char_length(body) between 1 and 4000),
  constraint operations_case_note_visibility_check check (visibility in ('internal','reporter'))
);
create index if not exists operations_case_notes_case_idx on public.operations_case_notes(case_id, created_at);

create table if not exists public.operations_case_presence (
  case_id uuid not null references public.operations_cases(id) on delete cascade,
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null default 'viewing',
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (case_id, admin_user_id),
  constraint operations_case_presence_mode_check check (mode in ('viewing','editing'))
);

create table if not exists public.preferred_nurses (
  patient_user_id uuid not null references public.profiles(id) on delete cascade,
  nurse_user_id uuid not null references public.profiles(id) on delete cascade,
  source_job_id uuid references public.jobs(id) on delete set null,
  status text not null default 'preferred',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (patient_user_id, nurse_user_id),
  constraint preferred_nurses_distinct_people check (patient_user_id <> nurse_user_id),
  constraint preferred_nurses_status_check check (status in ('preferred','do_not_match','inactive'))
);

create table if not exists public.recurring_care_plans (
  id uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references public.profiles(id) on delete cascade,
  source_job_id uuid references public.jobs(id) on delete set null,
  preferred_nurse_user_id uuid references public.profiles(id) on delete set null,
  cadence text not null,
  starts_on date not null,
  ends_on date,
  local_time time not null,
  timezone text not null default 'America/New_York',
  status text not null default 'draft',
  occurrences_limit integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_care_cadence_check check (cadence in ('weekly','biweekly','monthly')),
  constraint recurring_care_status_check check (status in ('draft','pending_review','active','paused','completed','cancelled')),
  constraint recurring_care_dates_check check (ends_on is null or ends_on >= starts_on),
  constraint recurring_care_limit_check check (occurrences_limit is null or occurrences_limit between 1 and 52)
);
create index if not exists recurring_care_patient_idx on public.recurring_care_plans(patient_user_id, status);

create table if not exists public.visit_arrival_verifications (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  pin_digest text not null,
  expires_at timestamptz not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  verified_by_nurse_user_id uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_by_user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visit_arrival_failed_attempts_check check (failed_attempts between 0 and 20)
);

create table if not exists public.care_quotes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  version integer not null,
  currency text not null default 'USD',
  patient_total_cents integer not null,
  included_minutes integer not null,
  overtime_increment_minutes integer not null default 30,
  overtime_increment_cents integer not null default 0,
  status text not null default 'draft',
  patient_authorized_at timestamptz,
  created_by_user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, version),
  constraint care_quote_currency_check check (currency = 'USD'),
  constraint care_quote_amount_check check (patient_total_cents >= 0 and overtime_increment_cents >= 0),
  constraint care_quote_duration_check check (included_minutes between 30 and 1440 and overtime_increment_minutes between 15 and 120),
  constraint care_quote_status_check check (status in ('draft','offered','authorized','expired','void'))
);

create table if not exists public.nurse_earning_records (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  nurse_user_id uuid not null references public.profiles(id) on delete restrict,
  quote_id uuid references public.care_quotes(id) on delete set null,
  currency text not null default 'USD',
  guaranteed_cents integer not null,
  adjustment_cents integer not null default 0,
  status text not null default 'estimated',
  available_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, nurse_user_id),
  constraint nurse_earning_currency_check check (currency = 'USD'),
  constraint nurse_earning_amount_check check (guaranteed_cents >= 0),
  constraint nurse_earning_status_check check (status in ('estimated','approved','available','paid','void'))
);

create table if not exists public.marketplace_quality_signals (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete set null,
  nurse_user_id uuid references public.profiles(id) on delete set null,
  patient_user_id uuid references public.profiles(id) on delete set null,
  signal_type text not null,
  severity text not null default 'info',
  value_numeric numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint marketplace_signal_type_check check (signal_type in ('arrival_verified','on_time_arrival','late_arrival','no_show','report_timeliness','patient_rating','rebook_preference','incident','complaint','service_recovery')),
  constraint marketplace_signal_severity_check check (severity in ('info','attention','critical'))
);
create index if not exists marketplace_quality_nurse_idx on public.marketplace_quality_signals(nurse_user_id, created_at);

create or replace function public.bump_operations_case(
  p_case_id uuid,
  p_expected_version integer,
  p_owner_user_id uuid,
  p_status text,
  p_priority text,
  p_due_at timestamptz,
  p_handoff_note text,
  p_resolution_summary text
) returns public.operations_cases
language plpgsql security definer set search_path = public
as $$
declare updated_case public.operations_cases;
begin
  if not app_private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.operations_cases set
    owner_user_id = p_owner_user_id,
    status = p_status,
    priority = p_priority,
    due_at = p_due_at,
    handoff_note = nullif(trim(p_handoff_note), ''),
    resolution_summary = nullif(trim(p_resolution_summary), ''),
    resolved_at = case when p_status in ('resolved','closed') then coalesce(resolved_at, now()) else null end,
    version = version + 1,
    last_activity_at = now(),
    updated_at = now()
  where id = p_case_id and version = p_expected_version
  returning * into updated_case;
  if updated_case.id is null then raise exception 'case version conflict' using errcode = '40001'; end if;
  return updated_case;
end $$;

alter table public.nurse_availability_windows enable row level security;
alter table public.operations_cases enable row level security;
alter table public.admin_team_members enable row level security;
alter table public.operations_case_notes enable row level security;
alter table public.operations_case_presence enable row level security;
alter table public.preferred_nurses enable row level security;
alter table public.recurring_care_plans enable row level security;
alter table public.visit_arrival_verifications enable row level security;
alter table public.care_quotes enable row level security;
alter table public.nurse_earning_records enable row level security;
alter table public.marketplace_quality_signals enable row level security;

revoke all on public.visit_arrival_verifications, public.marketplace_quality_signals from anon, authenticated;
revoke all on public.operations_cases, public.operations_case_notes, public.operations_case_presence, public.care_quotes, public.nurse_earning_records from anon;
revoke execute on function public.bump_operations_case(uuid,integer,uuid,text,text,timestamptz,text,text) from public, anon;
grant execute on function public.bump_operations_case(uuid,integer,uuid,text,text,timestamptz,text,text) to authenticated;
grant select, insert, update, delete on public.nurse_availability_windows, public.preferred_nurses, public.recurring_care_plans to authenticated;
grant select, insert on public.operations_cases, public.operations_case_notes to authenticated;
grant select on public.admin_team_members to authenticated;
grant select, insert, update, delete on public.operations_case_presence to authenticated;
grant select on public.care_quotes, public.nurse_earning_records to authenticated;

create policy nurse_availability_owner on public.nurse_availability_windows for all to authenticated
  using ((select auth.uid()) = nurse_user_id or app_private.is_admin())
  with check ((select auth.uid()) = nurse_user_id or app_private.is_admin());
create policy operations_cases_admin_all on public.operations_cases for all to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());
create policy admin_team_members_admin_select on public.admin_team_members for select to authenticated
  using (app_private.is_admin());
create policy operations_cases_reporter_select on public.operations_cases for select to authenticated
  using ((select auth.uid()) = reported_by_user_id);
create policy operations_cases_reporter_insert on public.operations_cases for insert to authenticated
  with check ((select auth.uid()) = reported_by_user_id and case_type in ('support','incident'));
create policy operations_notes_admin_all on public.operations_case_notes for all to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());
create policy operations_notes_reporter_select on public.operations_case_notes for select to authenticated
  using (visibility = 'reporter' and exists (
    select 1 from public.operations_cases c where c.id = case_id and c.reported_by_user_id = (select auth.uid())
  ));
create policy operations_presence_admin_all on public.operations_case_presence for all to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin() and admin_user_id = (select auth.uid()));
create policy preferred_nurses_patient_all on public.preferred_nurses for all to authenticated
  using (patient_user_id = (select auth.uid()) or app_private.is_admin())
  with check (patient_user_id = (select auth.uid()) or app_private.is_admin());
create policy recurring_care_patient_all on public.recurring_care_plans for all to authenticated
  using (patient_user_id = (select auth.uid()) or app_private.is_admin())
  with check (patient_user_id = (select auth.uid()) or app_private.is_admin());
create policy care_quotes_patient_select on public.care_quotes for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and j.patient_user_id = (select auth.uid())) or app_private.is_admin());
create policy nurse_earnings_nurse_select on public.nurse_earning_records for select to authenticated
  using (nurse_user_id = (select auth.uid()) or app_private.is_admin());

drop trigger if exists nurse_availability_set_updated_at on public.nurse_availability_windows;
create trigger nurse_availability_set_updated_at before update on public.nurse_availability_windows
  for each row execute function public.set_updated_at();
drop trigger if exists preferred_nurses_set_updated_at on public.preferred_nurses;
create trigger preferred_nurses_set_updated_at before update on public.preferred_nurses
  for each row execute function public.set_updated_at();
drop trigger if exists recurring_care_set_updated_at on public.recurring_care_plans;
create trigger recurring_care_set_updated_at before update on public.recurring_care_plans
  for each row execute function public.set_updated_at();
drop trigger if exists care_quotes_set_updated_at on public.care_quotes;
create trigger care_quotes_set_updated_at before update on public.care_quotes
  for each row execute function public.set_updated_at();
drop trigger if exists nurse_earnings_set_updated_at on public.nurse_earning_records;
create trigger nurse_earnings_set_updated_at before update on public.nurse_earning_records
  for each row execute function public.set_updated_at();

comment on table public.visit_arrival_verifications is 'Hashed short-lived arrival PINs. Raw PINs must never be persisted.';
comment on table public.care_quotes is 'Versioned private-pay quote metadata only. No processor token or payment credential is stored.';
comment on table public.nurse_earning_records is 'Nurse payout ledger foundation. Money movement remains disabled until separately approved.';
