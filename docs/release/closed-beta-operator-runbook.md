# Closed Beta Operator Runbook

This is the operating sequence for moving NurseBridge from the current VM build into a controlled closed beta. It is not a public-launch checklist.

Use `docs/ops/closed-beta-ops-playbook.md` for monitoring roles, severity levels, support response, stop conditions, and incident intake during closed beta.
Use `docs/legal/beta-legal-consent-checklist.md` for the privacy, terms, verification consent, data retention, support, and copy-review gate before inviting outside testers.
Use `docs/release/beta-verification-matrix.md` to confirm the evidence required before each beta gate advances.

## Operating Rules

- Do not run Twin.
- Do not run EAS builds unless explicitly approved.
- Do not touch Cloudflare, Supabase schema, runtime env files, or secrets without a separate approved task.
- Do not create production test jobs unless there is explicit approval for a controlled smoke test.
- Do not claim HIPAA, SOC 2, insurance, license-verification, or background-check readiness until those processes are real and reviewed.
- Run `pnpm verify` before deploying or handing off production-track changes.

## Current Blocker

The backend create-job payload fix is deployed, but the patient create-request path still needs real-device proof after the fix.

The previous observed blocker was Android patient `POST /jobs` returning `400`. The iPhone Expo Go/LAN path was attempted and abandoned because it was not reliable enough for proof. The next useful device path is an approval-gated internal iOS/TestFlight build or recovered Android access.

## Step 1: Capture Real-Device Create-Job Result

Use `docs/ops/mobile-beta-build-readiness.md` before any iOS internal/TestFlight build request. Keep `docs/release/android-create-job-capture-packet.md` for the Android recheck.

On the real-device mobile app:

1. Sign in as a patient beta account.
2. Try to submit one care request.
3. If it succeeds, confirm the new request appears in the patient request list with `open` status.
4. If it fails, tap `Copy issue details`.
5. Paste the result into the engineering thread.

On the VM, inspect logs with the copied `Reference: mobile-...` value:

```sh
cd /home/nurseapp/nursebridge
scripts/ops/watch-create-job-logs.sh "30 minutes ago" "mobile-example-request-id"
```

If no reference is available, use the recent window:

```sh
cd /home/nurseapp/nursebridge
scripts/ops/watch-create-job-logs.sh "30 minutes ago"
```

Expected useful events:

- `request_validation_failed`: fix the mobile payload or API validator.
- `create_job_failed`: fix the database insert shape, constraint, RLS behavior, or schema mismatch.
- structured `POST /jobs` request event: confirms request ID, path, status, and timing.

Do not capture tokens, cookies, service keys, raw request bodies, passwords, or private document paths.

## Step 2: Patch Exact Root Cause

After the log reveals the cause:

1. Patch the smallest affected module.
2. Add or update a regression test for the exact failure.
3. Run focused checks for the touched package.
4. Run full verification:

```sh
cd /home/nurseapp/nursebridge
pnpm verify
```

If the API changed, rebuild and restart only the API:

```sh
cd /home/nurseapp/nursebridge
pnpm --filter @nursebridge/api build
sudo systemctl restart nursebridge-api.service
curl -fsS http://127.0.0.1:3000/health
curl -fsS https://api.nursebridges.com/health
```

## Step 3: Run Controlled Workflow Smoke

Only run this after create-job works and after explicit approval if the target is production.

Required tokens:

- `PATIENT_TOKEN`
- `NURSE_TOKEN`
- `ADMIN_TOKEN`

Staging/local example:

```sh
cd /home/nurseapp/nursebridge
PATIENT_TOKEN=... \
NURSE_TOKEN=... \
ADMIN_TOKEN=... \
API_BASE_URL=http://127.0.0.1:3000 \
scripts/ops/smoke-beta-workflow.sh
```

Non-mutating preflight:

```sh
cd /home/nurseapp/nursebridge
PATIENT_TOKEN=... \
NURSE_TOKEN=... \
ADMIN_TOKEN=... \
API_BASE_URL=http://127.0.0.1:3000 \
scripts/ops/smoke-beta-workflow.sh --preflight
```

Production requires explicit approval and:

```sh
ALLOW_PRODUCTION_SMOKE=1
```

Save the terminal output from the approved smoke run. Successful and expected-failure requests print `requestId` values that can be copied into the evidence log without exposing tokens or private care details.

The smoke script creates and mutates real care requests. It verifies:

- patient create
- nurse apply
- open job cannot complete before assignment
- admin assign
- nurse complete
- accepted application remains accepted
- completed job cannot be cancelled
- patient cancellation
- pending application rejected on cancellation
- cancelled job cannot complete
- nurse cannot apply to cancelled job
- nurse cannot cancel a patient request

## Step 4: Real-Device Beta Checks

After smoke passes:

1. Verify patient can create, see, cancel, and complete eligible requests on iPhone and Android, unless the owner explicitly defers one platform.
2. Verify approved nurse can view, apply, and complete assigned work on iPhone and Android, unless the owner explicitly defers one platform.
3. Verify admin can view request/applicant state in the web console.
4. Verify in-app notifications for create/apply/assign/cancel/complete.
5. Verify nurse document upload on a real device.
6. Verify real Expo push delivery on iOS and Android.

## Step 5: Closed Beta Go/No-Go

Do not invite outside testers until these are true:

- Create-job blocker fixed and regression-tested.
- Full smoke workflow passes with approved beta accounts.
- API, mobile, and admin verification commands pass.
- Privacy policy, terms, and verification-document consent language are ready for beta.
- Beta tester access rules are confirmed.
- Log monitoring owner and response expectations are defined.
- Backup/restore plan has at least one non-production restore drill.

## Evidence To Record

Use `docs/release/beta-evidence-log.md` as the beta evidence template.

For each beta readiness item, record:

- date and timezone
- tester role
- device/platform
- request ID when relevant
- endpoint or screen
- pass/fail result
- follow-up issue if failed

Mark docs as complete only when evidence exists.
