-- Cast terminal finalizer text parameters at enum boundaries.
-- The API sends status names as text; production stores jobs.status as job_status.

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
   where public.jobs.id = p_job_id
   for update;

  if not found then
    raise exception 'job_not_found' using errcode = 'P0001';
  end if;

  if v_job.status::text <> p_expected_status then
    raise exception 'terminal_conflict' using errcode = '40001';
  end if;

  if p_next_status = 'cancelled' then
    if v_job.status::text not in ('open', 'assigned') then
      raise exception 'invalid_job_transition' using errcode = 'P0001';
    end if;

    select coalesce(array_agg(distinct public.applications.nurse_user_id), array[]::uuid[])
      into v_terminal_nurse_ids
      from public.applications
     where public.applications.job_id = p_job_id
       and public.applications.nurse_user_id is not null
       and public.applications.status in ('applied', 'accepted');

    update public.applications
       set status = 'rejected'
     where public.applications.job_id = p_job_id
       and public.applications.status = 'applied';
  end if;

  if p_next_status = 'completed' then
    if v_job.status::text <> 'assigned' then
      raise exception 'invalid_job_transition' using errcode = 'P0001';
    end if;

    select public.applications.nurse_user_id
      into v_accepted_nurse_id
      from public.applications
     where public.applications.job_id = p_job_id
       and public.applications.status = 'accepted'
     order by public.applications.created_at asc
     limit 1;

    if v_accepted_nurse_id is null then
      raise exception 'accepted_nurse_required' using errcode = 'P0001';
    end if;

    v_terminal_nurse_ids := array[v_accepted_nurse_id];
  end if;

  update public.jobs
     set status = p_next_status::job_status
   where public.jobs.id = p_job_id
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
