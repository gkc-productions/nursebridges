# NurseBridge Beta Data Contract

This document defines the intended closed-beta data contract for NurseBridge. It is not a migration file and does not prove the live Supabase schema. When VM/Supabase access is available, verify this contract against the production database before making schema-dependent changes.

Use `docs/ops/supabase-data-contract-verification.md` for the inspection-only verification steps.

## Contract Principles

- API routes own workflow writes. Mobile clients should not write directly to core workflow tables.
- The authenticated user, not the request body, determines ownership-sensitive IDs.
- `patient_user_id` is the canonical patient ownership field for jobs in current API behavior.
- Job status and application status are workflow contracts, not display-only strings.
- Private storage paths and service-role-only fields must never be exposed to mobile clients.
- Schema changes should be avoided until Android create-job and the full beta workflow are proven.

## Core Tables

Closed beta depends on these tables:

```text
profiles
nurse_profiles
jobs
applications
notifications
push_tokens
nurse_verification_documents
admin_audit_logs
```

## Profiles

Purpose:

- Store app user role and basic identity fields needed by API/admin flows.

Required beta behavior:

- API can resolve authenticated user profile by Supabase user ID.
- Role checks distinguish at least:
  - patient
  - nurse
  - admin
- Admin routes enforce admin role server-side.

Do not depend on:

- Client-provided role claims.
- Mobile-side role enforcement alone.

## Nurse Profiles

Purpose:

- Store nurse/caregiver verification state and eligibility to apply.

Required beta behavior:

- Nurse application routes can determine whether the nurse is approved.
- Admin verification actions can approve or reject a nurse/caregiver.
- Mobile can display verification status without seeing private review internals.

Canonical beta statuses:

```text
not_started
pending
approved
rejected
```

Production verification required:

- Confirm exact live status values and whether they already differ from the intended beta names.
- Confirm how nurse profile rows are created for new nurse users.

## Jobs

Purpose:

- Represent a patient/family care support request.

Canonical ownership:

- `patient_user_id` is canonical.
- The API sets `patient_user_id` from the authenticated patient.
- Mobile request bodies must not choose or override `patient_user_id`.

Canonical beta statuses:

```text
open
assigned
completed
cancelled
```

Required beta fields by behavior:

- Job ID.
- Patient owner ID.
- Status.
- Request title or support type.
- Description or notes.
- Address/location.
- Requested time/window.
- Optional hourly rate only if beta operation uses it.
- Created/updated timestamps.
- Assignment representation:
  - production canonical field: `jobs.assigned_nurse_user_id`;
  - supporting evidence: exactly one accepted application for the assigned nurse/caregiver;
  - compatibility-only reads may derive assignment from accepted applications until the RPC-backed API/admin rollout is complete.

Current known risk:

- Some current read paths may still derive assignment from accepted application state for compatibility.
- Before broader beta, writes should converge on `jobs.assigned_nurse_user_id` as canonical and treat accepted applications as supporting evidence, not a second source of truth.

Create-job insert contract:

- New jobs start as `open`.
- Optional blank `description`, `address`, `start_time`, and `hourly_rate` values normalize to `null`.
- API should log safe `create_job_failed` details if Supabase rejects insert.

Do not depend on:

- Client-provided status.
- Client-provided patient ownership.
- Client-provided assignment fields.
- Accepted application state as the only production assignment source after RPC-backed assignment is enabled.

## Applications

Purpose:

- Represent nurse/caregiver interest in a job.

Canonical beta statuses:

```text
applied
accepted
rejected
withdrawn
```

Required beta behavior:

- Nurse can apply only once per job.
- Nurse can apply only to `open` jobs.
- Nurse must be approved before applying.
- Accepted application identifies selected nurse/caregiver.
- Assignment rejects competing applied applications.
- Cancellation rejects pending applications.

Required beta fields by behavior:

- Application ID.
- Job ID.
- Nurse user ID.
- Status.
- Created/updated timestamps.

Do not depend on:

- Applying to terminal jobs.
- Selecting an application not in `applied`.
- Withdrawing accepted/rejected applications.

## Notifications

Purpose:

- Store in-app status updates and support auditability for workflow changes.

Required beta behavior:

- API/admin flows can create notifications for assignment, cancellation, completion, and verification decisions.
- Mobile can list authenticated user notifications.
- Notifications should not contain secrets, tokens, private storage paths, or raw sensitive care details.

Required beta fields by behavior:

- Notification ID.
- Recipient user ID.
- Type or title.
- Message/body.
- Read/unread state if supported.
- Created timestamp.
- Optional job/application reference.

## Push Tokens

Purpose:

- Store device push tokens for eventual Expo push delivery.

Required beta behavior:

- Mobile can register token where supported.
- Server-side notification workflow should not require push success to preserve in-app status visibility.

Do not depend on:

- Push delivery as the only status update channel.

## Nurse Verification Documents

Purpose:

- Store metadata for private nurse/caregiver verification uploads.

Required beta behavior:

- Nurse can create document metadata for self.
- Nurse cannot create metadata for another nurse.
- Admin can list relevant metadata for review.
- Storage bucket remains private.
- Signed upload/access is time-limited where used.

Required beta fields by behavior:

- Document ID.
- Nurse user ID.
- Document type.
- Storage object path or key, server/admin-only.
- Review status or linkage to nurse profile status.
- Created timestamp.

Do not expose:

- Permanent private storage URLs.
- Service role keys.
- Raw storage paths in mobile UI.

## Admin Audit Logs

Purpose:

- Preserve records of admin decisions and trust-sensitive workflow actions.

Required beta behavior:

- Assignment writes audit evidence.
- Cancel/complete admin actions write audit evidence.
- Nurse verification approval/rejection writes audit evidence.

Required beta fields by behavior:

- Audit ID.
- Admin user ID.
- Action name.
- Target type and target ID.
- Safe metadata.
- Created timestamp.

Do not store:

- Tokens.
- Passwords.
- Service keys.
- Raw private document paths.
- Unnecessary medical detail.

## RLS And Access Contract

Required beta behavior:

- Patients can read their own jobs.
- Patients cannot mutate other patients' jobs.
- Approved nurses can view eligible open jobs and their own applications/assigned work.
- Unverified nurses are blocked from application workflows.
- Admin server-side code can perform dispatcher and verification operations using protected server credentials.
- Mobile clients never receive service-role credentials.

Production verification required:

- Reverify RLS-backed patient, nurse, and admin flows after create-job is fixed.
- Confirm policies match the API-mediated workflow and do not accidentally allow direct client writes that bypass API validation.

## Verification Checklist When Access Returns

Before changing schema-dependent code:

1. Inspect live table columns for core tables.
2. Confirm canonical job ownership field is `patient_user_id`.
3. Confirm create-job insert payload matches live non-null constraints.
4. Confirm assignment representation:
   - accepted application
   - `assigned_nurse_user_id`
   - both
5. Confirm application status values.
6. Confirm nurse verification status values.
7. Confirm notification insert fields.
8. Confirm RLS behavior for patient, nurse, and admin test users.
9. Update this contract if production differs.
10. Add or update contract tests/smoke checks before broader beta.

## Current Known Gaps

- Live schema has not been re-inspected in this local-only pass.
- Android create-job failure may reveal a missing required column, naming mismatch, RLS problem, or normalization issue.
- Assignment representation needs a canonical decision before broader beta.
- Database contract tests do not yet exist as a dedicated suite.
