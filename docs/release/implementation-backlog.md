# NurseBridge Implementation Backlog

This backlog converts the production architecture, build plan, and experience spec into ordered engineering work packages. It should be updated as real evidence lands.

Use `docs/release/beta-verification-matrix.md` to map each work package to the evidence needed before closing the related beta gate.
Use `docs/release/closed-beta-go-no-go.md` before recommending any outside-tester beta launch.
Use `docs/product/ui-implementation-brief.md` to scope UI implementation work after real-device create-request is proven.
Use `docs/ops/mobile-beta-build-readiness.md` before any Expo/EAS beta build is requested or run.
Use `docs/architecture/workflow-source-of-truth.md` for NB-08 workflow consolidation.

## Operating Rules

- Keep NurseBridge isolated from Pathfinder.
- User owns product/final say; Codex leads engineering execution.
- Do not run Twin.
- Do not run EAS or production smoke without explicit approval.
- Do not touch Cloudflare, Supabase schema, secrets, or runtime env files without a separate scoped approval.
- Do not broaden scope before the closed-beta care request workflow is proven.
- Every completed package needs verification evidence.

## Package NB-00: Sync Staged Leadership Docs

Status:

- Completed for the current 2026-07-29 guarded package. Keep this package as the repeatable reconciliation checklist when new staged files are added.

Goal:

- Keep the local `vm-stage` leadership docs, mobile config/assets, mobile workflow slices, tests, ops identity guard, and staged-package guard synced to the VM through a scoped manifest.

Why:

- The VM repo should carry the current architecture, roadmap, experience spec, and handoff state.

Work:

- Follow `docs/release/vm-sync-handoff.md`.
- Copy staged files into `/home/nurseapp/nursebridge`.
- Verify references with the handoff `rg` command.
- Run `node scripts/ops/verify-nursebridges-identity.mjs` after syncing the script and staged files.
- Run `node scripts/ops/verify-vm-stage-package.mjs` after syncing to prove the handoff package is complete and does not include unsafe partial API sync instructions.
- Run mobile typecheck and tests after syncing the mobile helper/test files.
- Run admin typecheck and tests after syncing the admin workflow-rule files.

Acceptance:

- VM contains the staged architecture, product, release, and handoff docs.
- VM contains the staged mobile config/assets, mobile workflow helper/test files, admin workflow-rule test slice, and ops guard scripts.
- `git status --short` on the VM shows the expected docs, mobile config/assets, mobile helper/test, admin workflow-rule test, and ops-guard changes only, unless code work has also started.
- No service restart is performed for this sync.

Evidence:

- Terminal output or note in `docs/release/beta-evidence-log.md`.

## Package NB-01: Prove Real-Device Create-Request

Goal:

- Prove patient create-request works from an installed mobile build after the deployed backend payload fix.

Why:

- This is the current core blocker. Without real-device proof, NurseBridge cannot prove the patient -> nurse -> admin workflow.
- The backend create-job payload fix is deployed, but the installed mobile workflow is still unproven.

Work:

- Use `docs/ops/mobile-beta-build-readiness.md` and `docs/release/ios-internal-build-readiness-review-2026-07-17.md` before any iOS build request.
- Do not run EAS, TestFlight, app-store-connected actions, or credential changes without explicit owner approval.
- Resolve the current iOS signing blocker for `com.nursebridges.mobile`:
  - Xcode must show an authenticated account for team `HKQJ75SQVF`.
  - Apple Developer/App Store Connect must have or select the matching app identifier.
  - Xcode must be able to create/download a development provisioning profile for the connected iPhone.
- Use `docs/release/android-create-job-capture-packet.md` if Android access is recovered.
- Trigger one fresh patient create-request attempt from an installed iOS/internal build or Android app.
- Copy the app error reference.
- Inspect request-specific API logs.
- Patch only the exact root cause:
  - API validation mismatch.
  - Mobile payload shape.
  - Supabase insert/schema mismatch.
  - RLS behavior.
  - Required field/default issue.
- Add or update regression coverage for the exact failure.
- Run focused tests and full `pnpm verify`.
- Restart only the affected service if needed.

