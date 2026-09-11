# Beta Release Readiness

This checklist summarizes current beta readiness for NurseBridge. It is not a production compliance certification.

Record verification evidence in `docs/release/beta-evidence-log.md` before marking incomplete or blocked items complete.
Use `docs/release/beta-verification-matrix.md` to confirm what evidence is required for each beta gate.
Use `docs/release/beta-evidence-templates.md` to keep evidence entries consistent.
Use `docs/release/closed-beta-go-no-go.md` for the owner/operator decision page before inviting outside testers.
Use `docs/ops/mobile-beta-build-readiness.md` before requesting or running any Expo/EAS beta build.

Current overall status:

- Core infrastructure is running.
- The intended beta workflow is implemented in pieces.
- Admin dispatcher assignment, cancel/complete, and nurse verification actions have direct regression coverage.
- Closed beta is blocked until mobile create-job and the full patient -> nurse -> admin workflow are verified on real devices.
- The backend create-job payload fix is deployed; the Expo Go/LAN proof path was abandoned. The immediate proof path is an approval-gated internal iOS/TestFlight build or recovered Android device access. iOS can prove the first installed workflow, but Android must be rechecked before wider beta unless the owner explicitly accepts an iPhone-first limitation.

Status legend:

- `[x]` Verified or implemented for current beta scope
- `[ ]` Not complete
- `[blocked]` Requires external device, account, policy, legal, or operational action
- `[deferred]` Explicitly out of current beta scope

## Auth and Roles

- [x] Supabase auth is wired for API, admin, and mobile clients.
- [x] Role checks exist for patient, nurse, and admin flows.
- [x] Protected API endpoints return clean JSON errors for missing/invalid auth.
- [x] Admin API routes enforce admin profile role.
- [x] Request IDs are included in API responses for debugging.

## Patient Workflow

- [blocked] Patient create-job has not yet been proven from a real device after the deployed backend payload fix.
- [x] Patient can list their jobs.
- [ ] Patient can cancel their own open or assigned jobs in a real-device workflow.
- [ ] Patient can complete assigned jobs in a real-device workflow.
- [ ] Other patients cannot cancel or complete someone else's job in a verified beta smoke test.

## Nurse Workflow

- [x] Approved nurse job and application routes are implemented.
- [ ] Approved nurses can view newly created patient jobs in a real-device workflow.
- [ ] Approved nurses can apply to open jobs in a verified beta smoke test.
- [ ] Nurses cannot apply to cancelled jobs in a verified beta smoke test.
- [ ] Assigned nurse can complete an assigned job in a verified beta smoke test.
- [ ] Unassigned nurse cannot complete a job in a verified beta smoke test.
- [x] Unverified nurses are blocked from job application workflows by API/RLS policy.

## Admin Workflow

- [x] Admin can list users, jobs, and nurses.
- [x] Admin request queue shows operational job fields and applicant counts.
- [x] Admin job detail shows applicants for the selected job.
- [x] Admin can assign approved applicant nurses to jobs.
- [x] Admin assignment rejects non-selected applications.
- [x] Admin can approve or reject nurse verification.
- [x] Admin can view nurse verification document metadata.
- [ ] Admin can cancel or complete eligible jobs in a verified beta smoke test.
- [x] Admin assignment, cancel, complete, and verification decision audit logging is implemented.

## Job Lifecycle

- [x] Valid job statuses are `open`, `assigned`, `completed`, and `cancelled`.
- [x] Lifecycle transition rules are implemented in API/admin code.
- [ ] Open jobs cannot be completed before assignment in a verified beta smoke test.
- [ ] Cancelled jobs cannot be completed in a verified beta smoke test.
- [ ] Completed jobs cannot be cancelled in a verified beta smoke test.
- [ ] Cancelling a job rejects pending applications in a verified beta smoke test.
- [ ] Completing a job keeps the accepted application accepted in a verified beta smoke test.
- [ ] Invalid transitions return clean `400` or `409` responses in a verified beta smoke test.
- [ ] Wrong-role transition attempts return `403` in a verified beta smoke test.

