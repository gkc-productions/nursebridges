# Workflow Source Of Truth Plan

This plan defines how NurseBridge should remove lifecycle drift between the Fastify API, Next.js admin routes, Supabase policies, and mobile clients.

The current closed-beta posture is acceptable only because high-risk API and admin workflow paths have direct regression coverage. Before broader beta, NurseBridge needs one canonical workflow boundary.

## Current State

Known facts:

- Fastify API owns patient and nurse workflow endpoints.
- Mobile clients should not write directly to core workflow tables.
- Next.js admin routes currently perform dispatcher actions server-side.
- `packages/shared/src/workflow.ts` now owns the first canonical pure job/application predicate slice for admin and mobile.
- `@nursebridge/shared` now emits production-safe JavaScript output under `dist/`, and shared tests import the compiled workflow module.
- Fastify API pure workflow predicates are now VM-reconciled through `services/api/src/jobWorkflow.ts`, which re-exports `@nursebridge/shared/workflow`.
- Admin dispatcher paths now have guardrails, notifications, audit writes, and regression coverage.
- Admin assignment is guarded, but not yet database-transactional.
- Production schema may contain historical compatibility columns.
- `patient_user_id` is the current canonical patient ownership field.
- `jobs.assigned_nurse_user_id` is the intended canonical assignment field for production writes.
- Exactly one accepted application for the assigned nurse/caregiver is supporting evidence and compatibility state, not the production source of truth.

Current risk:

- Two server surfaces can still drift in lifecycle command orchestration even though API/admin/mobile now share pure predicate rules.
- Assignment can become inconsistent if multi-step writes partially succeed.
- Database/RLS behavior can silently disagree with the intended API contract.

## Target Principle

There should be one trusted workflow boundary.

Every state-changing action should pass through a canonical path that enforces:

- Actor role.
- Resource ownership or admin authority.
- Current job status.
- Current application status.
- Nurse verification status.
- Notification creation.
- Audit logging for trust-sensitive actions.
- Stale-write protection.
- Transactional assignment where multiple records must change together.

## Canonical Workflow Actions

These actions need one authoritative implementation:

| Action | Actors | Required state checks | Required side effects |
| --- | --- | --- | --- |
| Create job | patient | patient role, valid payload | `jobs.status = open`, patient ownership |
| Apply to job | approved nurse | job open, nurse approved, no duplicate application | application row |
| Withdraw application | applicant nurse | application applied | application becomes withdrawn |
| Accept application | owning patient or admin | job open, application applied, nurse approved | job assigned, selected app accepted, competing apps rejected, notifications |
| Cancel job | owning patient or admin | job open or assigned | job cancelled, pending apps rejected, notifications, admin audit when admin actor |
| Complete job | owning patient, assigned nurse, or admin | job assigned, accepted nurse exists | job completed, notifications, admin audit when admin actor |
| Verification decision | admin | valid pending/reviewable nurse document/profile state | nurse verification status update, notification, admin audit |

## Recommended End State

Use a shared workflow service package inside the monorepo as the first consolidation step.

Recommended shape:

```text
packages/workflow
        job lifecycle rules
        application lifecycle rules
        assignment transaction orchestration
        notification intents
        audit intents
        shared typed results/errors

services/api
        owns public patient/nurse/admin API endpoints
        calls workflow package

apps/admin
        uses the same RPC-backed assignment and terminal finalizer contracts as API
        keeps admin-only verification server-side with matching audit/notification rules

apps/mobile
        calls API only
        never writes workflow tables directly
```

This keeps local development simple and avoids a large infrastructure migration while still removing duplicated decision logic.

Current implementation note:

- `@nursebridge/shared/workflow` exists for pure predicates and is consumed by API/admin/mobile.
- `@nursebridge/shared` now has a `build` script, compiled ESM output, and a verified Node-loadable `dist/workflow.js` runtime path.
- API pure predicates now consume `@nursebridge/shared/workflow` through the VM-reconciled `services/api/src/jobWorkflow.ts` adapter.
- API/admin assignment command planning, terminal notification payload planning, terminal eligibility classification, and terminal command side-effect planning now consume `@nursebridge/shared/workflow`, reducing drift in trust-sensitive rules and side effects while command persistence is still being consolidated.
- A review-only assignment RPC draft now lives at `docs/architecture/sql/assignment-finalize-rpc.draft.sql`, with the approval and verification path in `docs/ops/assignment-rpc-rollout-plan.md`. It is not applied to Supabase.
- A review-only terminal job RPC draft now lives at `docs/architecture/sql/terminal-job-finalize-rpc.draft.sql`, with the approval and verification path in `docs/ops/terminal-job-rpc-rollout-plan.md`. It is not applied to Supabase.
- Do not broaden API edits from the partial local API snapshot. Future API command-boundary work must still reconcile from the VM's full API source.
- The next consolidation slice should move admin assignment/cancel/complete behind the same RPC-backed finalizer contract used by API routes. Admin verification can remain admin-server-only because it is not a patient/nurse lifecycle transition.