Acceptance:

- Patient can create a care request from an installed mobile build.
- Created request is visible to the patient through `GET /jobs`.
- Created request enters `open` status.
- Regression test fails before the fix or clearly covers the fixed failure mode.
- `pnpm verify` passes.

Evidence:

- Create-job debug evidence entry in `docs/release/beta-evidence-log.md`.
- Request ID and test result, with no secrets or private care details.
- Build/install evidence for whichever real-device path is used.

## Package NB-02: Prove Closed-Beta Workflow

Goal:

- Prove the full care request loop with controlled accounts.

Work:

- Use patient, nurse, and admin beta accounts.
- Run guarded smoke only after explicit approval if production.
- Verify:
  - Patient creates request.
  - Approved nurse sees request.
  - Nurse applies.
  - Admin sees applicant.
  - Admin assigns.
  - Assigned nurse completes.
  - Patient/admin sees final state.
  - Patient/admin cancellation rejects pending applications.
  - Terminal jobs cannot be mutated incorrectly.

Acceptance:

- Completion path passes.
- Cancellation path passes.
- Wrong-role and invalid-transition checks pass.
- Notifications/audit records exist where expected.

Evidence:

- Workflow smoke evidence entry in `docs/release/beta-evidence-log.md`.

## Package NB-03: Real-Device Patient Flow

Goal:

- Make the patient mobile workflow usable without developer guidance.

Work:

- Implement or refine patient home.
- Implement or refine create-request fields and field-level validation.
- Implement or refine patient request detail.
- Ensure eligible cancel/complete actions are visible only when allowed.
- Keep support-ready error references.

Acceptance:

- Patient can create, view, cancel, and complete eligible requests on an installed mobile build.
- Android is rechecked before wider beta unless the owner explicitly defers Android.
- Patient can understand request status within five seconds.
- Failed submit shows clear next step plus reference.

Evidence:

- Patient real-device evidence entry.
- Screenshots or notes if available, without private details.

## Package NB-04: Real-Device Nurse Flow

Goal:

- Make the nurse/caregiver mobile workflow usable and trust-aware.

Work:

- Implement or refine nurse home.
- Implement or refine verification status and document upload flow.
- Implement or refine open request list.
- Implement or refine nurse request detail and apply action.
- Implement assigned work and completion action.
- Keep unverified nurse state clear and non-punitive.

Acceptance:

- Unverified nurse understands what is blocked and why.
- Approved nurse can view and apply to open requests.
- Assigned nurse can complete assigned request.
- Verification upload works on an installed mobile build.
- Android is rechecked before wider beta unless the owner explicitly defers Android.

Evidence:

- Nurse real-device evidence entry.
- Nurse verification upload evidence entry.

## Package NB-05: Dispatcher Console Core

Goal:

- Make admin usable as a real dispatcher console.

Current status:

- Partially implemented locally on 2026-07-18.
- The staged admin app now has a Next.js App Router shell, dispatcher queue, verification queue, audit panel, ops status panel, and supporting admin runtime helpers.
- Local verification passed: admin typecheck, admin regression tests, and admin production build.
- Live workflow evidence is still pending because it requires VM deployment/env and controlled admin account proof.

Work:

- Request queue with practical columns:
  - status
  - requested time/window
  - patient/family
  - support type/title
  - general location
  - applicant count
  - assigned nurse/caregiver
  - last update
- Request detail with applicant list and assignment state.
- Assignment action with eligibility clarity.
- Cancel/complete actions with confirmation.
- Audit/notification visibility.

Acceptance:

- Dispatcher can identify requests needing assignment in one glance.
- Dispatcher can assign an approved applicant without guessing.
- Dispatcher can explain what happened to a request from the UI.
- Terminal admin actions leave audit evidence.

Evidence:

- Admin web evidence entry.
- Admin tests still pass.

## Package NB-06: Verification Console Core

Goal:

- Make caregiver verification review operationally usable.

Work:

- Verification queue by status.
- Nurse/caregiver detail.
- Document metadata view.
- Signed access only if supported safely.
- Approve/reject with reason.
- Notifications and audit logging.

