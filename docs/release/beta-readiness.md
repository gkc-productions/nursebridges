# Beta Release Readiness

This checklist summarizes current beta readiness for NurseBridge. It is not a production compliance certification.

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

- [x] Patient can create jobs.
- [x] Patient can list their jobs.
- [x] Patient can cancel their own open or assigned jobs.
- [x] Patient can complete assigned jobs.
- [x] Other patients cannot cancel or complete someone else's job.

## Nurse Workflow

- [x] Approved nurses can view job workflow data.
- [x] Approved nurses can apply to open jobs.
- [x] Nurses cannot apply to cancelled jobs.
- [x] Assigned nurse can complete an assigned job.
- [x] Unassigned nurse cannot complete a job.
- [x] Unverified nurses are blocked from job application workflows.

## Admin Workflow

- [x] Admin can list users, jobs, and nurses.
- [x] Admin can assign verified nurses to jobs.
- [x] Admin assignment rejects non-selected applications.
- [x] Admin can approve or reject nurse verification.
- [x] Admin can view nurse verification document metadata.
- [x] Admin can cancel or complete eligible jobs.
- [x] Admin assignment, cancel, complete, and verification decisions write audit logs.

## Job Lifecycle

- [x] Valid job statuses are `open`, `assigned`, `completed`, and `cancelled`.
- [x] Open jobs cannot be completed before assignment.
- [x] Cancelled jobs cannot be completed.
- [x] Completed jobs cannot be cancelled.
- [x] Cancelling a job rejects pending applications.
- [x] Completing a job keeps the accepted application accepted.
- [x] Invalid transitions return clean `400` or `409` responses.
- [x] Wrong-role transition attempts return `403`.

## Notifications

- [x] Notifications table and API are implemented.
- [x] Nurse receives notification after verification approval or rejection.
- [x] Job assignment creates notifications.
- [x] Job cancellation/completion creates notifications for relevant users.
- [x] Mobile registers for push tokens where supported.
- [blocked] Real Expo push delivery test has not been completed on an actual device.

## Nurse Verification

- [x] `nurse_verification_documents` exists remotely.
- [x] `nurse-verification` storage bucket exists and is private.
- [x] Nurse can create verification document metadata for self.
- [x] Nurse cannot create metadata for another nurse.
- [x] Admin can list verification document metadata.
- [x] Admin approval/rejection updates nurse verification status.
- [x] Mobile has document picker upload flow using signed upload URL plus metadata save.
- [blocked] Real device file upload test has not been completed.

## Security/RLS

- [x] RLS-backed user flows have been verified for nurse verification metadata.
- [x] Service role keys are isolated to server-side API/admin code.
- [x] Mobile code does not reference service role keys or database passwords.
- [x] Private storage bucket remains private.
- [x] API logging redacts authorization/cookie/token-like fields.
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
- [ ] Define who monitors logs during beta and expected response times.

## Cloudflare Routes

- [x] API Cloudflare health endpoint returns `200`.
- [x] Admin Cloudflare route reaches the app after redirect.
- [x] Cloudflare Access admin documentation exists.
- [ ] Confirm beta tester access rules before inviting external users.

## Mobile Build Readiness

- [x] Mobile TypeScript typecheck passes.
- [x] Mobile environment examples document Expo public variables.
- [x] Mobile nurse verification upload flow is implemented.
- [blocked] Real device file upload test is still required.
- [blocked] Real Expo push delivery test is still required.
- [blocked] App store build has not been completed.
- [ ] Confirm app icons, bundle identifiers, signing, and store metadata.
- [ ] Run a beta build through the intended Expo/EAS channel.

## Legal/Compliance

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

- [blocked] Real device file upload test.
- [blocked] Real Expo push delivery test.
- [blocked] App store build not done.
- [blocked] Legal/privacy/terms not finalized.
- [blocked] Payments not implemented.
- [blocked] Test restore into a non-production Supabase project not completed.

## Recommended Remaining Task Order

1. Finalize privacy policy, terms of service, and verification document consent language.
2. Run mobile real-device tests for sign-in, nurse verification file upload, job application, job completion, and notifications.
3. Run real Expo push delivery tests on iOS and Android devices.
4. Perform a Supabase restore drill in a test project using schema backup plus non-sensitive seed data.
5. Confirm Cloudflare Access and beta tester access rules.
6. Define beta support coverage, log monitoring ownership, and incident response expectations.
7. Prepare Expo/EAS beta build configuration, signing, app icons, bundle identifiers, and store metadata.
8. Create and distribute the first app store or internal beta build.
9. Run an end-to-end beta smoke test with patient, nurse, and admin accounts.
10. Decide whether payments remain deferred for beta or must be implemented before inviting users.