## Notifications

- [x] Notifications table and API are implemented.
- [x] Nurse verification approval/rejection notification creation is implemented.
- [x] Job assignment notification creation is implemented.
- [x] Job cancellation/completion notification creation is implemented.
- [x] Mobile registers for push tokens where supported.
- [ ] In-app notifications are verified during full patient/nurse/admin smoke test.
- [blocked] Real Expo push delivery test has not been completed on an actual device.

## Nurse Verification

- [x] `nurse_verification_documents` exists remotely.
- [x] `nurse-verification` storage bucket exists and is private.
- [x] Nurse document metadata and signed-upload routes are implemented.
- [ ] Nurse can create verification document metadata for self in a real-device workflow.
- [ ] Nurse cannot create metadata for another nurse in a verified beta smoke test.
- [x] Admin can list verification document metadata.
- [x] Admin approval/rejection updates nurse verification status.
- [x] Mobile has document picker upload flow using signed upload URL plus metadata save.
- [blocked] Real device file upload test has not been completed.

## Security/RLS

- [x] RLS policies exist for core tables and verification metadata.
- [ ] RLS-backed user flows should be reverified against the current beta workflow.
- [x] Service role keys are isolated to server-side API/admin code.
- [x] Mobile code does not reference service role keys or database passwords.
- [x] Private storage bucket remains private.
- [x] API logging redacts authorization/cookie/token-like fields.
- [ ] VM API logger redaction should be reverified on `/home/nurseapp/nursebridge` before inviting outside testers.
- [ ] Final beta security review should be performed before inviting external users.

## Secrets/Env

- [x] `.env` files are ignored by git.
- [x] Example env files exist for root, API, admin, and mobile.
- [x] Secrets management documentation exists.
- [x] Production systemd units explicitly load `/etc/nursebridge/api.env` and `/etc/nursebridge/admin.env`.
- [x] Runtime env file permissions documented as `root:root` and `chmod 600`.
- [ ] Confirm operational secret owner and rotation procedure before broader beta.

## Backups

- [x] Backup and recovery runbook exists.
- [x] Schema-only backup script exists.
- [x] Supabase automatic backups are documented as the primary recovery option.
- [x] Storage backup considerations are documented.
- [blocked] `pg_dump` was not installed in the verification environment, so the schema dump script was syntax-checked but not fully executed.
- [ ] Perform a test restore into a non-production Supabase project.

## Monitoring/Logs

- [x] API structured request logs include request ID, method, path, status code, and duration.
- [x] API responses include `x-request-id`.
- [x] Unhandled API errors return clean JSON without stack traces.
- [x] `/health` is fast and does not query the database.
- [x] Observability runbook exists.
- [x] Closed-beta operations playbook exists.
- [ ] Define who monitors logs during beta and expected response times.

## Workflow Atomicity

- [x] Review-only assignment RPC design exists.
- [x] Review-only terminal job RPC design exists.
- [x] Read-only RPC prerequisite checks exist for assignment and terminal actions.
- [x] Production canonical assignment field is documented as `jobs.assigned_nurse_user_id`.
- [x] Reverify live Supabase exposes `jobs.assigned_nurse_user_id` before RPC apply. Verified and backfilled on 2026-09-10; see `docs/release/beta-evidence-log.md`.
- [ ] Apply and expose `finalize_applied_assignment_rpc` after explicit owner approval.
- [ ] Wire API/admin assignment to the RPC-backed finalizer by default.
- [ ] Apply and expose `finalize_terminal_job_rpc` after explicit owner approval.
- [ ] Wire API/admin cancel/complete to the RPC-backed finalizer by default.
- [ ] Keep admin verification admin-server-only, but keep assignment/cancel/complete on the same API/admin finalizer contracts.
- [ ] Treat guarded multi-write workflow as internal engineering proof only unless the owner signs a written outside-tester exception.

## Cloudflare Routes

