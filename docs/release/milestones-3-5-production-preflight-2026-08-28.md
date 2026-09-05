# Milestones 3–5 Production Preflight — updated 2026-09-04

Status: **the approved production migrations and forward security correction succeeded**. Production functions, policies, grants, migration history, advisor check, and rolled-back atomic smoke match the verified target state. No application deployment or data seeding has been performed.

## Verified source checkpoint

- Local branch: `consolidation/mac-work-20260730T181122Z`
- Local grant-hardening commit: `1fc3e423518ea11f84227ca8a96c087f8c15294e`
- GitHub branch tip: `e2a6d67812a871b0f1611222a70ee533109f64a1`
- The local checkout contains known generated API, shared-package, and TypeScript build-info output. It remains unstaged and must not be included in a source checkpoint or deployment artifact.
- The original VM and Mac staging copies remain out of scope and must not be cleaned, reset, overwritten, or used as an unreviewed deployment source.

## Production observations

- Supabase production project: `nursebridge` (`bkhxrlvxtzeutdnatgwd`)
- Project status after the approved restore: `ACTIVE_HEALTHY`
- The `authenticator` role has no `pgrst.db_schemas` override. Dashboard exposed-schema settings are not being overridden by role configuration.
- All required Milestones 3–5 tables exist and have RLS enabled.
- The production migration ledger contains replayed repository changes under different timestamps/names. Migration history must not be edited or marked repaired by assumption.
- The four approved migrations are recorded in production as versions `20260905035216`, `20260905035232`, `20260905035239`, and `20260905035249`.
- The private-helper correction is recorded as production version `20260905035617`.
- `replace_my_nurse_availability(jsonb)` and `manage_admin_team_member(uuid,uuid,text,boolean)` now exist with the verified execution-role boundaries.
- The broad `applications_update_related` policy is gone. The withdrawal-only policy and status-column-only update grant are active.
- `bump_operations_case(...)` is service-role-only as intended.
- The first production grant-hardening pass made the atomic availability RPC owner-privileged in `public`, which Supabase correctly reported as an authenticated privileged function in an exposed schema. The forward migration `20260905035335_move_availability_definer_to_private_schema.sql` keeps an invoker-rights public wrapper and moves only the privileged implementation into non-exposed `app_private`.

## Effective-grant findings

Production was created under older Supabase public-schema defaults. RLS restricts rows, but many `authenticated` table grants still include `DELETE`, `REFERENCES`, `TRIGGER`, and `TRUNCATE` even though NurseBridge clients do not use those operations.

The local compatibility migration `20260905033308_harden_milestones_3_5_authenticated_grants.sql` resets only the Milestones 3–5 tables and grants back the direct client operations verified from source:

- nurse availability: `SELECT`; replacement writes go through the nurse-authorized atomic RPC, hardened to owner-privileged execution with an empty search path before direct write grants are removed
- support cases: `SELECT, INSERT`
- reporter-visible case notes: `SELECT`
- preferred nurses: `SELECT, INSERT, UPDATE`
- recurring care plans: `SELECT, INSERT`
- care quotes and nurse earnings: `SELECT`
- admin team, admin presence, arrival verification, and quality signals: service role only

It deliberately does not touch the unrelated `agent_tasks`, `agent_runs`, or `set_agent_tasks_updated_at` objects found in production.

## Advisor results

- Pre-migration security baseline: 42 findings (`5 INFO`, `37 WARN`)
  - 5 RLS-enabled tables without policies
  - 1 mutable function search path on unrelated `set_agent_tasks_updated_at`
  - 10 anonymous GraphQL exposure findings
  - 25 authenticated GraphQL exposure findings
  - 1 leaked-password-protection setting warning
- Performance advisor: 190 findings (`66 INFO`, `124 WARN`)
  - 16 unindexed foreign keys
  - 38 RLS init-plan recommendations
  - 50 unused indexes
  - 82 multiple-permissive-policy findings
  - 4 duplicate-index findings

- Final production security advisor: 40 findings (`5 INFO`, `35 WARN`). Authenticated GraphQL exposure fell from 25 to 23, and the temporary privileged-public-function warning is gone.
- Isolated advisor after the private-helper correction: 3 expected informational no-policy findings and no warnings or errors.

These results are not a mandate for blanket changes. Client-readable tables can legitimately remain visible to authenticated GraphQL introspection. Unrelated agent objects and authentication settings require separate ownership/product decisions.

## Required rollout sequence

1. Push the reviewed source commits to the consolidation branch only.
2. Create a clean, recoverable deployment checkout or artifact from the reviewed commit. Do not deploy by cleaning or overwriting the dirty VM original.
3. Deploy API and admin from the same verified commit, restarting only their own services and checking privacy-safe health/log evidence.
4. Run non-mutating smoke preflight first. Run role-based mutating smoke only with explicit production-smoke approval.

## Rollback and stop conditions

- Database rollback is forward-only: prepare and review a corrective migration rather than deleting migration-history rows or resetting production.
- API/admin rollback uses the previous verified source/artifact and restarts only the affected service.
- Stop if migration history and schema disagree beyond the documented replayed versions, a prerequisite object differs, a new advisor error appears, a service fails health checks, logs expose private data, or an unrelated VM file would be overwritten.
- Payments, payouts, archives, TestFlight/App Store actions, production data cleanup, and environment/secret changes remain out of scope.

## Readiness checks

- Production project restore and read-only inspection: passed.
- Production role-override check: passed; no `pgrst.db_schemas` override.
- Required Milestones 3–5 tables and RLS: passed.
- Four-migration production execution and verification: passed.
- Least-privilege compatibility migration static guard and isolated replay: passed.
- Isolated effective grants: matched the source-derived allowlist exactly; no anonymous milestone-table privileges remain.
- Isolated atomic-availability smoke: passed inside a rolled-back transaction after direct table writes were removed.
- Isolated private-helper correction: passed with an invoker-rights public wrapper, a non-exposed privileged helper, and a successful rolled-back atomic smoke.
- Isolated security advisor after the forward correction: 0 warnings/errors and 3 expected informational no-policy findings on server-only tables.
- Production private-helper correction and function-privilege verification: passed.
- Production atomic-availability smoke: passed inside a rolled-back transaction; existing nurse availability was not persisted or changed.
- Production security advisor after correction: temporary privileged-public-function warning removed.
- Clean production deployment source: not yet prepared.

Supabase reference: [Securing your API](https://supabase.com/docs/guides/api/securing-your-api) explains that object grants and RLS are separate, required layers and recommends explicit least-privilege grants.
