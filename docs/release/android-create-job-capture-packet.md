# Android Create-Job Recheck Packet

Use this packet to recheck the Android patient create-job path after the backend payload fix, or to capture any remaining Android-specific failure safely and consistently.

## Purpose

The installed Android app previously could log in, and `GET /jobs` plus `GET /notifications` worked, but real-device `POST /jobs` returned `400`.

The backend payload fix for live `jobs.created_by` schema drift is deployed and verified. Backend diagnostics remain in place. The next useful Android evidence is one fresh Android patient create-job attempt after the deployed fix.

## Tester Script

Use a patient beta account.

1. Open the Android app.
2. Sign in as the patient tester.
3. Confirm the app reaches the patient area.
4. Start one care support request.
5. Fill the required fields with non-sensitive test data.
6. Submit once.
7. If it succeeds, confirm the new request appears in the patient request list with `open` status.
8. If it fails, tap `Copy issue details`.
9. Paste the result into the engineering thread.

Do not retry repeatedly unless engineering asks.

## Safe Test Data

Use non-sensitive placeholder details:

```text
Support type/title: Test care support request
Description: Test request for beta workflow verification
Location/address: Test address
Requested time/window: Any reasonable future test window
Mobility/support notes: Test notes only
```

Do not enter:

- Real medical details.
- Real diagnosis.
- Real private address unless explicitly approved for the test.
- Passwords.
- Tokens.
- Screenshots showing private data.

## What To Send Engineering

Send:

- Copied issue details from the app.
- Tester role: patient.
- Device model if known.
- Approximate time and timezone.
- App/build if visible.
- Whether login still works.
- Whether job list still loads.
- Whether the new request appears in the patient list.

Do not send:

- Passwords.
- Bearer tokens.
- Refresh tokens.
- Cookies.
- Supabase keys.
- Private medical details.
- Raw request body.

## Engineering Intake

After receiving the copied issue reference, inspect logs on the VM:

```sh
cd /home/nurseapp/nursebridge
scripts/ops/watch-create-job-logs.sh "30 minutes ago" "mobile-example-request-id"
```

If no reference is available:

```sh
cd /home/nurseapp/nursebridge
scripts/ops/watch-create-job-logs.sh "30 minutes ago"
```

Capture only:

- `requestId`
- event name
- endpoint path
- HTTP status
- validation issue path/message
- Supabase error code/message if present
- timestamp

## Expected Log Meanings

| Event | Meaning | Next Action |
| --- | --- | --- |
| `request_validation_failed` | API rejected payload before insert | Fix mobile payload or API validator. |
| `create_job_failed` | Payload passed validation but DB insert failed | Fix schema/constraint/RLS/insert payload mismatch. |
| `request_completed` with `POST /jobs` and a success status | Confirms the Android app reached the API and create-job completed | Record evidence, then continue workflow proof. |
| No `POST /jobs` event | App may not be reaching API or reference/window is wrong | Confirm app API base URL, tester timing, network, and whether the installed build has the current API URL fallback behavior. |

## Fix Requirements

After root cause is identified:

1. Patch the smallest affected module.
2. Add or update regression coverage for the exact failure.
3. Run focused tests.
4. Run full verification:

```sh
cd /home/nurseapp/nursebridge
pnpm verify
```

5. If API changed, use `docs/ops/deployment-runbook.md` for build/restart/health checks.
6. Record evidence in `docs/release/beta-evidence-log.md`.

## Evidence Template

Copy into `docs/release/beta-evidence-log.md` after the attempt:

```text
Date/time:
Timezone:
Tester:
Role: patient
Device/platform: Android
App/build:
Environment:
Workflow: patient create care request
Copied issue reference:
Watcher command:
Log event:
Request ID:
HTTP status:
Created job ID:
Created status:
Root cause if failed:
Fix commit/change:
Regression test:
Result:
Follow-up issue:
```

## Completion Criteria

This Android recheck is not closed until:

- Android patient creates a request successfully.
- Created request appears in patient job list.
- Created request has `open` status.
- Regression test covers the fixed failure.
- `pnpm verify` passes.
- Evidence is recorded.