Acceptance:

- Admin can approve or reject verification with recorded reason.
- Nurse sees understandable approval/rejection result.
- UI does not expose permanent private storage paths.

Evidence:

- Admin verification evidence entry.
- Nurse notification evidence entry.

## Package NB-07: Notification Proof

Goal:

- Prove status updates are visible and reliable enough for beta.

Work:

- Verify notification rows for create/apply/assign/cancel/complete where applicable.
- Verify in-app notification display on mobile.
- Verify real Expo push delivery separately on Android and iOS.
- Keep push failure from blocking in-app status visibility.

Acceptance:

- In-app notifications are visible during workflow.
- Push delivery result is recorded.
- Failed push test has a follow-up issue and does not hide workflow state.

Evidence:

- Notification evidence entries.

## Package NB-08: Backend Workflow Consolidation

Goal:

- Make assignment and terminal lifecycle transitions safe enough for outside-tester beta by converging API/admin command boundaries on RPC-backed finalizer contracts.

Current status:

- First admin-side slice completed locally on 2026-07-18: lifecycle predicates for assignment, cancellation, completion, application selection, and terminal status now live in `apps/admin/lib/workflowRules.ts`.
- Admin assignment and terminal-action helpers consume the shared rules.
- Direct workflow rule tests were added and admin regression coverage increased to 13 tests.
- First mobile-side helper slice completed locally on 2026-07-18: cancel/complete eligibility and patient/nurse focus-job selection now live in `apps/mobile/src/workflow.ts` with direct tests.
- Mobile lifecycle predicates now mirror the admin closed-beta rule set for assignment, cancellation, completion, selectable applications, terminal statuses, and canonical job statuses. Mobile completion no longer appears for an assigned job that has no accepted/assigned nurse signal.
- First shared-package slice completed on 2026-07-18: canonical pure job/application workflow predicates now live in `packages/shared/src/workflow.ts` with direct shared tests. Admin and mobile consume the shared package while preserving their existing adapter/helper APIs.
- Shared runtime-output slice completed on 2026-07-18: `@nursebridge/shared` now builds compiled ESM output under `dist/`, exposes runtime-safe package exports, and verifies workflow tests against compiled `dist/workflow.js`.
- API predicate-consolidation slice completed on 2026-07-18: VM-reconciled `services/api/src/jobWorkflow.ts` now re-exports `@nursebridge/shared/workflow`, so API, admin, and mobile share canonical pure job/application workflow predicates.
- Assignment stale-write hardening slice completed on 2026-07-18: API admin assignment, patient application-acceptance, and admin web assignment paths now claim the open job before mutating application statuses. New regression tests prove stale job assignment failures do not accept/reject applications or send notifications/audit rows.
- Shared assignment-planning slice completed on 2026-07-18: `@nursebridge/shared/workflow` now owns pure assignment application selection, rejection-recipient planning, and assignment notification payload construction. API admin assignment and admin web assignment consume the shared plan, and API patient application acceptance consumes the shared notification builder.
- Patient-decision audit slice completed on 2026-07-18: API patient application accept/reject decisions now write a structured `application_decision` audit row only after the guarded decision succeeds, and stale accept failures still avoid application mutations, notifications, and audit rows.
- API assignment-command slice completed on 2026-07-18: API admin assignment and patient application acceptance now share `services/api/src/jobAssignmentCommand.ts` for the final read-recipients, claim-job, accept-selected, reject-competing, and notify sequence.
- This does not complete NB-08 because full transaction/RPC-backed assignment and terminal finalization plus API/admin command-boundary convergence still need to be wired before outside-tester beta, unless the owner signs a written exception.

Work:

