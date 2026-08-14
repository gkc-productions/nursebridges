-- Complete the Milestone 2 patient journey with private request messaging,
-- explicit care-circle invitation state, and hardened database helpers.

create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated, service_role;

-- These helpers are policy implementation details, not public RPC endpoints.
-- Moving them preserves policy dependencies while removing them from the
-- exposed public API schema.
alter function public.is_admin() set schema app_private;
alter function public.is_approved_nurse() set schema app_private;
alter function public.nurse_assigned_to_job(uuid) set schema app_private;
alter function public.patient_owns_job(uuid) set schema app_private;
alter function public.handle_new_user() set schema app_private;

alter function app_private.is_admin() set search_path = public;
alter function app_private.is_approved_nurse() set search_path = public;
alter function app_private.nurse_assigned_to_job(uuid) set search_path = public;
alter function app_private.patient_owns_job(uuid) set search_path = public;
alter function app_private.handle_new_user() set search_path = public;

revoke execute on function app_private.is_admin() from public, anon;
revoke execute on function app_private.is_approved_nurse() from public, anon;
revoke execute on function app_private.nurse_assigned_to_job(uuid) from public, anon;
revoke execute on function app_private.patient_owns_job(uuid) from public, anon;
revoke execute on function app_private.handle_new_user() from public, anon, authenticated;
grant execute on function app_private.is_admin() to authenticated, service_role;
grant execute on function app_private.is_approved_nurse() to authenticated, service_role;
grant execute on function app_private.nurse_assigned_to_job(uuid) to authenticated, service_role;
grant execute on function app_private.patient_owns_job(uuid) to authenticated, service_role;

alter function public.set_updated_at() set search_path = public;
alter function public.enforce_notification_read_only_update() set search_path = public;

create table public.job_messages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id),
  body text not null,
  client_message_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  constraint job_messages_body_length check (char_length(btrim(body)) between 1 and 2000),
  constraint job_messages_sender_idempotency unique (sender_user_id, client_message_id)
);

create index job_messages_job_created_idx on public.job_messages(job_id, created_at, id);
create index job_messages_sender_idx on public.job_messages(sender_user_id);

alter table public.job_messages enable row level security;
revoke all on public.job_messages from anon;
grant select, insert on public.job_messages to authenticated;

create policy job_messages_participant_select on public.job_messages
  for select to authenticated
  using (
    app_private.patient_owns_job(job_id)
    or app_private.nurse_assigned_to_job(job_id)
    or app_private.is_admin()
  );

create policy job_messages_participant_insert on public.job_messages
  for insert to authenticated
  with check (
    (select auth.uid()) = sender_user_id
    and (
      app_private.patient_owns_job(job_id)
      or app_private.nurse_assigned_to_job(job_id)
      or app_private.is_admin()
    )
  );

alter table public.care_circle_recipients
  add column invitation_status text not null default 'pending',
  add column invitation_expires_at timestamptz not null default (now() + interval '7 days'),
  add column accepted_at timestamptz,
  add column last_invited_at timestamptz,
  add column delivery_status text not null default 'not_sent';

alter table public.care_circle_recipients
  add constraint care_circle_invitation_status_check
    check (invitation_status in ('pending', 'accepted', 'expired', 'revoked')),
  add constraint care_circle_delivery_status_check
    check (delivery_status in ('not_sent', 'queued', 'sent', 'failed')),
  add constraint care_circle_acceptance_check
    check ((invitation_status = 'accepted') = (accepted_at is not null));

create index care_circle_invitation_status_idx
  on public.care_circle_recipients(patient_user_id, invitation_status, invitation_expires_at);

-- Revocation is represented consistently in both legacy and invitation fields.
create or replace function public.sync_care_circle_revocation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.revoked_at is not null then
    new.invitation_status := 'revoked';
    new.accepted_at := null;
  end if;
  return new;
end;
$$;

create trigger care_circle_sync_revocation
  before insert or update on public.care_circle_recipients
  for each row execute function public.sync_care_circle_revocation();

revoke execute on function public.sync_care_circle_revocation() from public, anon, authenticated;

comment on table public.job_messages is
  'Request-specific operational messages for the patient, assigned nurse, and administrators; not clinical charting.';
comment on column public.care_circle_recipients.invitation_status is
  'Consent invitation state. A recipient receives no protected visit content until accepted.';