## Why Not Database RPC First

A Postgres RPC can be the right tool for assignment because assignment touches multiple records and should be atomic.

However, moving all workflow behavior into database functions immediately would make product iteration harder during closed beta and would scatter business rules between TypeScript and SQL.

Use this split:

- TypeScript workflow package for rules, validation, typed errors, notification intent, and audit intent.
- Postgres transaction/RPC only for multi-record operations that must be atomic, especially assignment.

## Assignment Atomicity Plan

Assignment is the highest-priority consolidation target after create-job is fixed.

Target behavior:

1. Confirm actor is admin or owning patient.
2. Confirm job exists and is `open`.
3. Confirm selected application exists, belongs to the job, and is `applied`.
4. Confirm selected nurse is approved.
5. In one transaction:
   - set job status to `assigned`;
   - set canonical assignment field if one exists;
   - set selected application to `accepted`;
   - set competing `applied` applications to `rejected`;
   - write notification rows;
   - write admin audit row if actor is admin.
6. Return a typed result that both admin and API routes can render consistently.

The production canonical assignment column is `jobs.assigned_nurse_user_id`. Accepted application state should remain supporting evidence and compatibility state, and any read path that derives assignment only from accepted applications should be treated as temporary until the RPC-backed API/admin rollout is complete.

## Error Contract

Canonical workflow code should return stable error categories:

| Category | HTTP status | Meaning |
| --- | --- | --- |
| `unauthorized` | `401` | Missing or invalid auth. |
| `forbidden` | `403` | Authenticated actor lacks role or ownership. |
| `not_found` | `404` | Target job/application/profile is missing or not visible. |
| `invalid_transition` | `400` | Requested lifecycle transition is not allowed. |
| `conflict` | `409` | Duplicate action or stale state conflict. |
| `storage_or_db_error` | `500` | Unexpected persistence failure. |

User-facing clients should receive calm copy and a request reference. Logs should include safe diagnostic context without tokens or private care details.

## Migration Sequence

Do not begin broad consolidation while installed-device create-request proof is still missing.

After create-job is fixed:

1. Verify production data contract using `docs/ops/supabase-data-contract-verification.md`.
2. Reverify that live Supabase exposes `jobs.assigned_nurse_user_id` and that RPC-backed assignment writes it as the canonical field.
3. Inventory all state-changing workflow code in Fastify API and Next.js admin routes.
4. Extract pure lifecycle rule helpers into a shared workflow package if they are not already shared.
5. Move admin assignment to the same RPC-backed finalizer contract as API assignment.
6. Make assignment transactional through the approved database RPC with typed API/admin handling.
7. Move admin cancel/complete to the same RPC-backed terminal finalizer contract as API terminal actions.
8. Ensure notification and audit side effects are part of the canonical command result.
9. Add contract tests that exercise the same rules through API and admin paths.
10. Re-run full workflow smoke after explicit approval if production.

## Tests Required

Before marking this lane complete:

- Pure rule tests for every lifecycle helper.
- API route tests for patient create/cancel/complete.
- API route tests for nurse apply/withdraw/complete.
- Admin route tests for assign/cancel/complete/verification decision.
- Stale-write tests for assignment, cancellation, and completion.
- Contract tests confirming API and admin routes map the same invalid states to the same error categories.
- Database contract check for canonical job ownership and assignment fields.
- Smoke workflow evidence after implementation.
- Assignment RPC rollout evidence after owner approval, live schema verification, function grant verification, and API/admin integration.

## Acceptance Criteria

This consolidation lane is complete when:

- One canonical implementation governs lifecycle rules.
- Assignment cannot partially accept/reject applications in inconsistent ways.
- Admin and API routes cannot disagree on job/application transitions.
- Mobile still uses API-only workflow writes.
- Notifications and audit records are preserved.
- Tests cover stale writes, wrong-role attempts, invalid transitions, and terminal-state protection.
- Evidence is recorded in `docs/release/beta-evidence-log.md`.

## Explicit Non-Goals

Do not use this work to add:

- Payments.
- Public marketplace mechanics.
- Chat.
- Ratings/reviews.
- Insurance or claims workflow.
- Partner dashboards.
- New infrastructure platform migration.

This work exists to make the current trust loop reliable before NurseBridge grows.
