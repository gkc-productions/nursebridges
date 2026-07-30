# Terminal Job RPC Rollout Plan

This plan turns NurseBridge cancel/complete persistence from a guarded multi-write sequence into one atomic database operation. It is review-only until the owner explicitly approves a scoped Supabase schema/RPC change.

## Why This Matters

Cancel and complete are trust-sensitive terminal actions. A serious care platform should not leave a request half-closed, with applications rejected before the job status is claimed, or with durable notifications/audit evidence out of sync with the final status.

The current TypeScript path uses shared workflow planning and guarded status writes. The next production boundary is a database transaction/RPC for the final mutation unit.

## Proposed Boundary

Keep product/business decisions in TypeScript:

- actor role and ownership checks;
- patient/nurse/admin authorization;
- request validation;
- user-facing error mapping;
- support request references.

Move only the atomic persistence unit into Postgres:

- lock the job row;
- confirm the expected status is still current;
- for cancellation, reject still-applied applications;
- for completion, confirm an accepted nurse exists;
- set the terminal job status;
- write durable in-app notifications;
- write admin audit evidence when actor is admin.

Draft SQL lives at `docs/architecture/sql/terminal-job-finalize-rpc.draft.sql`.

## Approval Gate

Do not apply the RPC until a separate owner-approved task explicitly allows:

- Supabase function creation or replacement;
- function grants/revokes;
- API/admin runtime code path change to call the RPC;
- staging or production verification window.

This plan does not approve live Supabase schema changes by itself.

## Pre-Apply Checklist

Verify live schema first:

- `jobs.id` is `uuid`.
- `jobs.status` accepts `open`, `assigned`, `completed`, and `cancelled`.
- `jobs.patient_user_id` exists.
- `jobs.title` exists.
- `applications.job_id`, `applications.nurse_user_id`, `applications.status`, and `applications.created_at` exist.
- `applications.status` accepts `applied`, `accepted`, and `rejected`.
- `notifications` supports `user_id`, `type`, `title`, `body`, `entity_type`, and `entity_id`.
- `admin_audit_logs` supports `actor_id`, `action`, `entity_type`, `entity_id`, and `metadata`.

Verify security before apply:

- Function is not granted to `anon`.
- Function is not granted to `authenticated`.
- Function is granted only to `service_role` unless a stricter server-only DB role is introduced.
- `SECURITY DEFINER` function has an explicit `search_path`.
- API/mobile direct table permissions still do not allow bypassing workflow rules.

## API/Admin Integration Plan

After the RPC is approved and applied:

1. Add a terminal persistence adapter that calls `finalize_terminal_job_rpc`.
2. Preserve `@nursebridge/shared/workflow` as the source of truth for terminal eligibility, notification intent, and audit intent.
3. Map RPC failures into the existing workflow error contract:
   - `job_not_found` -> `not_found`.
   - `invalid_terminal_status`, `invalid_job_transition`, and `accepted_nurse_required` -> `invalid_transition`.
   - `terminal_conflict` or serialization conflict -> `conflict`.
   - unexpected database errors -> `storage_or_db_error`.
4. Update API patient/nurse terminal routes and admin web terminal actions to use the same RPC-backed finalizer.
5. Keep push delivery outside the transaction; in-app notification rows are the durable status channel.

## Verification Plan

Before deploy:

- Run the read-only prerequisite check:

```sh
node scripts/ops/check-terminal-job-rpc-contract.mjs
```

- Add unit tests for RPC error mapping.
- Add API/admin tests proving stale cancel/complete returns 409 and does not emit side effects.
- Add tests proving cancellation rejects applied applications in the same finalizer contract.
- Add tests proving completion requires an accepted nurse.
- Run full `pnpm verify`.

With explicit staging/production approval:

- Apply the function in a controlled window.
- Verify function grants.
- Run the strict read-only RPC exposure check:

```sh
node scripts/ops/check-terminal-job-rpc-contract.mjs --expect-rpc
```

- Run an approved closed-beta terminal-action smoke path.
- Confirm the job row, application rows, notifications, and audit row are consistent.
- Record evidence in `docs/release/beta-evidence-log.md`.

## Rollback Plan

If API/admin integration fails before deployment, keep the current guarded TypeScript multi-write path.

If a deployed RPC path fails:

- switch API/admin terminal actions back to the previous guarded finalizer;
- revoke execute from non-required roles if grants drifted;
- leave the function dormant until fixed;
- record the incident and test gap before retrying.

## Open Decisions

- Decide whether admin audit metadata should also include accepted nurse ID for completion.
- Decide whether a dedicated non-exposed server DB role should replace direct `service_role` RPC execution later.
