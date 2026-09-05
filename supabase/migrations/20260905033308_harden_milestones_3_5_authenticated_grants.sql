-- Older Supabase projects granted broad public-schema privileges by default.
-- RLS still limits rows, but table grants must independently limit operations.
-- Reset only the Milestones 3-5 tables, then restore the client operations used
-- by the API. The service role is intentionally left unchanged.

-- The atomic availability function validates auth.uid(), verifies the nurse
-- role, and uses an empty search_path. Run its table writes with the function
-- owner's privileges so direct authenticated table writes can be removed.
alter function public.replace_my_nurse_availability(jsonb) security definer;

revoke all on table
  public.nurse_availability_windows,
  public.operations_cases,
  public.admin_team_members,
  public.operations_case_notes,
  public.operations_case_presence,
  public.preferred_nurses,
  public.recurring_care_plans,
  public.visit_arrival_verifications,
  public.care_quotes,
  public.nurse_earning_records,
  public.marketplace_quality_signals
from anon, authenticated;

-- Nurse availability mutations are atomic through
-- replace_my_nurse_availability(jsonb); clients only read the resulting rows.
grant select
  on table public.nurse_availability_windows
  to authenticated;

-- Signed-in users can create support cases and read the cases they reported.
-- Case updates and presence coordination are owned by the server-side admin API.
grant select, insert
  on table public.operations_cases
  to authenticated;

grant select
  on table public.operations_case_notes
  to authenticated;

-- Patient continuity actions use upsert for preferences and insert-only plan
-- requests. Plan lifecycle changes remain server-controlled.
grant select, insert, update
  on table public.preferred_nurses
  to authenticated;

grant select, insert
  on table public.recurring_care_plans
  to authenticated;

-- These are intentionally readable through their existing owner policies.
grant select
  on table public.care_quotes, public.nurse_earning_records
  to authenticated;

-- No authenticated grants are restored for admin_team_members,
-- operations_case_presence, visit_arrival_verifications, or
-- marketplace_quality_signals. Those objects are accessed with the service
-- role only and remain protected by RLS.
