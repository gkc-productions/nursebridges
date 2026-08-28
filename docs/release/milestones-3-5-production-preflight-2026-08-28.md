# Milestones 3–5 Production Preflight — 2026-08-28

Status: **blocked before production mutation**. The implementation and isolated database proof are complete, but production migration history cannot be reconciled while the production Supabase project is inactive, and the production VM checkout is not a clean copy of the verified consolidation commit.

## Verified source checkpoint

- Local branch: `consolidation/mac-work-20260730T181122Z`
- Local commit: `c6add90c709c98e4b201ea7952f243130c9b81f3`
- GitHub branch tip: `5daad535bf83db77ecea412f2df907a3dd21ef6f`
- The local branch is two commits ahead of GitHub:
  - `da7c2cb` — milestone 3–5 implementation foundation
  - `c6add90` — isolated database verification evidence
- Known generated `services/api/dist`, `packages/shared/dist`, and TypeScript build-info output remains unstaged and must not be included in a source checkpoint.

## Production observations

- Supabase production project: `nursebridge` (`bkhxrlvxtzeutdnatgwd`)
- Supabase status: `INACTIVE`
- Migration and table metadata calls are unavailable while the project is inactive.
- No production Supabase restore, query, migration, role, policy, data, or configuration change was performed.
- Production API health returned HTTP 200.
- Production admin root returned the expected HTTP 302 protected redirect.
- VM services `nursebridge-api` and `nursebridge-admin` are active.
- VM checkout remains on `checkpoint/vm-working-tree-20260730T181045Z` at `0db34d97953a1d6917ac66a8565541be69033479` with existing tracked and untracked work. It must not be cleaned, reset, overwritten, or used as an unreviewed deployment source.

## Current platform compatibility note

Supabase now requires explicit object grants in addition to RLS for Data API access. The milestone migrations explicitly configure table/function grants and were verified in the isolated project. Before production rollout, the production Data API exposed-schema configuration and effective grants must be inspected read-only after the project is restored.

## Required rollout sequence

1. Obtain explicit approval to restore/resume the production Supabase project.
2. Inspect production migration history, required tables/columns, role overrides, exposed schemas, RLS, grants, function signatures, and security advisors without mutation.
3. Produce the exact ordered list of missing repository migrations. Stop on schema/history ambiguity; do not repair migration history by assumption.
4. Push the two verified local commits to the existing GitHub consolidation branch after separate push approval.
5. Create a clean, recoverable deployment checkout or artifact from the reviewed commit. Do not deploy by cleaning or overwriting the dirty VM original.
6. Apply only the approved missing migrations through a versioned migration mechanism. Do not seed production data.
7. Verify schema objects, grants, RLS, function privileges, migration history, and Supabase security advisors.
8. Build and deploy the API from the verified commit, restart only `nursebridge-api`, then verify local/public health and privacy-safe logs.
9. Build and deploy the admin application from the same verified commit, restart only `nursebridge-admin`, then verify the protected route and privacy-safe logs.
10. Run non-mutating smoke preflight first. Run the role-based mutating smoke only with explicit production-smoke approval.
11. Record deployment commit, migration versions, commands, health results, smoke evidence, and any rollback action.

## Rollback and stop conditions

- Database rollback is forward-only: prepare and review a corrective migration rather than deleting migration-history rows or resetting production.
- API/admin rollback uses the previous verified source/artifact and restarts only the affected service.
- Stop if migration history and schema disagree, a prerequisite object differs, a new advisor error appears, a service fails health checks, logs expose private data, or any unrelated VM file would be overwritten.
- Payments, payouts, archives, TestFlight/App Store actions, production data cleanup, and environment/secret changes remain out of scope.

## Readiness checks

- Production-sequence readiness guard: passed.
- Beta-gate guard: passed.
- Admin/API boundary guard: passed.
- Access-and-secrets readiness guard: passed.
- Isolated milestone database replay and security verification: passed.
- Production migration-history reconciliation: blocked by inactive project.
- Clean production deployment source: not yet prepared.
