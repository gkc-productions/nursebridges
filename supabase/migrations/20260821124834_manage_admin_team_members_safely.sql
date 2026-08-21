-- Supervisor-managed operations roles with transactional last-supervisor
-- protection. This function is callable only by the server-side service role.
create or replace function public.manage_admin_team_member(
  p_actor_id uuid,
  p_target_id uuid,
  p_operations_role text,
  p_active boolean
)
returns public.admin_team_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_is_supervisor boolean;
  active_supervisor_count integer;
  target_is_active_supervisor boolean;
  updated_member public.admin_team_members;
begin
  if p_operations_role not in ('operator', 'supervisor', 'credential_reviewer', 'support', 'finance') then
    raise exception 'invalid operations role' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles where id = p_actor_id and role = 'admin') then
    raise exception 'administrator account required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_target_id and role = 'admin') then
    raise exception 'target must be an administrator' using errcode = '22023';
  end if;

  lock table public.admin_team_members in share row exclusive mode;

  select count(*) into active_supervisor_count
  from public.admin_team_members
  where active and operations_role = 'supervisor';

  select exists (
    select 1 from public.admin_team_members
    where admin_user_id = p_actor_id and active and operations_role = 'supervisor'
  ) into actor_is_supervisor;

  -- A repository may be upgraded before its first team-role row exists. In
  -- that state, only the current administrator may bootstrap themselves as the
  -- first active supervisor.
  if active_supervisor_count = 0 then
    if p_actor_id <> p_target_id or p_operations_role <> 'supervisor' or not p_active then
      raise exception 'bootstrap the current administrator as supervisor first' using errcode = '42501';
    end if;
  elsif not actor_is_supervisor then
    raise exception 'active supervisor role required' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.admin_team_members
    where admin_user_id = p_target_id and active and operations_role = 'supervisor'
  ) into target_is_active_supervisor;

  if target_is_active_supervisor
     and (not p_active or p_operations_role <> 'supervisor')
     and active_supervisor_count <= 1 then
    raise exception 'the final active supervisor cannot be removed or demoted' using errcode = '23514';
  end if;

  insert into public.admin_team_members (admin_user_id, operations_role, active)
  values (p_target_id, p_operations_role, p_active)
  on conflict (admin_user_id) do update
    set operations_role = excluded.operations_role,
        active = excluded.active,
        updated_at = now()
  returning * into updated_member;

  return updated_member;
end;
$$;

revoke all on function public.manage_admin_team_member(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.manage_admin_team_member(uuid, uuid, text, boolean) to service_role;
