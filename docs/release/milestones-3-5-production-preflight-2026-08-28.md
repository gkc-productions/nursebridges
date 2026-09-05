# Milestones 3–5 Production Preflight — updated 2026-09-04

Status: **production is healthy; database mutation remains blocked pending review**. The production project was restored with approval and inspected read-only. The inspection found repository migrations that are not present in production plus legacy object-grant drift that must be corrected in a verified order. No production SQL, migration, application deployment, or data mutation has been performed.

## Verified source checkpoint

- Local branch: `consolidation/mac-work-20260730T181122Z`
- Local inspected commit: `6c827cbf5a7a74a561b41d953d26f8b6cfcbb2b8`
- GitHub branch tip: `e2a6d67812a871b0f1611222a70ee533109f64a1`
- The local checkout contains known generated API, shared-package, and TypeScript build-info output. It remains unstaged and must not be included in a source checkpoint or deployment artifact.
- The original VM and Mac staging copies remain out of scope and must not be cleaned, reset, overwritten, or used as an unreviewed deployment source.

## Production observations

- Supabase production project: `nursebridge` (`bkhxrlvxtzeutdnatgwd`)
- Project status after the approved restore: `ACTIVE_HEALTHY`
- The `authenticator` role has no `pgrst.db_schemas` override. Dashboard exposed-schema settings are not being overridden by role configuration.
- All required Milestones 3–5 tables exist and have RLS enabled.
- The production migration ledger contains replayed repository changes under different timestamps/names. Migration history must not be edited or marked repaired by assumption.
- These newer repository changes are absent from the production ledger and their effects are absent from the inspected schema:
  - `20260821124432_replace_nurse_availability_atomically.sql`
  - `20260821124834_manage_admin_team_members_safely.sql`
  - `20260905020527_harden_applications_withdrawal_policy.sql`
- `replace_my_nurse_availability(jsonb)` and `manage_admin_team_member(uuid,uuid,text,boolean)` are absent.
- `applications_update_related` remains present with an always-true check; the withdrawal-only policy and status-column-only update grant are absent.
- `bump_operations_case(...)` is service-role-only as intended.

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

## Advisor baseline

- Security advisor: 42 findings (`5 INFO`, `37 WARN`)
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

These are a baseline, not a mandate for blanket changes. Client-readable tables can legitimately remain visible to authenticated GraphQL introspection. Unrelated agent objects and authentication settings require separate ownership/product decisions.

## Required rollout sequence

1. Review the three absent repository migrations and the compatibility-grants migration as an ordered production change set.
2. Replay that exact order against the isolated verification project and verify functions, policies, grants, RLS, and advisors. The complete target state has passed isolated verification and must be rechecked immediately before production execution.
3. Obtain explicit production-migration approval for the reviewed SQL.
4. Apply each approved change through versioned Supabase migrations; do not edit migration-history rows or seed production data.
5. Re-run the focused schema/grant queries and advisors. Stop if an expected prerequisite differs or a new security finding appears.
6. Push the reviewed source commits only after separate push approval.
7. Create a clean, recoverable deployment checkout or artifact from the reviewed commit. Do not deploy by cleaning or overwriting the dirty VM original.
8. Deploy API and admin from the same verified commit, restarting only their own services and checking privacy-safe health/log evidence.
9. Run non-mutating smoke preflight first. Run role-based mutating smoke only with explicit production-smoke approval.

## Rollback and stop conditions

- Database rollback is forward-only: prepare and review a corrective migration rather than deleting migration-history rows or resetting production.
- API/admin rollback uses the previous verified source/artifact and restarts only the affected service.
- Stop if migration history and schema disagree beyond the documented replayed versions, a prerequisite object differs, a new advisor error appears, a service fails health checks, logs expose private data, or an unrelated VM file would be overwritten.
- Payments, payouts, archives, TestFlight/App Store actions, production data cleanup, and environment/secret changes remain out of scope.

## Readiness checks

- Production project restore and read-only inspection: passed.
- Production role-override check: passed; no `pgrst.db_schemas` override.
- Required Milestones 3–5 tables and RLS: passed.
- Exact migration-order reconciliation and isolated target-state verification: passed.
- Least-privilege compatibility migration static guard and isolated replay: passed.
- Isolated effective grants: matched the source-derived allowlist exactly; no anonymous milestone-table privileges remain.
- Isolated atomic-availability smoke: passed inside a rolled-back transaction after direct table writes were removed.
- Isolated security advisor after grant hardening: 0 warnings/errors and 3 expected informational no-policy findings on server-only tables.
- Production database mutation: not performed; separate approval required.
- Clean production deployment source: not yet prepared.

Supabase reference: [Securing your API](https://supabase.com/docs/guides/api/securing-your-api) explains that object grants and RLS are separate, required layers and recommends explicit least-privilege grants.