- Use `docs/architecture/workflow-source-of-truth.md` as the consolidation plan.
- Reconcile from the VM's full API source before touching runtime route behavior.
- Verify live Supabase schema and RPC exposure prerequisites using the read-only contract checks.
- Apply and wire `finalize_applied_assignment_rpc` after explicit owner approval.
- Move API/admin assignment to the same RPC-backed finalizer contract.
- Apply and wire `finalize_terminal_job_rpc` after explicit owner approval.
- Move API/admin cancel/complete to the same RPC-backed terminal finalizer contract.
- Keep admin-only verification in the protected admin server path with audit and notification coverage.
- Verify `docs/architecture/data-contract.md` against production using `docs/ops/supabase-data-contract-verification.md`.
- Add database contract checks for canonical job/application fields.

Acceptance:

- Assignment cannot partially accept/reject in inconsistent ways.
- Terminal cancel/complete cannot leave applications, notifications, audit, and job state out of sync.
- API and admin assignment/cancel/complete use the same RPC-backed finalizer contracts by default.
- Guarded multi-write workflow is internal engineering proof only unless the owner signs a written outside-tester exception.
- Tests cover patient, nurse, admin, stale write, wrong role, and terminal states.
- Data contract is updated if production schema differs.

Evidence:

- Test output.
- Architecture doc update.
- `docs/release/beta-evidence-log.md` entries for admin workflow rule extraction, mobile workflow predicate parity, and shared workflow predicate package extraction.

## Package NB-09: Operational Readiness

Goal:

- Run closed beta without improvising.

Work:

- Confirm monitoring owner.
- Define beta response expectations.
- Use `docs/ops/closed-beta-ops-playbook.md` as the operating model.
- Confirm access rules.
- Confirm secrets owner and rotation expectations.
- Complete non-production restore drill.
- Use `docs/ops/deployment-runbook.md` as the deploy/rollback checklist.
- Confirm support/escalation path.
- Review mobile beta build readiness without running EAS.

Acceptance:

- Named owner for beta monitoring.
- Restore drill evidence exists.
- Access-rule evidence exists.
- Support path is documented.
- Mobile build readiness risks are known before controlled beta distribution.

Evidence:

- Security/ops evidence entries.

## Package NB-10: Legal And Consent Readiness

Goal:

- Avoid overclaiming and protect beta testers.

Work:

- Use `docs/legal/beta-legal-consent-checklist.md` as the legal/consent readiness checklist.
- Prepare beta privacy policy.
- Prepare beta terms.
- Prepare verification document consent language.
- Define data retention expectations.
- Define user support/data request path.
- Remove unsupported compliance, insurance, background-check, or licensure claims from app copy.

Acceptance:

- Legal/consent language exists and is reviewed for beta.
- Product copy matches operational reality.
- Outside testers are not invited before this is ready.

Evidence:

- Legal/consent evidence entry.

## Package NB-11: Controlled Beta Launch

Goal:

- Start a tiny, supervised beta.

Scope:

- 1 admin/operator.
- 1 to 2 patient/family testers.
- 1 to 2 nurse/caregiver testers.
- Manual oversight for every request.

Work:

- Invite testers.
- Run onboarding.
- Use `docs/ops/mobile-beta-build-readiness.md` before distributing any mobile beta build.
- Track each workflow.
- Record feedback.
- Rank product gaps.
- Decide whether to expand, pause, or rebuild specific areas.

Acceptance:

- Several complete workflows are recorded.
- Known issues are triaged.
- Broader beta is approved intentionally, not by momentum.

Evidence:

- Beta evidence log.
- Product gap list.

## First Execution Sequence

The current execution sequence is:

```text
NB-00 keep guarded docs/package synced
        -> resolve iOS signing for com.nursebridges.mobile or recover Android access
        -> NB-01 prove real-device create-request via installed build
        -> NB-02 prove closed-beta workflow
        -> NB-08 wire RPC-backed assignment/terminal finalizers and admin/API command boundary
        -> NB-03/NB-04/NB-05 focused product hardening on proven paths
        -> NB-07 notifications
        -> NB-09/NB-10 beta readiness
        -> NB-11 controlled beta
```

NB-08 should not distract from NB-01 while real-device create-request remains unproven, but it is the default engineering gate before outside-tester beta once the workflow proof path is available. iOS can prove the first installed-device workflow; Android must be rechecked before wider beta unless the owner explicitly accepts an iPhone-first beta limitation.
