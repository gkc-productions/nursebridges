# Release Checkpoint: 2026-07-17

This checkpoint summarizes the current NurseBridge production-track state after VM access returned and the create-job backend fix was deployed.

## Current Product Direction

NurseBridge remains scoped to a controlled closed beta care-request workflow:

```text
patient creates request
        -> approved nurse applies
        -> admin assigns
        -> care is completed or cancelled
        -> notifications and records reflect the outcome
```

The product direction is still:

- Mobile app for patients/families and nurses/caregivers.
- Web admin console for dispatcher, assignment, verification, and support.
- Fastify API as the workflow backbone.
- Supabase for auth, database, RLS, and private document storage.
- Current VM/systemd/Cloudflare deployment while the core workflow is proven.

## Deployed Fix

The Android create-job blocker was traced to live schema drift:

- Live Supabase REST schema requires `jobs.created_by`.
- API create-job payload previously sent `patient_user_id` but not `created_by`.
- API create-job payload now sends:
  - `created_by`
  - `patient_user_id`
  - `patient_id`
  - title/details/status fields

The fix is in:

- `services/api/src/jobPayload.ts`
- `services/api/test/jobPayload.test.ts`
- `services/api/test/jobCreateRoute.test.ts`
- `services/api/dist/jobPayload.js`

The API service was rebuilt and restarted after the fix.

## Verification Completed

Completed evidence:

- `pnpm --filter @nursebridge/api test`: 49/49 passing.
- `pnpm --filter @nursebridge/api build`: passing.
- `pnpm verify`: passing after the create-job fix.
- Local API health: passing.
- Public API health at `https://api.nursebridges.com/health`: passing.
- Read-only live schema contract check: passing.

Contract guard:

- `scripts/ops/check-create-job-contract.mjs`
- Imports the built `buildCreateJobPayload` function.
- Fetches live Supabase REST schema metadata.
- Verifies unmanaged required `jobs` columns are covered by the actual API insert payload.
- Does not print keys, create rows, mutate schema, or run smoke.

Smoke traceability:

- `scripts/ops/smoke-beta-workflow.sh` sends `x-request-id` values prefixed with `smoke-`.
- The smoke script was syntax-checked only.
- The smoke script was not run, and no live smoke jobs were created.

## Still Not Proven

The installed Android app has not yet made a post-fix `POST /jobs` request that appears in API logs.

Do not mark Android create-job complete until one of these is recorded:

- Android app creates a patient request successfully, or
- Android app fails and provides a copied `Reference: mobile-...` value that maps to an inspected API log event.

Current log state:

- No post-fix Android `POST /jobs` event found in recent API logs.
- No post-fix `create_job_failed` event found in recent API logs.

## Next Action

Ask the tester to use the installed Android app:

1. Log in as a patient.
2. Create one safe test care request.
3. If it succeeds, record patient Android evidence.
4. If it fails, tap/copy issue details and provide the `Reference: mobile-...` value.

Then inspect logs:

```sh
cd /home/nurseapp/nursebridge
scripts/ops/watch-create-job-logs.sh "30 minutes ago" "mobile-request-id"
```

## After Android Create-Job Succeeds

Next production-track sequence:

1. Record patient Android create-job evidence.
2. With explicit approval if production, run controlled workflow smoke.
3. Verify patient -> nurse -> admin -> complete path.
4. Verify cancellation path.
5. Verify in-app notifications.
6. Continue mobile/admin UI hardening against the real workflow.

## Do Not Do Yet

- Do not run EAS or app-store builds.
- Do not run production smoke without explicit approval.
- Do not create live production jobs from scripts without explicit approval.
- Do not touch Cloudflare, Supabase schema, runtime env files, or secrets without a separately scoped approval.
- Do not claim HIPAA, insurance, background-check, or license-verification readiness.
- Do not broaden into payments, marketplace, chat, ratings, hospital dashboards, or insurance workflows.

## Key References

- `docs/release/current-build-status.md`
- `docs/release/beta-evidence-log.md`
- `docs/release/android-create-job-capture-packet.md`
- `docs/release/closed-beta-operator-runbook.md`
- `docs/release/beta-readiness.md`
- `docs/ops/supabase-data-contract-verification.md`
- `docs/architecture/data-contract.md`
- `docs/architecture/job-lifecycle.md`
