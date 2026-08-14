# Milestone 2 Verification — 2026-08-14

Status: implementation and installed-device startup verification complete; production deployment remains separately gated.

## Delivered

- Five-step guided patient care request with native date and time pickers and structured home/transportation intake.
- Context-aware patient home and patient-safe request timeline.
- Request-specific messages restricted by RLS to the patient, assigned nurse, and administrators.
- Generic message notifications that do not copy message content into push or notification records.
- Care-circle consent foundation with request scope, pending/accepted/expired/revoked states, seven-day expiry, delivery state, and immediate revocation.
- Patient-safe assigned-nurse profile containing only display name, approved verification state, specialty, experience, biography, license state, and verification date.
- Pre-visit readiness showing appointment, meeting point, transportation plan, and nurse confirmation state.
- Patient navigation aligned to `Home | Care | Messages | Activity | Account`.

## Database proof

- Isolated project: `nursebridge-milestone2-dev` (`sxzhmflzegkznqrszrfv`).
- Production was not changed and no production data or users were copied.
- All repository migrations replayed successfully after repairing four historical fresh-install assumptions.
- `job_messages` exists with SELECT and INSERT RLS policies.
- `anon` has neither `USAGE` on `app_private` nor `EXECUTE` on its policy helpers.
- Authenticated users can execute only the policy helpers required by RLS; the signup trigger helper is not RPC-callable.
- Supabase security advisor: no warnings; one informational finding remains for `patient_access_requests`, which intentionally has RLS enabled with no client policy because it is written only through the service-role API.
- Supabase performance advisor findings are historical policy/index optimization notices, not Milestone 2 correctness failures. No broad policy rewrite was mixed into this milestone.

## Automated and native verification

- `pnpm verify`: passed.
  - All workspace type checks passed.
  - API: 79 tests passed.
  - Patient mobile: 35 tests passed.
  - Shared workflow: 14 tests passed.
  - Admin: 19 tests passed.
  - Operations/safety: 30 tests passed.
- iOS Simulator Debug build: passed with Xcode 27 beta.
- Signed Debug build targeting connected `kossivi’s iPhone`: passed for bundle `com.nursebridges.mobile` and team `HKQJ75SQVF`.
- The signed artifact was installed as an in-place update without uninstalling or clearing the data container.
- Physical-device launch succeeded with Metro reachable, the existing signed-in state restored, the patient Home screen rendered, and the existing API serving request/notification data.
- Device proof exposed and verified a client guard fix: open requests no longer call the visit-progress endpoint before assignment, so an optional backend `404` no longer becomes a global red error.
- The Home quick action and bottom navigation consistently label the destination `Messages`.

## Cost and external state

- The isolated Supabase project is on the free plan: $0 incurred against the approved $5 development ceiling.
- No paid email/SMS provider was provisioned.
- Care-circle invitations therefore remain `not_sent`; the UI truthfully states that no updates are shared until secure delivery and recipient acceptance are enabled.

## Release limitations and next gate

- Apply migrations and deploy the API only after a separate production approval and migration-history reconciliation plan.
- Secure care-circle delivery/acceptance is a later operational enablement step; persisted consent alone does not grant or transmit protected information.
- Request messaging, trusted-nurse lookup, and care-circle invitation state cannot receive production end-to-end proof until their migration and API routes are separately approved and deployed.
- No archive, App Store upload, distribution, production migration, or Git push was performed.
