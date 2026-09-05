-- Keep the authenticated RPC name in the exposed public schema, but move the
-- owner-privileged implementation into the non-exposed app_private schema.
-- The public wrapper remains SECURITY INVOKER and cannot bypass RLS itself.

alter function public.replace_my_nurse_availability(jsonb)
  set schema app_private;

alter function app_private.replace_my_nurse_availability(jsonb)
  security definer;

alter function app_private.replace_my_nurse_availability(jsonb)
  set search_path = '';

create function public.replace_my_nurse_availability(p_windows jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app_private.replace_my_nurse_availability(p_windows);
$$;

revoke all on function app_private.replace_my_nurse_availability(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function app_private.replace_my_nurse_availability(jsonb)
  to authenticated, service_role;

revoke all on function public.replace_my_nurse_availability(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.replace_my_nurse_availability(jsonb)
  to authenticated, service_role;
