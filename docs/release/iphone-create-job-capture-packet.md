# iPhone Create-Job Capture Packet

Use this packet only as historical context for the abandoned Expo Go/LAN attempt.

Do not continue retrying this path. The next serious iPhone proof path is an approval-gated internal iOS build or TestFlight route documented in `docs/ops/mobile-beta-build-readiness.md`.

## Purpose

The backend create-job payload fix for live `jobs.created_by` schema drift is deployed and verified. API health, API tests, mobile helper tests, and the live schema contract guard have passed.

The next useful evidence is one fresh real-device patient create-request attempt from an installed build against `https://api.nursebridges.com`.

The Expo Go/LAN route was attempted and abandoned because it was not reliable enough for proof. Real external iPhone testers should use a TestFlight/internal build after approval.

## Historical Expo Go Setup

The historical Expo Go prerequisites were:

- iPhone connected or on the same Wi-Fi network.
- Expo Go installed on the iPhone.
- Local mobile dependencies installed in `apps/mobile`.
- Do not run EAS or TestFlight builds without explicit approval.

This section remains only to explain what was tried.

Start the local Expo server from the mobile app folder:

```sh
cd /home/nurseapp/nursebridge/apps/mobile
pnpm exec expo start --lan --clear
```

If running from the local Codex workspace copy, use the equivalent local path.

On the local Mac/Codex workspace, the helper script can perform the connected-iPhone and Expo Go checks before starting Expo:

```sh
scripts/ops/start-iphone-expo-test.sh
```

Open the app on iPhone:

1. Open Expo Go or the iPhone Camera app.
2. Scan the Expo QR code.
3. Confirm the app opens as `NurseBridge`.
4. Confirm the API/environment points to `https://api.nursebridges.com` if visible.

If scanning the QR code is inconvenient, the helper prints a direct-open command after it confirms Expo Go is installed:

```sh
xcrun devicectl device process launch --device DEVICE_ID host.exp.Exponent --payload-url exp://MAC_IP:8081
```

If Expo Go is not installed, install it from the App Store before continuing.

The app should auto-correct away from a stored `localhost` API base URL on physical iPhone devices. If the app still shows a local API URL, record that in the engineering result.

## Replacement Path

Use `docs/ops/mobile-beta-build-readiness.md` to review:

- iOS bundle identifier.
- app identity.
- environment variables.
- signing path.
- EAS/TestFlight risk.
- owner approval.

From the local Mac/Codex mobile workspace, run the read-only installed-build preflight before requesting any build approval:

```sh
cd apps/mobile
pnpm run ios:install-preflight
```

The preflight must show a visible physical iPhone/iPad, a valid code-signing identity, and a provisioning profile for `com.nursebridges.mobile`. If any of those fail, resolve Apple/Xcode signing first.

After approval and installation, use the tester script below with the installed build.

## Tester Script For Installed Build

Use a patient beta account.

1. Open the installed NurseBridge build.
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

- Whether submit succeeded or failed.
- Copied issue details from the app, if it failed.
- Tester role: patient.
- Device model if known.
- Approximate time and timezone.
- App/build path: internal iOS/TestFlight build.
- Whether login works.
- Whether job list loads.
- Whether the API connected line shows `https://api.nursebridges.com`, if visible.
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

Watch or inspect logs on the VM:

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
| `request_completed` with `POST /jobs` and a success status | Confirms the iPhone reached the API and create-job completed | Record evidence, then prove list/status and continue workflow. |
| `request_validation_failed` | API rejected payload before insert | Fix mobile payload or API validator. |
| `create_job_failed` | Payload passed validation but DB insert failed | Fix schema/constraint/RLS/insert payload mismatch. |
| No `POST /jobs` event | App may not be reaching API or the log window/reference is wrong | Confirm the installed build opened, API base URL, tester timing, and network. |

## Evidence Template

Copy into `docs/release/beta-evidence-log.md` after the attempt:

```text
Date/time:
Timezone:
Tester:
Role: patient
Device/platform: iPhone
App/build: internal iOS/TestFlight build
Environment: https://api.nursebridges.com
Workflow: patient create care request
Copied issue reference:
Watcher command:
Log event:
Request ID:
HTTP status:
Created job ID:
Created status:
Regression test:
Result:
Follow-up issue:
```

## Completion Criteria

This iPhone proof is complete when:

- iPhone patient creates a request successfully.
- Created request appears in patient job list.
- Created request has `open` status.
- API logs include the matching `POST /jobs` request.
- Evidence is recorded.

Closed beta is still not ready until the full patient -> nurse -> admin -> outcome workflow is proven and Android is rechecked or explicitly deferred by the owner.
