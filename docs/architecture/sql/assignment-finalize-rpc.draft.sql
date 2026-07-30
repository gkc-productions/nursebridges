-- NurseBridge assignment finalization RPC draft.
--
-- Review-only artifact. Do not apply this file to Supabase as-is.
-- This file intentionally lives outside a migrations directory until the owner
-- approves a scoped Supabase schema/RPC change and the live column contract is
-- verified.
--
-- Target behavior:
--   1. Lock the open job.
--   2. Confirm the selected application is still applied.
--   3. Confirm the selected nurse/caregiver is approved.
--   4. Assign the job, accept the selected application, reject competitors,
--      write in-app notification rows, and optionally write admin audit evidence
--      in one database transaction.
--
-- Security posture:
--   - Server-side service_role execution through the API/admin workflow
--     boundary only.
--   - Do not grant this function to anon or authenticated.
--   - Keep mobile clients on API-only workflow writes.
--   - If this remains SECURITY DEFINER, keep an explicit search_path.

create or replace function public.finalize_applied_assignment_rpc(
  p_job_id uuid,
  p_selected_application_id uuid,
  p_selected_nurse_user_id uuid,
  p_actor_id uuid default null,
  p_actor_role text default null
)
returns table (
  job_id uuid,
  job_status text,
  selected_application_id uuid,
  selected_nurse_user_id uuid,
  rejected_nurse_user_ids uuid[]
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job record;
  v_application record;
  v_rejected_nurse_user_ids uuid[] := array[]::uuid[];
begin
  select id, status, title
    into v_job
    from public.jobs
   where id = p_job_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'job_not_found';
  end if;

  if v_job.status <> 'open' then
    raise exception using errcode = 'P0001', message = 'invalid_job_transition';
  end if;

  select id, job_id, nurse_user_id, status
    into v_application
    from public.applications
   where id = p_selected_application_id
     and job_id = p_job_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'application_not_found';
  end if;

  if v_application.status <> 'applied'
     or v_application.nurse_user_id <> p_selected_nurse_user_id then
    raise exception using errcode = 'P0001', message = 'application_not_selectable';
  end if;

  if not exists (
    select 1
      from public.nurse_profiles
     where nurse_id = p_selected_nurse_user_id
       and verification_status = 'approved'
  ) then
    raise exception using errcode = '42501', message = 'nurse_verification_required';
  end if;

  select coalesce(array_agg(nurse_user_id), array[]::uuid[])
    into v_rejected_nurse_user_ids
    from public.applications
   where job_id = p_job_id
     and status = 'applied'
     and nurse_user_id <> p_selected_nurse_user_id;

  update public.jobs
     set status = 'assigned',
         assigned_nurse_user_id = p_selected_nurse_user_id
   where id = p_job_id
     and status = 'open';

  if not found then
    raise exception using errcode = '40001', message = 'assignment_conflict';
  end if;

  update public.applications
     set status = 'accepted'
   where id = p_selected_application_id
     and status = 'applied';

  if not found then
    raise exception using errcode = '40001', message = 'assignment_conflict';
  end if;

  update public.applications
     set status = 'rejected'
   where job_id = p_job_id
     and status = 'applied'
     and nurse_user_id <> p_selected_nurse_user_id;

  insert into public.notifications (
    user_id,
    type,
    title,
    body,
    entity_type,
    entity_id
  )
  values (
    p_selected_nurse_user_id,
    'job_assigned',
    'Job assigned',
    coalesce(v_job.title, 'Job') || ' has been assigned to you.',
    'job',
    p_job_id
  );

  insert into public.notifications (
    user_id,
    type,
    title,
    body,
    entity_type,
    entity_id
  )
  select
    rejected_nurse_user_id,
    'application_rejected',
    'Application not selected',
    coalesce(v_job.title, 'Job') || ' was assigned to another nurse.',
    'job',
    p_job_id
  from unnest(v_rejected_nurse_user_ids) as rejected_nurse_user_id;

  if p_actor_role = 'admin' and p_actor_id is not null then
    insert into public.admin_audit_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      metadata
    )
    values (
      p_actor_id,
      'job_assigned',
      'job',
      p_job_id,
      jsonb_build_object('nurse_user_id', p_selected_nurse_user_id)
    );
  end if;

  return query
  select
    p_job_id,
    'assigned'::text,
    p_selected_application_id,
    p_selected_nurse_user_id,
    v_rejected_nurse_user_ids;
end;
$$;

revoke execute on function public.finalize_applied_assignment_rpc(uuid, uuid, uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.finalize_applied_assignment_rpc(uuid, uuid, uuid, uuid, text)
  to service_role;
