-- Nurses withdraw through the authenticated API client, while patient/admin
-- lifecycle decisions use the server-side service role. Replace the historical
-- broad update policy with the one direct client transition the product needs.

alter table public.applications enable row level security;

drop policy if exists applications_update_related on public.applications;
drop policy if exists applications_update_nurse_withdrawal on public.applications;

create policy applications_update_nurse_withdrawal
  on public.applications
  for update
  to authenticated
  using (
    nurse_user_id = (select auth.uid())
    and status = 'applied'::public.application_status
  )
  with check (
    nurse_user_id = (select auth.uid())
    and status = 'withdrawn'::public.application_status
  );

-- Prevent authenticated callers from changing job ownership, nurse ownership,
-- notes, or any future application columns during a withdrawal.
revoke update on table public.applications from authenticated;
grant update (status) on table public.applications to authenticated;
