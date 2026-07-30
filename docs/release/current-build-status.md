# Current Build Status

Twin automation is paused and is not part of the active NurseBridge build workflow.

## Active Workflow

- User keeps ownership and final say.
- Codex leads engineering architecture, sequencing, and implementation.
- Direct, scoped Codex work replaces the paused Twin workflow.
- Keep changes tied to the closed-beta care request workflow.

## Product Direction

NurseBridge is being shaped as a serious care-access coordination platform:

- Mobile app for patients/families and nurses/caregivers.
- Web admin console for dispatcher/admin operations.
- Fastify API as the workflow backbone.
- Supabase for auth, database, and private verification storage.
- Current VM/systemd/Cloudflare infrastructure remains in place while the core workflow is stabilized.

The first production milestone is a controlled closed beta, not public launch.

## Current Active Blocker

The backend create-job payload fix is deployed and verified on the VM, but real-device patient create-request proof is still missing.

The previous observed blocker was Android `POST /jobs` returning `400`. Live schema inspection showed the `jobs` table requires `created_by`, and the API create-job insert payload now sets `created_by`, `patient_user_id`, and `patient_id` from the authenticated patient. On 2026-07-18, VM API typecheck, build, 49 API tests, and the read-only live create-job schema contract guard passed after the fix.

The attempted iPhone Expo Go/LAN path was abandoned because it was not reliable enough for proof. The next serious iPhone path is an approval-gated internal iOS build or TestFlight route, not more QR retries.

The mobile app now has a generated native iOS project at `apps/mobile/ios`. Local Xcode Debug and Release compiles for `NurseBridge.xcworkspace` succeed for iPhone OS with signing disabled. The Release build includes production-style JS bundling. The app has internal-beta icon and splash assets, physical iOS internal and TestFlight EAS profiles, and an idempotent `pnpm run ios:repair` script for native prebuild repairs. The Apple/app-store identity has been aligned to the owner-provided plural identifier: `nursebridges`, bundle id `com.nursebridges.mobile`. A signed physical-device build is currently blocked by Apple account/provisioning, not by app compilation: Xcode reports no authenticated account for team `R2N3CHKSBB` and no development provisioning profile for `com.nursebridges.mobile`.

The local read-only installed-build preflight command is `cd apps/mobile && pnpm run ios:install-preflight`. Current preflight result: source identity and Xcode project identity pass for `nursebridges` / `com.nursebridges.mobile`, but no physical iPhone/iPad is visible to Xcode, no valid code-signing identity is installed, and no provisioning profile references `com.nursebridges.mobile`.

The mobile API environment fallback now protects physical iPhone and Android devices from using a stored `localhost` API base URL. Physical devices fall back to the approved tunnel/API base instead, which reduces false create-job failures during real-device testing.

Create-job route regression coverage now verifies patient-only access, mobile payload validation, normalized insert payloads, and request IDs on insert failure. The blocker is no longer lack of API instrumentation or known payload fix; it is lack of one fresh real-device create-request attempt after the deployed fix.

Admin dispatcher regression coverage now exists for assignment, cancel/complete terminal actions, and nurse verification approval/rejection. These tests protect guarded writes, notification creation, and audit logging for the trust-sensitive admin workflows.

The staged admin web app now has an operator-facing dispatcher foundation: request queue, verification queue, audit panel, ops status panel, and App Router shell. VM admin typecheck, 13 regression tests, and production build pass. Live admin proof is still pending controlled admin account testing against the deployed service.

On 2026-07-29, VM root `pnpm verify` and `pnpm run build` passed across the workspace after the shared assignment command-plan slice: lint placeholders, all typechecks, API 54 tests, mobile 17 tests, admin 16 tests, shared package 13 tests, scripts/ops smoke workflow 2 tests, and production builds for shared, API, and admin.

NB-08 workflow source-of-truth consolidation has advanced: `@nursebridge/shared/workflow` now owns canonical pure job/application predicates for API, admin, and mobile, emits compiled ESM output under `dist/`, and verifies tests against compiled `dist/workflow.js`. API/admin command orchestration and assignment atomicity remain open before broader beta.