- [x] API Cloudflare health endpoint returns `200`.
- [x] Admin Cloudflare route reaches the app after redirect.
- [x] Cloudflare Access admin documentation exists.
- [ ] Confirm beta tester access rules before inviting external users.

## Mobile Build Readiness

- [x] Mobile beta build readiness runbook exists.
- [x] Mobile TypeScript typecheck passes.
- [x] Mobile environment examples document Expo public variables.
- [x] Mobile nurse verification upload flow is implemented.
- [blocked] Real-device create-job from an installed mobile build has not yet been completed after the deployed backend fix.
- [blocked] Android create-job recheck is still required before wider beta unless explicitly deferred by the owner.
- [blocked] Real device file upload test is still required.
- [blocked] Real Expo push delivery test is still required.
- [blocked] App store build has not been completed.
- [ ] Confirm app icons, bundle identifiers, signing, and store metadata.
- [ ] Run a beta build through the intended Expo/EAS channel.

## Legal/Compliance

- [x] Beta legal and consent checklist exists.
- [blocked] Privacy policy is not finalized.
- [blocked] Terms of service are not finalized.
- [blocked] Consent language for nurse verification documents is not finalized.
- [ ] Confirm data retention expectations for verification documents.
- [ ] Confirm support/escalation process for user data requests.
- [ ] Do not claim HIPAA, SOC 2, or other production compliance until formally reviewed and approved.

## Payments Deferred

- [deferred] Payments are not implemented.
- [deferred] Billing, payouts, refunds, disputes, tax, and payment-provider onboarding are outside current beta scope.
- [blocked] If beta requires paid transactions, payments must be implemented and reviewed before launch.

## Known Beta Blockers

- [blocked] Real-device patient create-job has not yet been proven after the deployed backend fix.
- [blocked] Android create-job recheck is still required before wider beta unless explicitly deferred by the owner.
- [blocked] Full patient -> nurse -> admin assignment workflow still needs real-device and admin-browser evidence; the controlled production API completion and cancellation smoke passed on 2026-09-10.
- [blocked] Real device file upload test.
- [blocked] Real Expo push delivery test.
- [blocked] App store build not done.
- [blocked] Legal/privacy/terms not finalized.
- [blocked] Test restore into a non-production Supabase project not completed.
- [deferred] Payments are intentionally not implemented for current beta scope.

## Recommended Remaining Task Order

Use `docs/release/closed-beta-operator-runbook.md` as the operating sequence for these tasks.

1. Review iOS internal/TestFlight build readiness without running a build, or recover Android device access. API route coverage, request-ID propagation, and the backend payload fix are already in place.
2. After explicit owner approval for an iOS build or when Android is available, trigger one real-device create-job attempt and inspect API logs.
3. If the real-device attempt fails, fix the exact `POST /jobs` root cause.
4. Run `scripts/ops/smoke-beta-workflow.sh` with approved patient, nurse, and admin test tokens. Production smoke runs require `ALLOW_PRODUCTION_SMOKE=1`. The script verifies patient create, nurse apply, pre-assignment complete rejection, admin assign, nurse complete, accepted application retention, completed-job cancel rejection, patient cancellation, pending-application rejection on cancellation, cancelled-job complete/apply rejection, and wrong-role nurse cancellation rejection.
5. Verify in-app notifications during the full workflow.
6. Run mobile real-device tests for nurse verification file upload and job completion.
7. Run real Expo push delivery tests on iOS and Android devices.
8. Finalize privacy policy, terms of service, and verification document consent language.
9. Confirm Cloudflare Access and beta tester access rules.
10. Define beta support coverage, log monitoring ownership, and incident response expectations.
11. Use `docs/ops/mobile-beta-build-readiness.md` to review Expo/EAS beta build configuration, signing, app icons, bundle identifiers, environment, and store metadata before requesting build approval.
12. Perform a Supabase restore drill in a test project using schema backup plus non-sensitive seed data.
13. Recheck Android create-job and core workflow before wider beta unless the owner explicitly accepts an iPhone-first beta limitation.
