-- Milestones 2-5 foundation: consented care-circle updates, visit execution,
-- nurse reports, patient feedback, and non-binding rebooking preferences.

create table public.care_circle_recipients (
  id uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  display_name text not null,
  relationship text not null,
  email text,
  phone text,
  receive_milestones boolean not null default false,
  receive_summary boolean not null default false,
  consented_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint care_circle_contact_required check (email is not null or phone is not null),
  constraint care_circle_consent_required check (receive_milestones or receive_summary),
  constraint care_circle_lengths check (
    char_length(display_name) between 1 and 120 and
    char_length(relationship) between 1 and 80 and
    char_length(coalesce(email, '')) <= 254 and
    char_length(coalesce(phone, '')) <= 30
  )
);

create table public.visit_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  nurse_user_id uuid not null references public.profiles(id),
  event_type text not null,
  occurred_at timestamptz not null default now(),
  patient_visible boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  constraint visit_events_type_check check (event_type in (
    'pre_visit_confirmed', 'en_route', 'arrived', 'patient_met',
    'facility_check_in', 'appointment_started', 'appointment_ended',
    'return_started', 'patient_handoff', 'visit_completed', 'escalation_requested'
  )),
  constraint visit_events_note_length check (char_length(coalesce(note, '')) <= 500)
);

create table public.visit_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  nurse_user_id uuid not null references public.profiles(id),
  status text not null default 'draft',
  visit_summary text,
  provider_instructions text,
  follow_up_tasks text,
  transportation_outcome text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visit_reports_status_check check (status in ('draft', 'submitted', 'amended')),
  constraint visit_reports_submission_check check (
    (status = 'draft' and submitted_at is null) or
    (status in ('submitted', 'amended') and submitted_at is not null)
  ),
  constraint visit_reports_lengths check (
    char_length(coalesce(visit_summary, '')) <= 4000 and
    char_length(coalesce(provider_instructions, '')) <= 4000 and
    char_length(coalesce(follow_up_tasks, '')) <= 2000 and
    char_length(coalesce(transportation_outcome, '')) <= 1000
  )
);

create table public.patient_visit_feedback (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  patient_user_id uuid not null references public.profiles(id),
  rating smallint not null check (rating between 1 and 5),
  comments text,
  would_rebook boolean,
  prefer_same_nurse boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_visit_feedback_comment_length check (char_length(coalesce(comments, '')) <= 2000)
);

create index care_circle_patient_idx on public.care_circle_recipients(patient_user_id);
create index care_circle_job_idx on public.care_circle_recipients(job_id);
create index visit_events_job_time_idx on public.visit_events(job_id, occurred_at);
create index visit_events_nurse_idx on public.visit_events(nurse_user_id);
create unique index visit_events_checkpoint_unique on public.visit_events(job_id, event_type)
  where event_type <> 'escalation_requested';
create index visit_reports_nurse_idx on public.visit_reports(nurse_user_id);
create index patient_visit_feedback_patient_idx on public.patient_visit_feedback(patient_user_id);

alter table public.care_circle_recipients enable row level security;
alter table public.visit_events enable row level security;
alter table public.visit_reports enable row level security;
alter table public.patient_visit_feedback enable row level security;

revoke all on public.care_circle_recipients, public.visit_events, public.visit_reports, public.patient_visit_feedback from anon;
grant select, insert, update on public.care_circle_recipients, public.visit_events, public.visit_reports, public.patient_visit_feedback to authenticated;

create policy care_circle_patient_all on public.care_circle_recipients
  for all to authenticated
  using ((select auth.uid()) = patient_user_id)
  with check ((select auth.uid()) = patient_user_id and (job_id is null or public.patient_owns_job(job_id)));
create policy care_circle_admin_select on public.care_circle_recipients
  for select to authenticated using (public.is_admin());

create policy visit_events_patient_select on public.visit_events
  for select to authenticated using (patient_visible and public.patient_owns_job(job_id));
create policy visit_events_assigned_nurse_select on public.visit_events
  for select to authenticated using (public.nurse_assigned_to_job(job_id));
create policy visit_events_assigned_nurse_insert on public.visit_events
  for insert to authenticated with check (
    (select auth.uid()) = nurse_user_id and public.nurse_assigned_to_job(job_id)
  );
create policy visit_events_admin_select on public.visit_events
  for select to authenticated using (public.is_admin());

create policy visit_reports_patient_select on public.visit_reports
  for select to authenticated using (status in ('submitted', 'amended') and public.patient_owns_job(job_id));
create policy visit_reports_assigned_nurse_select on public.visit_reports
  for select to authenticated using ((select auth.uid()) = nurse_user_id and public.nurse_assigned_to_job(job_id));
create policy visit_reports_assigned_nurse_insert on public.visit_reports
  for insert to authenticated with check (
    (select auth.uid()) = nurse_user_id and public.nurse_assigned_to_job(job_id)
  );
create policy visit_reports_assigned_nurse_update on public.visit_reports
  for update to authenticated
  using ((select auth.uid()) = nurse_user_id and public.nurse_assigned_to_job(job_id))
  with check ((select auth.uid()) = nurse_user_id and public.nurse_assigned_to_job(job_id));
create policy visit_reports_admin_select on public.visit_reports
  for select to authenticated using (public.is_admin());

create policy patient_feedback_owner_select on public.patient_visit_feedback
  for select to authenticated using ((select auth.uid()) = patient_user_id);
create policy patient_feedback_owner_insert on public.patient_visit_feedback
  for insert to authenticated with check (
    (select auth.uid()) = patient_user_id and public.patient_owns_job(job_id)
  );
create policy patient_feedback_owner_update on public.patient_visit_feedback
  for update to authenticated
  using ((select auth.uid()) = patient_user_id)
  with check ((select auth.uid()) = patient_user_id and public.patient_owns_job(job_id));
create policy patient_feedback_admin_select on public.patient_visit_feedback
  for select to authenticated using (public.is_admin());

create trigger care_circle_set_updated_at before update on public.care_circle_recipients
  for each row execute function public.set_updated_at();
create trigger visit_reports_set_updated_at before update on public.visit_reports
  for each row execute function public.set_updated_at();
create trigger patient_feedback_set_updated_at before update on public.patient_visit_feedback
  for each row execute function public.set_updated_at();

comment on table public.visit_events is 'Privacy-minimized operational checkpoints, not clinical charting.';
comment on table public.visit_reports is 'Nurse-authored coordination summary; provider instructions must be source-attributed.';
comment on table public.patient_visit_feedback is 'Patient feedback is visible to the patient and administrators, not the assigned nurse.';
