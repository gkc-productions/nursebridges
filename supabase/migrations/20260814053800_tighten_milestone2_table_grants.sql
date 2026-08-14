-- Keep Milestone 2 client access limited to the operations implemented by
-- row-level security policies. Supabase public-schema defaults may otherwise
-- grant authenticated users broader table privileges than intended.

revoke all on table
  public.care_circle_recipients,
  public.visit_events,
  public.visit_reports,
  public.patient_visit_feedback,
  public.job_messages
from anon, authenticated;

grant select, insert, update
  on table public.care_circle_recipients
  to authenticated;

grant select, insert
  on table public.visit_events
  to authenticated;

grant select, insert, update
  on table public.visit_reports, public.patient_visit_feedback
  to authenticated;

grant select, insert
  on table public.job_messages
  to authenticated;