The shared workflow package now also defines a typed error contract: `unauthorized`, `forbidden`, `not_found`, `invalid_transition`, `conflict`, and `storage_or_db_error` with stable HTTP status mapping. API, admin, and mobile workflow adapters re-export that contract for the next command-boundary consolidation slice.

Assignment paths now use that shared error contract for key API/admin assignment failures. Stale assignment claim failures are classified as `conflict` and return 409 on API admin assignment, patient application acceptance, and admin assignment core tests instead of generic invalid-transition/storage-style 400 responses.

Assignment stale-write hardening now claims the open job before mutating application statuses in API admin assignment, patient application acceptance, and admin web assignment paths. Stale claim failures now map to the shared `conflict` error category, reducing ambiguous failure handling. Full transaction/RPC-backed assignment is still required before broader beta.

Terminal cancel/complete paths now use the shared error contract for stale guarded status writes. API cancel/complete returns 409 conflict and admin terminal actions throw `statusCode: 409` with `category: "conflict"` when the final status claim updates no job row; tests also prove notifications and audit rows are not written after those stale terminal writes. Full transaction/RPC work remains required because the cancel path still rejects applied applications before the final job status claim.

Terminal cancel/complete notification payloads now come from `@nursebridge/shared/workflow` through `buildTerminalJobNotifications`. API and admin terminal paths still own their persistence orchestration for now, but the patient/nurse notification shape and recipient de-duplication are no longer duplicated across surfaces.

Terminal cancel/complete eligibility decisions now come from `@nursebridge/shared/workflow` through `getCancelJobDecision` and `getCompleteJobDecision`. API and admin terminal paths still fetch/persist independently, but role, ownership, accepted-nurse, and invalid-transition classification for terminal actions now share one tested decision contract.

Terminal cancel/complete side-effect planning now also comes from `@nursebridge/shared/workflow` through `createCancelJobCommandPlan` and `createCompleteJobCommandPlan`. API/admin terminal paths still perform their own database writes, but next status, applied-application rejection intent, notification nurse recipients, and admin audit intent are now shared command-plan outputs.

Assignment command side-effect planning now comes from `@nursebridge/shared/workflow` through `createAssignmentCommandPlan`. API/admin assignment paths now share selected-application validation, competing rejection recipient planning, assignment notifications, and admin assignment audit intent. `finalizeAppliedAssignment` also verifies the selected application is still in the applied set before the guarded job assignment write.

An assignment RPC design package has been added as review-only documentation: `docs/architecture/sql/assignment-finalize-rpc.draft.sql` and `docs/ops/assignment-rpc-rollout-plan.md`. This is the intended next database-atomicity step, but it has not been applied to Supabase and does not authorize schema/function changes.

The API now also has a review-only RPC finalizer contract in `services/api/src/jobAssignmentCommand.ts`. It calls `finalize_applied_assignment_rpc` with job, application, nurse, and actor context, and maps database/RPC errors back to the shared workflow categories. Current routes still use the existing guarded multi-write finalizer until the Supabase function is approved and applied.

API admin assignment and patient application acceptance now call assignment through an injectable finalizer seam. The default remains the existing guarded multi-write finalizer, but the route boundary now passes actor context through the same shape the future RPC-backed finalizer needs.

`scripts/ops/check-assignment-rpc-contract.mjs` now provides a read-only Supabase metadata check for the planned assignment RPC integration. Default mode verifies assignment table/column prerequisites while allowing the RPC to remain pending; `--expect-rpc` is the stricter post-apply gate before runtime integration.

The assignment RPC contract checker has local mock OpenAPI regression coverage and is included in the root script tests. This lets CI prove the checker behavior without live Supabase secrets while preserving the live read-only preflight for approved environments.

