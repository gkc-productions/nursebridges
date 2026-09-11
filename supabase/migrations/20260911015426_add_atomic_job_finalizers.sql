-- Move trust-sensitive job assignment and terminal status writes into
-- server-only Postgres transactions. Authorization stays in the API.

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
    'Care request assigned',
    'A care request has been assigned to you.',
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
    'A care request was assigned to another nurse or caregiver.',
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

create or replace function public.finalize_terminal_job_rpc(
  p_job_id uuid,
  p_actor_id uuid,
  p_actor_role text,
  p_expected_status text,
  p_next_status text
)
returns public.jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.jobs%rowtype;
  v_accepted_nurse_id uuid;
  v_terminal_nurse_ids uuid[] := array[]::uuid[];
  v_notification_title text;
  v_notification_body text;
  v_audit_action text;
begin
  if p_next_status not in ('cancelled', 'completed') then
    raise exception 'invalid_terminal_status' using errcode = 'P0001';
  end if;

  select *
    into v_job
    from public.jobs
   where id = p_job_id
   for update;

  if not found then
    raise exception 'job_not_found' using errcode = 'P0001';
  end if;

  if v_job.status <> p_expected_status then
    raise exception 'terminal_conflict' using errcode = '40001';
  end if;

  if p_next_status = 'cancelled' then
    if v_job.status not in ('open', 'assigned') then
      raise exception 'invalid_job_transition' using errcode = 'P0001';
    end if;

    select coalesce(array_agg(distinct nurse_user_id), array[]::uuid[])
      into v_terminal_nurse_ids
      from public.applications
     where job_id = p_job_id
       and nurse_user_id is not null
       and status in ('applied', 'accepted');

    update public.applications
       set status = 'rejected'
     where job_id = p_job_id
       and status = 'applied';
  end if;

  if p_next_status = 'completed' then
    if v_job.status <> 'assigned' then
      raise exception 'invalid_job_transition' using errcode = 'P0001';
    end if;

    select nurse_user_id
      into v_accepted_nurse_id
      from public.applications
     where job_id = p_job_id
       and status = 'accepted'
     order by created_at asc
     limit 1;

    if v_accepted_nurse_id is null then
      raise exception 'accepted_nurse_required' using errcode = 'P0001';
    end if;

    v_terminal_nurse_ids := array[v_accepted_nurse_id];
  end if;

  update public.jobs
     set status = p_next_status
   where id = p_job_id
   returning *
    into v_job;

  v_notification_title := case
    when p_next_status = 'cancelled' then 'Care request cancelled'
    else 'Care request completed'
  end;
  v_notification_body := 'A care request is now ' || p_next_status || '.';

  if v_job.patient_user_id is not null then
    insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
    values (
      v_job.patient_user_id,
      'job_' || p_next_status,
      v_notification_title,
      v_notification_body,
      'job',
      p_job_id
    );
  end if;

  insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
  select distinct
    nurse_id,
    'assigned_job_' || p_next_status,
    v_notification_title,
    v_notification_body,
    'job',
    p_job_id
  from unnest(v_terminal_nurse_ids) as nurse_id;

  if p_actor_role = 'admin' and p_actor_id is not null then
    v_audit_action := case
      when p_next_status = 'cancelled' then 'job_cancelled'
      else 'job_completed'
    end;

    insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      p_actor_id,
      v_audit_action,
      'job',
      p_job_id,
      jsonb_build_object('previous_status', p_expected_status)
    );
  end if;

  return v_job;
end;
$$;

revoke execute on function public.finalize_terminal_job_rpc(uuid, uuid, text, text, text)
  from public, anon, authenticated;

grant execute on function public.finalize_terminal_job_rpc(uuid, uuid, text, text, text)
  to service_role;
