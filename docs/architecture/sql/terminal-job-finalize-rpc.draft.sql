-- NurseBridge terminal job finalization RPC draft.
-- Review-only. Do not apply until the owner explicitly approves a scoped Supabase schema change.
--
-- Goal:
--   Make cancel/complete persistence atomic for the closed-beta workflow.
--
-- This function intentionally keeps request authorization and user-facing error mapping
-- in the API/admin TypeScript layer. The database boundary owns only the final
-- trust-sensitive mutation unit:
--   - lock the job row;
--   - confirm the checked status is still current;
--   - for completion, confirm an accepted nurse exists;
--   - set the terminal job status;
--   - for cancellation, reject still-applied applications;
--   - insert durable in-app notification rows;
--   - insert admin audit evidence when actor_role is admin.

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
set search_path = public
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
    when p_next_status = 'cancelled' then 'Job cancelled'
    else 'Job completed'
  end;
  v_notification_body := coalesce(v_job.title, 'Job') || ' is now ' || p_next_status || '.';

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

  if p_actor_role = 'admin' then
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

revoke execute on function public.finalize_terminal_job_rpc(uuid, uuid, text, text, text) from public;
revoke execute on function public.finalize_terminal_job_rpc(uuid, uuid, text, text, text) from anon;
revoke execute on function public.finalize_terminal_job_rpc(uuid, uuid, text, text, text) from authenticated;
grant execute on function public.finalize_terminal_job_rpc(uuid, uuid, text, text, text) to service_role;