Terminal cancel/complete now has its own review-only database-atomicity package: `docs/architecture/sql/terminal-job-finalize-rpc.draft.sql` and `docs/ops/terminal-job-rpc-rollout-plan.md`. This targets the known partial-write risk where cancellation rejects applications before the final job status claim. It has not been applied to Supabase and does not authorize schema/function changes.

`scripts/ops/check-terminal-job-rpc-contract.mjs` now provides a read-only Supabase metadata check for the planned terminal job RPC integration. Default mode verifies terminal action table/column prerequisites while allowing the RPC to remain pending; `--expect-rpc` is the stricter post-apply gate before runtime integration.

The terminal job RPC contract checker has local mock OpenAPI regression coverage and is included in the root script tests. This lets CI prove the checker behavior without live Supabase secrets while preserving the live read-only preflight for approved environments.

The API now also has a review-only terminal RPC finalizer contract in `services/api/src/jobTerminalCommand.ts`. It calls `finalize_terminal_job_rpc` with job, actor, expected-status, and next-status context, and maps database/RPC errors back to the shared workflow categories. Current routes still use the existing guarded multi-write terminal path until the Supabase function is approved and applied.

Shared assignment planning now lives in `@nursebridge/shared/workflow`: selected application planning, competing nurse rejection recipients, and assignment notification payloads are shared by API/admin paths instead of being rebuilt independently.

Patient application accept/reject decisions now write structured audit rows after successful guarded decisions. This extends audit coverage beyond admin-only actions, which matters because patient acceptance can assign a nurse and move a job out of the open queue.

API admin assignment and patient application acceptance now share one API assignment finalization command for the trust-sensitive mutation sequence. This reduces route-level drift while the larger transaction/RPC gate remains open.

The mobile app now has a focused care-request language polish slice: high-visibility patient/nurse copy says care request/support instead of internal job language, and the patient/nurse empty-state/status language is covered by mobile workflow tests. This is intentionally narrower than the full redesign until installed-device create-job proof lands.

The patient create-request form now has visible care-language labels and uses a tested payload builder that normalizes optional fields, returns clearer validation errors, and proves the mobile client does not send ownership fields such as `patient_user_id`, `patient_id`, or `created_by`.

The patient create-request form now also captures contact context and mobility/support notes. These fields are folded into the existing API `description` payload as labeled sections, so the mobile UX captures safer dispatch context without introducing unsupported backend columns.

The nurse open-request list now gates the apply action through tested mobile workflow rules: the nurse must be approved, the request must be open, and no existing application state can be present. Existing application states render as clear nurse-facing labels instead of disabled apply controls.

The mobile home surface now includes a role-specific workflow snapshot focused on status, next step, and record visibility. Patient and nurse snapshot copy is produced by tested workflow helpers, and the app header renders that summary before metrics so the first screen reads like an operational care surface instead of a generic dashboard.

The patient mobile surface now also renders a focused current-request detail panel when a patient has a request. The panel shows status, assigned caregiver, start, location, rate, related update count, lifecycle timeline, and only eligible cancel/complete actions. The detail model is produced by tested workflow helpers so final requests stay final and active actions follow the shared lifecycle rules.

Patient mobile now has a first role-specific tab structure: Home, New Request, Records, and Updates. Home keeps status and next action first, New Request holds the create-request form, Records holds request history, and Updates holds notifications. Nurse/admin screens still use the existing single-flow layout until their own role-specific pass.

Nurse mobile now has a first role-specific tab structure: Home, Open Requests, My Work, Verification, and Updates. Home keeps verification/work status and next action first, Open Requests separates approved-nurse application work, My Work separates assigned/applied requests, Verification owns document upload/review state, and Updates owns notifications.

Nurse selected-request detail now uses a tested workflow model that shows status, summary, application state, location, start, rate, description, and only eligible Apply or Complete actions. The model distinguishes open applyable work, assigned-to-you work, and not-selected/assigned-to-someone-else states without exposing unsupported claims.

