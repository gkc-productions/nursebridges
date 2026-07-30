# Job Lifecycle

This is the current closed-beta lifecycle contract for NurseBridge care requests.

The canonical API rule helpers live in `services/api/src/jobWorkflow.ts` and are covered by `services/api/test/jobWorkflow.test.ts`. High-risk workflow routes and guarded database writes also have regression coverage under `services/api/test/`.

Use `docs/architecture/workflow-source-of-truth.md` for the consolidation plan that removes lifecycle drift between API, admin, database, and mobile surfaces before broader beta.

## Statuses

- `open`: Patient-created request that can receive nurse applications.
- `assigned`: One nurse/caregiver has been selected. The request is no longer open for applications.
- `completed`: Care request finished. It cannot be cancelled, assigned, or receive applications.
- `cancelled`: Care request cancelled. It cannot be assigned, completed, or receive applications.

## Canonical Rules

| Rule | Current Helper | Expected Behavior |
| --- | --- | --- |
| Terminal status | `isTerminalJobStatus(status)` | Only `completed` and `cancelled` are terminal. |
| Apply | `canApplyToJob(status)` | Only `open` jobs can receive applications. |
| Assign | `canAssignJob(status)` | Only `open` jobs can be assigned. |
| Select application | `canSelectApplication(status)` | Only `applied` applications can be accepted, rejected, or assigned. |
| Withdraw application | `canWithdrawApplication(status)` | Only `applied` applications can be withdrawn. |
| Cancel | `canCancelJob(status)` | Only `open` and `assigned` jobs can be cancelled. |
| Complete | `canCompleteJob(status, hasAcceptedNurse)` | Only `assigned` jobs with an accepted nurse can be completed. |

## Allowed Transitions

| From | To | Actor | API Surface | Notes |
| --- | --- | --- | --- | --- |
| none | `open` | patient | `POST /jobs` | API sets `patient_user_id` from the authenticated user. Request body cannot choose the patient. |
| `open` | `assigned` | admin | `POST /admin/jobs/assign` | Selected nurse must be approved and must have applied. |
| `open` | `assigned` | owning patient | `POST /v1/applications/:applicationId/decide` | Accepting an application assigns the request and rejects other applications. |
| `open` | `cancelled` | owning patient or admin | `PATCH /jobs/:jobId/cancel`, `PATCH /jobs/:jobId`, or admin job action | Pending applications are rejected and relevant users are notified. |
| `assigned` | `cancelled` | owning patient or admin | `PATCH /jobs/:jobId/cancel`, `PATCH /jobs/:jobId`, or admin job action | Accepted/applied nurses are notified. |
| `assigned` | `completed` | owning patient, assigned nurse, or admin | `PATCH /jobs/:jobId/complete`, `PATCH /jobs/:jobId`, or admin job action | Requires an accepted nurse application. |

## Application Rules

- Nurses can apply only to `open` jobs.
- Nurses must be approved before applying.
- A nurse can have only one application per job.
- Duplicate applications return `409`.
- Applying to `assigned`, `completed`, or `cancelled` jobs returns `400`.
- Assigning a nurse accepts the selected application and rejects other applications for the job.
- Patient acceptance through `/v1/applications/:applicationId/decide` follows the same open-job rule.
- Admin assignment through `/admin/jobs/assign` follows the same open-job rule.
- Assignment writes are guarded with `jobs.status = open`, so stale assignment attempts fail instead of reassigning a job that already moved forward.
- Cancellation writes are guarded with the checked job status, so stale cancellation attempts fail instead of overwriting a job that changed.
- Completion writes are guarded with the checked job status, so stale completion attempts fail instead of overwriting a job that changed.
- Accepted, rejected, and withdrawn applications cannot be selected again.
- Accepted, rejected, and withdrawn applications cannot be withdrawn again.
- Status-changing writes are guarded with `status = applied`, so stale assignment or decision attempts fail instead of mutating already accepted, rejected, or withdrawn applications.

## Create-Job Rules

- `POST /jobs` is patient-only.
- The server builds the insert payload through `buildCreateJobPayload`.
- Optional blank `description`, `address`, `start_time`, and `hourly_rate` values are stored as `null`.
- Every newly created job starts with `status: "open"`.
- The API logs safe `create_job_failed` details when Supabase rejects the insert.

## Error Codes

- Missing or invalid bearer token: `401`
- Valid token with wrong role or wrong owner: `403`
- Missing target record: `404`
- Invalid lifecycle transition: `400`
- Duplicate application/conflict: `409`
- Successful create/update/action: `200`

## Current Coverage

- `POST /jobs` create-job route coverage verifies patient-only access, mobile payload validation, normalized insert payloads, and request IDs on insert failure.
- Nurse apply and withdraw route coverage verifies nurse verification, open-job checks, duplicate handling, conflict handling, and applied-only withdrawal.
- Patient application decision route coverage verifies ownership, open-job checks, applied-only decisions, guarded assignment, and rejection of competing applied applications.
- Admin assignment route coverage verifies open-job checks, applied-only selection, applied-only rejection, and assignment notifications.
- Cancel/complete route coverage verifies ownership and role authorization, applied-application rejection on cancellation, accepted-nurse requirements, notifications, guarded writes, and admin audit events.
- Status write coverage verifies guarded cancellation and completion writes.
- Next.js admin dispatcher workflow coverage verifies guarded assignment, guarded cancel/complete actions, nurse verification approval/rejection, notifications, and audit writes.

## Current Risks

- Admin assignment is not yet database-transactional.
- Next.js admin routes now have matching guardrails and direct regression coverage, but long-term they should call one canonical API/service path to avoid drift.
- Full patient -> nurse -> admin real-device smoke proof is still required before closed beta.
