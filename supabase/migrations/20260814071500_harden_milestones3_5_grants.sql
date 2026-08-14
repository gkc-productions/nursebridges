-- Tighten default public-schema privileges for the Milestones 3-5 foundation.
-- Client access remains authenticated and protected by row-level security.

revoke all on table
  public.admin_team_members,
  public.nurse_availability_windows,
  public.preferred_nurses,
  public.recurring_care_plans
from anon;

-- Operations updates currently flow through the server-side admin API. Keep
-- the collision-safe helper available to the service role without exposing a
-- SECURITY DEFINER RPC directly to authenticated clients.
revoke execute on function public.bump_operations_case(uuid,integer,uuid,text,text,timestamptz,text,text)
  from public, anon, authenticated;
grant execute on function public.bump_operations_case(uuid,integer,uuid,text,text,timestamptz,text,text)
  to service_role;