Patient and nurse mobile tabs now include Account. The Account panel shows beta access context, signed-in email, role, API connection, nurse verification status when relevant, sign-out, and support/safety language that makes clear NurseBridge is not an emergency service.

Patient and nurse identity/sign-out details now live in the Account tab instead of appearing above every workflow screen. Admin mobile keeps the signed-in panel because admin work is intentionally directed to the protected web console rather than a role-tab mobile flow.

Patient Home now includes a support/safety panel so the non-emergency boundary and beta support path are visible beside the current request status, not hidden only inside Account.

Patient and nurse request detail screens now share one mobile workflow detail shell for status, summary, safe fields, timeline, actions, and final-record language. This keeps role-specific screens consistent while the product moves away from one-off dashboard panels.

Patient records, nurse open requests, and nurse work now share one mobile request-summary card pattern. Cancel/complete confirmation copy also comes from tested workflow helpers, so terminal action language stays consistent across request detail and list surfaces.

Mobile workflow actions now use the support-ready API error formatter beyond create-request submission. Nurse apply, cancel/complete, notification updates, and verification metadata save failures preserve request references when the API provides them.

The closed-beta workflow smoke script now has a non-mutating `--preflight` mode for API reachability and patient/nurse/admin token role checks before any real care request is created or mutated. The script remains production-gated: mutating production smoke still requires explicit approval and `ALLOW_PRODUCTION_SMOKE=1`.

The smoke script now prints support-ready request trace lines for successful calls and expected rejection checks. Approved smoke output can be used as evidence because it includes method, path, status, and requestId without printing bearer tokens.

The smoke script now has regression coverage in root `pnpm test`. The script-level tests use a local mock API to prove non-mutating preflight behavior, requestId trace output, role parsing, token redaction, and production mutation gating.

## Operational Constraints

- Do not run an EAS build unless explicitly approved.
- Do not run Twin.
- Do not touch Cloudflare, Supabase schema, runtime env files, or secrets unless explicitly approved for a separate scoped task.
- Do not create live production test jobs unless explicitly approved.
- API/admin service restarts require explicit approval unless recovering a failed service.
- Do not claim HIPAA, insurance, background-check, or license-verification readiness until those processes are real and reviewed.
- Run `pnpm verify` before committing, deploying, or handing off a production-track change.

## Architecture References

- `docs/architecture/production-architecture.md`
- `docs/release/production-build-plan.md`
- `docs/architecture/job-lifecycle.md`
- `docs/release/beta-readiness.md`
- `docs/release/closed-beta-operator-runbook.md`
- `docs/ops/deployment-runbook.md`

## Current Product Priorities

1. Prove mobile create-request from a real installed mobile build now that the backend fix is deployed. iOS/internal can prove first; Android must be rechecked before wider beta unless the owner explicitly accepts an iPhone-first beta limitation.
2. Prove the patient -> nurse -> admin -> complete/cancel workflow.
3. Redesign the mobile app into a serious role-based care product.
4. Deploy/sync the admin dispatcher console to the VM when ready and prove it with a controlled admin account.
5. Continue consolidating duplicated lifecycle/dispatcher logic between Fastify and admin server routes.
6. Expand beta verification scripts.
7. Prepare controlled closed beta with 3 to 5 testers.

## Deferred

- Public launch.
- Payments and payouts.
- Chat.
- Ratings/reviews.
- Hospital/clinic partner dashboards.
- Claims/insurance workflows.
- HIPAA marketing claims.

## Next Priority

Follow `docs/release/closed-beta-operator-runbook.md`: resolve Apple signing/provisioning for `com.nursebridges.mobile`, choose `ios-internal` or `ios-testflight`, install a real iPhone build or create an approved TestFlight build, then trigger one real create-request attempt, inspect API logs, and record the result. Recheck Android before wider beta unless the owner explicitly accepts an iPhone-first limitation.

The latest iOS build review is `docs/release/ios-internal-build-readiness-review-2026-07-17.md`. It records the successful local native Xcode build and the current signed-install blocker.
