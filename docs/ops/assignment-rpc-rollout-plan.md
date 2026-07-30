# Assignment RPC Rollout Plan

This plan turns NurseBridge assignment from a guarded multi-write sequence into one atomic database operation. It is review-only until the owner explicitly approves a scoped Supabase schema/RPC change.

## Why This Matters

Assignment is trust-sensitive. A serious care platform cannot leave the system in a state where a job is assigned but the selected application is not accepted, competing applications are not rejected, or notification/audit evidence is missing.

The current TypeScript guardrails reduce that risk, but a database transaction/RPC is the correct next boundary for the final write sequence.

## Proposed Boundary

Keep product/business decisions in TypeScript:

- actor role and ownership checks;
- request validation;
- user-facing error mapping;
- support request references;
- API/admin authorization.

Move only the atomic persistence unit into Postgres:

- lock the open job;
- confirm selected application is still applied;
- confirm selected nurse/caregiver is approved;
- set job assigned and canonical assigned nurse field;
- accept selected application;
- reject competing applied applications;
- write in-app notifications;
- write admin audit evidence when actor is admin.

Draft SQL lives at `docs/architecture/sql/assignment-finalize-rpc.draft.sql`.

## Approval Gate

Do not apply the RPC until a separate owner-approved task explicitly allows:

- Supabase function creation or replacement;
- function grants/revokes;
- API code path change to call the RPC;
- staging or production verification window.

This plan does not approve live Supabase schema changes by itself.

## Pre-Apply Checklist

Verify live schema first:

- `jobs.id` is `uuid`.
- `jobs.status` accepts `open` and `assigned`.
- `jobs.assigned_nurse_user_id` exists and is the canonical assignment field, or the draft must be revised before apply.
- `applications.id`, `applications.job_id`, and `applications.nurse_user_id` are `uuid`.
- `applications.status` accepts `applied`, `accepted`, and `rejected`.
- `nurse_profiles.nurse_id` matches `applications.nurse_user_id`.
- `nurse_profiles.verification_status = 'approved'` is the approved caregiver/nurse signal.
- `notifications` supports `user_id`, `type`, `title`, `body`, `entity_type`, and `entity_id`.
- `admin_audit_logs` supports `actor_id`, `action`, `entity_type`, `entity_id`, and `metadata`.

Verify security before apply:

- Function is not granted to `anon`.
- Function is not granted to `authenticated`.
- Function is granted only to `service_role` unless a stricter server-only DB role is introduced.
- `SECURITY DEFINER` function has an explicit `search_path`.
- API/mobile direct table permissions still do not allow bypassing workflow rules.

## API Integration Plan

After the RPC is approved and applied:

1. Add an API/admin assignment persistence adapter that calls `finalize_applied_assignment_rpc`.
2. Preserve `@nursebridge/shared/workflow` as the source of truth for request-level planning and error categories.
3. Map RPC failures into the existing workflow error contract:
   - `job_not_found` and `application_not_found` -> `not_found`.
   - `invalid_job_transition` and `application_not_selectable` -> `invalid_transition`.
   - `nurse_verification_required` -> `forbidden`.
   - `assignment_conflict` or serialization conflict -> `conflict`.
   - unexpected database errors -> `storage_or_db_error`.
4. Update API admin assignment and patient application acceptance to use the same RPC-backed finalizer.
5. Update admin web assignment to call the same canonical finalizer or API endpoint.
6. Keep push delivery outside the transaction; in-app notification rows are the durable status channel.

## Verification Plan

Before deploy:

- Run the read-only prerequisite check:

```sh
node scripts/ops/check-assignment-rpc-contract.mjs
```

- Add unit tests for RPC error mapping.
- Add API route tests proving stale assignment returns 409.
- Add API route tests proving selected application, competing application, notification, and audit behavior.
- Add admin action tests for the same RPC-backed result contract.
- Run full `pnpm verify`.

With explicit staging/production approval:

- Apply the function in a controlled window.
- Verify function grants.
- Run the strict read-only RPC exposure check:

```sh
node scripts/ops/check-assignment-rpc-contract.mjs --expect-rpc
```

- Run a non-sensitive assignment fixture or approved closed-beta smoke path.
- Confirm the job row, selected application, competing applications, notifications, and audit row are consistent.
- Record evidence in `docs/release/beta-evidence-log.md`.

## Rollback Plan

If API integration fails before deployment, keep the current guarded TypeScript multi-write path.

If a deployed RPC path fails:

- switch API/admin assignment back to the previous finalizer;
- revoke execute from non-required roles if grants drifted;
- leave the function dormant until fixed;
- record the incident and test gap before retrying.

## Open Decisions

- Decide whether audit rows for patient acceptance should be written inside a broader RPC variant or remain in API after a successful RPC.
- Decide whether a dedicated non-exposed server DB role should replace direct `service_role` RPC execution later.
