# Engineering State Snapshot

This snapshot records the current NurseBridge engineering state. The guarded package described below was synced back to `/home/nurseapp/nursebridge` and verified on the VM on 2026-07-18.

## Leadership Posture

- User keeps ownership and final say.
- Codex is acting as lead engineer across product architecture, implementation sequence, QA, release discipline, and operational readiness.
- NurseBridge must stay isolated from Pathfinder. Do not share deployment paths, service files, env files, repositories, or operational shortcuts between the two projects.

## Product Strategy

NurseBridge should be built as a serious care-access coordination product:

- Native-feeling mobile app for patients/families and nurses/caregivers.
- Web admin dispatcher console for operations, verification, assignment, and support.
- API-first workflow layer so mobile, admin, automation, and future partner surfaces all use the same source of truth.
- Supabase for auth, database, RLS, and private verification storage.
- Current VM, systemd services, Cloudflare routes, and Supabase project remain the operational base until the closed-beta workflow is proven.

The near-term release is a closed beta, not a public marketplace launch.

Canonical mobile build identity is `nursebridges` with the `s`: iOS bundle id and Android package `com.nursebridges.mobile`. The public API base is `https://api.nursebridges.com`.

## Last Verified VM State

Before VM access was blocked, the following was verified on the VM:

- API tests: 49/49 passing.
- Mobile tests: 7/7 passing.
- Admin tests: 10/10 passing.
- Full `pnpm verify` passed.
- API service was rebuilt and restarted successfully.
- Admin service was rebuilt and restarted successfully.
- Public API `/health` returned OK.
- Public admin route returned the expected Cloudflare Access redirect.

After the guarded VM sync on 2026-07-29, VM API typecheck, API build, 59 API tests, the read-only live create-job schema contract check, shared package typecheck/build, 13 shared package tests against compiled `dist/workflow.js`, mobile typecheck, 23 mobile tests, admin typecheck, 16 admin tests, scripts/ops tests 5/5, 77-file staged-package guard, root `pnpm verify`, and root `pnpm run build` passed after the lead-engineering blueprint, mobile role-specific workflow slices, and terminal job RPC approval package were added.

The newer API terminal RPC finalizer adapter, go/no-go packet, evidence-template, access and secrets readiness guard, admin/API boundary readiness guard, API log hygiene guard, beta gate guard, beta operations readiness guard, canonical assignment readiness guard, in-app consent readiness guard, legal and consent readiness guard, production sequence readiness guard, release-doc guard, mobile secret hygiene guard, mobile support snapshot guard, NurseBridge isolation guard, notification and audit privacy guard, private document path hygiene guard, real-device proof readiness guard, restore drill readiness guard, RPC SQL safety guard, Android install preflight guard, build status command and regression test, workflow atomicity readiness guard, workflow smoke readiness guard, and trust-language guard slice has focused VM proof only so far: API typecheck passed, focused terminal adapter tests passed 3/3, and the full API suite passed 62/62. The 131-file staged package passed locally, but VM identity guard, VM staged-package guard, root `pnpm verify`, and root `pnpm run build` are pending because SSH escalation was blocked by account usage limits.

## Current Blocker

The installed Android app previously could log in, and `GET /jobs` plus `GET /notifications` worked, but real-device `POST /jobs` returned `400`.

The backend create-job payload fix is deployed. API diagnostics remain in place, including request IDs, safe validation logs, and safe insert-failure logs. The next real-device create-request attempt should prove the fix or produce enough evidence to identify whether any remaining problem is payload shape, validation, schema mismatch, RLS, insert data, app configuration, or network reachability.

The blocker is now real-device evidence capture, not lack of backend instrumentation or known payload fix.

The immediate iOS installed-build dependency is Apple signing/provisioning, not compilation. Local iOS Release compile succeeds with signing disabled and validates `com.nursebridges.mobile`; signed iPhone builds use team `HKQJ75SQVF` and require a matching development provisioning profile.

## What Is Already Hardened

- Patient create-job route has regression coverage for role checks, mobile payload validation, normalized inserts, and request IDs on insert failure.
- Nurse apply and withdraw flows have direct route/core tests.
- Admin assignment, cancellation/completion, and nurse verification decisions have direct regression coverage.
- Admin and mobile consume `@nursebridge/shared/workflow` for canonical pure job/application workflow predicates.
- API pure workflow predicates consume `@nursebridge/shared/workflow` through the VM-reconciled `services/api/src/jobWorkflow.ts` adapter.
- `@nursebridge/shared` emits production-safe ESM output under `dist/`; API/admin lifecycle command orchestration and assignment atomicity still need consolidation.
- API/admin assignment flows now claim the open job before mutating application statuses, and regression tests prove stale job assignment failures do not accept/reject applications or send notifications/audit rows. This reduces stale-job partial-write risk but does not replace the planned database transaction/RPC gate.
- API/admin terminal cancel/complete flows now classify stale guarded status writes as shared `conflict` failures and return/throw 409 before notifications or audit rows are written. This reduces ambiguous terminal-action failures but does not replace the planned transaction/RPC gate because cancel still rejects applied applications before the final job status claim.
- `@nursebridge/shared/workflow` owns assignment application planning, rejection-recipient planning, and assignment notification payload construction for API/admin assignment paths.
- `@nursebridge/shared/workflow` owns assignment command side-effect planning for API/admin assignment paths, including selected-application validation, competing rejection recipients, assignment notifications, and admin assignment audit intent.
- A review-only assignment RPC design package now exists at `docs/architecture/sql/assignment-finalize-rpc.draft.sql` and `docs/ops/assignment-rpc-rollout-plan.md`. It defines the database-atomic target for assignment but has not been applied to Supabase.
- `services/api/src/jobAssignmentCommand.ts` now has a review-only RPC finalizer contract for the planned `finalize_applied_assignment_rpc` boundary, with error mapping tests in `services/api/test/jobAssignment.test.ts`. Existing assignment routes still use the guarded multi-write finalizer until the database function and route integration are explicitly approved.
- API admin assignment and patient application acceptance now use an injectable assignment finalizer seam and pass actor context through it. This keeps current behavior stable while preparing the route boundary for the future RPC-backed finalizer.
- `scripts/ops/check-assignment-rpc-contract.mjs` provides the read-only Supabase metadata check for assignment RPC table/column prerequisites and the stricter post-apply RPC exposure gate.
- A review-only terminal job RPC design package now exists at `docs/architecture/sql/terminal-job-finalize-rpc.draft.sql` and `docs/ops/terminal-job-rpc-rollout-plan.md`. It defines the database-atomic target for cancel/complete but has not been applied to Supabase.
- `scripts/ops/check-terminal-job-rpc-contract.mjs` provides the read-only Supabase metadata check for terminal job RPC table/column prerequisites and the stricter post-apply RPC exposure gate.
- `services/api/src/jobTerminalCommand.ts` now has a review-only RPC finalizer contract for the planned `finalize_terminal_job_rpc` boundary, with error mapping tests in `services/api/test/jobTerminalCommand.test.ts`. Existing terminal routes still use the guarded multi-write finalizer until the database function and route integration are explicitly approved.
- Mobile home now shows a role-specific workflow snapshot for status, next step, and records. Patient and nurse snapshot copy is backed by mobile workflow helper tests so the first screen aligns with the experience spec's status/next-action/record model.
- Patient mobile now shows a tested current-request detail panel for the focus request, including lifecycle status, assigned caregiver, related updates, timeline state, and only eligible cancel/complete actions.
- Patient mobile now has a first role-specific tab structure that separates Home, New Request, Records, and Updates. This starts the move away from one mixed dashboard while preserving the existing nurse/admin layout until their own workflow passes.
- Nurse mobile now has a first role-specific tab structure that separates Home, Open Requests, My Work, Verification, and Updates. Approved open-request application work, assigned/applied work, document upload, and notifications no longer all render as one mixed nurse dashboard.
- Nurse selected-request detail now uses a tested model that keeps application state, assignment ownership, apply eligibility, complete eligibility, and safe request fields together before rendering the selected request panel.
- Patient and nurse mobile now include an Account tab with beta access context, support/safety language, role/API details, nurse verification status when relevant, and sign-out.
- Patient and nurse workflow screens no longer show the signed-in account panel above every tab; Account owns those details. Admin mobile still shows the signed-in panel because admin mobile remains a handoff to the protected web console.
- Patient Home now includes a support/safety panel so the non-emergency boundary and beta support path are visible in the main patient status surface.
- Patient create-request now captures contact context and mobility/support notes and folds them into the existing API description payload as labeled sections without sending unsupported backend columns.
- Patient and nurse request detail screens now share one mobile workflow detail shell for status, summary, safe fields, timeline, actions, and final-record language.
- Patient records, nurse open requests, and nurse work now share one mobile request-summary card pattern, with tested workflow helpers owning cancel/complete confirmation copy.
- `@nursebridge/shared/workflow` owns terminal job notification payload construction for API/admin cancel/complete paths.
- `@nursebridge/shared/workflow` owns terminal cancel/complete eligibility classification for API/admin terminal paths.
- `@nursebridge/shared/workflow` owns terminal command side-effect planning for API/admin terminal paths, including next status, rejection intent, notification recipients, and admin audit intent.
- API admin assignment and patient application acceptance share `services/api/src/jobAssignmentCommand.ts` for the final assignment mutation and notification sequence.
- Patient application accept/reject decisions write a structured audit row after the guarded decision succeeds.
- Guarded lifecycle writes protect invalid job transitions.
- Notifications and audit records are asserted in the trust-sensitive admin paths.
- Smoke workflow script exists, but production smoke is intentionally guarded behind explicit approval.
- Create-job log watcher exists and can filter by time window and request ID.
- Closed-beta runbook and evidence log exist.

## Guarded Package Synced To VM

These files were prepared locally under `vm-stage`, synced to `/home/nurseapp/nursebridge`, and verified on the VM:

- `scripts/ops/verify-nursebridges-identity.mjs`
- `scripts/ops/verify-vm-stage-package.mjs`
- `scripts/ops/show-build-status.mjs`
- `scripts/ops/check-admin-api-boundary-readiness.mjs`
- `scripts/ops/check-api-log-hygiene.mjs`
- `scripts/ops/check-assignment-rpc-contract.mjs`
- `scripts/ops/check-canonical-assignment-readiness.mjs`
- `scripts/ops/check-terminal-job-rpc-contract.mjs`
- `scripts/ops/check-access-and-secrets-readiness.mjs`
- `scripts/ops/check-beta-gates.mjs`
- `scripts/ops/check-beta-ops-readiness.mjs`
- `scripts/ops/check-in-app-consent-readiness.mjs`
- `scripts/ops/check-release-doc-links.mjs`
- `scripts/ops/check-legal-consent-readiness.mjs`
- `scripts/ops/check-mobile-secret-hygiene.mjs`
- `scripts/ops/check-mobile-support-snapshot.mjs`
- `scripts/ops/check-nursebridge-isolation.mjs`
- `scripts/ops/check-notification-audit-privacy.mjs`
- `scripts/ops/check-private-document-path-hygiene.mjs`
- `scripts/ops/check-production-sequence-readiness.mjs`
- `scripts/ops/check-real-device-proof-readiness.mjs`
- `scripts/ops/check-restore-drill-readiness.mjs`
- `scripts/ops/check-rpc-sql-safety.mjs`
- `scripts/ops/check-trust-language.mjs`
- `scripts/ops/check-workflow-atomicity-readiness.mjs`
- `scripts/ops/check-workflow-smoke-readiness.mjs`
- `scripts/ops/smoke-beta-workflow.sh`
- `scripts/ops/test/check-admin-api-boundary-readiness.test.mjs`
- `scripts/ops/test/check-api-log-hygiene.test.mjs`
- `scripts/ops/test/check-assignment-rpc-contract.test.mjs`
- `scripts/ops/test/check-canonical-assignment-readiness.test.mjs`
- `scripts/ops/test/check-terminal-job-rpc-contract.test.mjs`
- `scripts/ops/test/check-access-and-secrets-readiness.test.mjs`
- `scripts/ops/test/check-beta-gates.test.mjs`
- `scripts/ops/test/check-beta-ops-readiness.test.mjs`
- `scripts/ops/test/check-in-app-consent-readiness.test.mjs`
- `scripts/ops/test/check-release-doc-links.test.mjs`
- `scripts/ops/test/check-legal-consent-readiness.test.mjs`
- `scripts/ops/test/check-mobile-secret-hygiene.test.mjs`
- `scripts/ops/test/check-mobile-support-snapshot.test.mjs`
- `scripts/ops/test/check-nursebridge-isolation.test.mjs`
- `scripts/ops/test/check-notification-audit-privacy.test.mjs`
- `scripts/ops/test/check-private-document-path-hygiene.test.mjs`
- `scripts/ops/test/check-production-sequence-readiness.test.mjs`
- `scripts/ops/test/check-real-device-proof-readiness.test.mjs`
- `scripts/ops/test/check-restore-drill-readiness.test.mjs`
- `scripts/ops/test/check-rpc-sql-safety.test.mjs`
- `scripts/ops/test/check-trust-language.test.mjs`
- `scripts/ops/test/check-workflow-atomicity-readiness.test.mjs`
- `scripts/ops/test/check-workflow-smoke-readiness.test.mjs`
- `scripts/ops/test/show-build-status.test.mjs`
- `scripts/ops/test/smoke-beta-workflow.test.mjs`
- `packages/shared/package.json`
- `packages/shared/tsconfig.json`
- `packages/shared/src/types.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/workflow.ts`
- `packages/shared/test/workflow.test.ts`
- `services/api/package.json`
- `services/api/src/audit.ts`
- `services/api/src/jobAssignmentCommand.ts`
- `services/api/src/jobTerminalCommand.ts`
- `services/api/src/jobStatusCore.ts`
- `services/api/src/jobWorkflow.ts`
- `services/api/src/routes/adminAssignmentRoute.ts`
- `services/api/src/routes/applications.ts`
- `services/api/src/routes/applicationDecisionRoute.ts`
- `services/api/src/routes/jobTerminalRoute.ts`
- `services/api/test/jobAssignment.test.ts`
- `services/api/test/adminAssignmentRoute.test.ts`
- `services/api/test/applicationDecisionRoute.test.ts`
- `services/api/test/jobStatusCore.test.ts`
- `services/api/test/jobTerminalCommand.test.ts`
- `services/api/test/jobTerminalRoute.test.ts`
- `apps/mobile/package.json`
- `apps/mobile/App.tsx`
- `apps/mobile/app.config.ts`
- `apps/mobile/assets/icon.png`
- `apps/mobile/assets/splash.png`
- `apps/mobile/scripts/verify-ios-release-readiness.mjs`
- `apps/mobile/scripts/verify-ios-install-preflight.mjs`
- `apps/mobile/scripts/verify-android-install-preflight.mjs`
- `apps/mobile/src/theme.ts`
- `apps/mobile/src/types.ts`
- `apps/mobile/src/screens/ApiTestScreen.tsx`
- `apps/mobile/src/screens/TokenScreen.tsx`
- `apps/mobile/src/workflow.ts`
- `apps/mobile/test/workflow.test.ts`
- `apps/admin/package.json`
- `apps/admin/lib/jobAssignmentActionsCore.ts`
- `apps/admin/lib/workflowRules.ts`
- `apps/admin/test/jobAssignmentActionsCore.test.ts`
- `apps/admin/test/workflowRules.test.ts`
- `docs/architecture/job-lifecycle.md`
- `docs/architecture/production-architecture.md`
- `docs/architecture/lead-engineering-blueprint.md`
- `docs/architecture/workflow-source-of-truth.md`
- `docs/architecture/sql/assignment-finalize-rpc.draft.sql`
- `docs/architecture/sql/terminal-job-finalize-rpc.draft.sql`
- `docs/architecture/data-contract.md`
- `docs/architecture/adrs/0001-product-architecture-decisions.md`
- `docs/legal/beta-legal-consent-checklist.md`
- `docs/ops/closed-beta-ops-playbook.md`
- `docs/ops/deployment-runbook.md`
- `docs/ops/observability.md`
- `docs/ops/supabase-data-contract-verification.md`
- `docs/ops/assignment-rpc-rollout-plan.md`
- `docs/ops/terminal-job-rpc-rollout-plan.md`
- `docs/ops/mobile-beta-build-readiness.md`
- `docs/product/experience-spec.md`
- `docs/product/ui-implementation-brief.md`
- `docs/release/start-here.md`
- `docs/release/ios-internal-build-readiness-review-2026-07-17.md`
- `docs/release/iphone-create-job-capture-packet.md`
- `docs/release/android-create-job-capture-packet.md`
- `docs/release/current-build-status.md`
- `docs/release/beta-readiness.md`
- `docs/release/beta-verification-matrix.md`
- `docs/release/beta-evidence-templates.md`
- `docs/release/closed-beta-go-no-go.md`
- `docs/release/beta-evidence-log.md`
- `docs/release/closed-beta-operator-runbook.md`
- `docs/release/mobile-build.md`
- `docs/release/vm-sync-handoff.md`
- `docs/release/engineering-state-snapshot.md`
- `docs/release/pending-vm-verification.md`
- `docs/release/production-build-plan.md`
- `docs/release/implementation-backlog.md`

The synced files reconcile the current admin test coverage, carry the NurseBridges identity guard and staged-package guard, sync the plural NurseBridges mobile config/assets/scripts, add mobile workflow predicate parity, sync admin workflow-rule parity, and remove stale wording that implied those flows were still mostly unprotected.

Do not sync local `vm-stage/services/api` over the VM API directory. The local API folder is partial and exists as reference material only; the VM holds the full API state. API work should reconcile from the VM copy first. The only API files in this guarded package are the VM-reconciled workflow, assignment command, application-decision, and audit files listed above.

## Do Not Do

- Do not run Twin.
- Do not run EAS or create app-store builds without explicit approval.
- Do not run production smoke tests or create live production jobs without explicit approval.
- Do not touch Cloudflare, Supabase schema, secrets, or runtime env files without a separate scoped approval.
- Do not claim HIPAA, insurance, background-check, or license-verification readiness until those processes are real and reviewed.
- Do not work around the VM usage limit.

## Repeatable Sync Command

Use this only when the local guarded package changes again:

```sh
scp 'vm-stage/package.json' nursebridge-vm:/home/nurseapp/nursebridge/package.json
scp 'vm-stage/pnpm-lock.yaml' nursebridge-vm:/home/nurseapp/nursebridge/pnpm-lock.yaml
scp 'vm-stage/pnpm-workspace.yaml' nursebridge-vm:/home/nurseapp/nursebridge/pnpm-workspace.yaml
ssh nursebridge-vm 'mkdir -p /home/nurseapp/nursebridge/scripts/ops'
ssh nursebridge-vm 'mkdir -p /home/nurseapp/nursebridge/scripts/ops/test'
ssh nursebridge-vm 'mkdir -p /home/nurseapp/nursebridge/packages/shared/src /home/nurseapp/nursebridge/packages/shared/test'
scp 'vm-stage/scripts/ops/verify-nursebridges-identity.mjs' nursebridge-vm:/home/nurseapp/nursebridge/scripts/ops/verify-nursebridges-identity.mjs
scp 'vm-stage/scripts/ops/verify-vm-stage-package.mjs' nursebridge-vm:/home/nurseapp/nursebridge/scripts/ops/verify-vm-stage-package.mjs
scp 'vm-stage/scripts/ops/show-build-status.mjs' nursebridge-vm:/home/nurseapp/nursebridge/scripts/ops/show-build-status.mjs
scp 'vm-stage/scripts/ops/smoke-beta-workflow.sh' nursebridge-vm:/home/nurseapp/nursebridge/scripts/ops/smoke-beta-workflow.sh
scp 'vm-stage/scripts/ops/test/smoke-beta-workflow.test.mjs' nursebridge-vm:/home/nurseapp/nursebridge/scripts/ops/test/smoke-beta-workflow.test.mjs
scp 'vm-stage/packages/shared/package.json' nursebridge-vm:/home/nurseapp/nursebridge/packages/shared/package.json
scp 'vm-stage/packages/shared/tsconfig.json' nursebridge-vm:/home/nurseapp/nursebridge/packages/shared/tsconfig.json
scp 'vm-stage/packages/shared/src/types.ts' nursebridge-vm:/home/nurseapp/nursebridge/packages/shared/src/types.ts
scp 'vm-stage/packages/shared/src/index.ts' nursebridge-vm:/home/nurseapp/nursebridge/packages/shared/src/index.ts
scp 'vm-stage/packages/shared/src/workflow.ts' nursebridge-vm:/home/nurseapp/nursebridge/packages/shared/src/workflow.ts
scp 'vm-stage/packages/shared/test/workflow.test.ts' nursebridge-vm:/home/nurseapp/nursebridge/packages/shared/test/workflow.test.ts
scp 'vm-stage/apps/mobile/package.json' nursebridge-vm:/home/nurseapp/nursebridge/apps/mobile/package.json
scp 'vm-stage/apps/mobile/app.config.ts' nursebridge-vm:/home/nurseapp/nursebridge/apps/mobile/app.config.ts
scp 'vm-stage/apps/mobile/assets/icon.png' nursebridge-vm:/home/nurseapp/nursebridge/apps/mobile/assets/icon.png
scp 'vm-stage/apps/mobile/assets/splash.png' nursebridge-vm:/home/nurseapp/nursebridge/apps/mobile/assets/splash.png
scp 'vm-stage/apps/mobile/scripts/verify-ios-release-readiness.mjs' nursebridge-vm:/home/nurseapp/nursebridge/apps/mobile/scripts/verify-ios-release-readiness.mjs
scp 'vm-stage/apps/mobile/scripts/verify-ios-install-preflight.mjs' nursebridge-vm:/home/nurseapp/nursebridge/apps/mobile/scripts/verify-ios-install-preflight.mjs
scp 'vm-stage/apps/mobile/scripts/verify-android-install-preflight.mjs' nursebridge-vm:/home/nurseapp/nursebridge/apps/mobile/scripts/verify-android-install-preflight.mjs
scp 'vm-stage/apps/mobile/src/types.ts' nursebridge-vm:/home/nurseapp/nursebridge/apps/mobile/src/types.ts
scp 'vm-stage/apps/mobile/src/workflow.ts' nursebridge-vm:/home/nurseapp/nursebridge/apps/mobile/src/workflow.ts
scp 'vm-stage/apps/mobile/test/workflow.test.ts' nursebridge-vm:/home/nurseapp/nursebridge/apps/mobile/test/workflow.test.ts
scp 'vm-stage/apps/admin/package.json' nursebridge-vm:/home/nurseapp/nursebridge/apps/admin/package.json
scp 'vm-stage/apps/admin/lib/jobAssignmentActionsCore.ts' nursebridge-vm:/home/nurseapp/nursebridge/apps/admin/lib/jobAssignmentActionsCore.ts
scp 'vm-stage/apps/admin/lib/workflowRules.ts' nursebridge-vm:/home/nurseapp/nursebridge/apps/admin/lib/workflowRules.ts
scp 'vm-stage/apps/admin/test/jobAssignmentActionsCore.test.ts' nursebridge-vm:/home/nurseapp/nursebridge/apps/admin/test/jobAssignmentActionsCore.test.ts
scp 'vm-stage/apps/admin/test/workflowRules.test.ts' nursebridge-vm:/home/nurseapp/nursebridge/apps/admin/test/workflowRules.test.ts
API reconciliation must use the guarded file manifest above and the local staged-package guard. Do not add inline partial API directory sync commands here.
scp 'vm-stage/docs/architecture/job-lifecycle.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/architecture/job-lifecycle.md
scp 'vm-stage/docs/architecture/production-architecture.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/architecture/production-architecture.md
scp 'vm-stage/docs/architecture/workflow-source-of-truth.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/architecture/workflow-source-of-truth.md
scp 'vm-stage/docs/architecture/data-contract.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/architecture/data-contract.md
scp 'vm-stage/docs/architecture/adrs/0001-product-architecture-decisions.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/architecture/adrs/0001-product-architecture-decisions.md
scp 'vm-stage/docs/legal/beta-legal-consent-checklist.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/legal/beta-legal-consent-checklist.md
scp 'vm-stage/docs/ops/closed-beta-ops-playbook.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/ops/closed-beta-ops-playbook.md
scp 'vm-stage/docs/ops/deployment-runbook.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/ops/deployment-runbook.md
scp 'vm-stage/docs/ops/supabase-data-contract-verification.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/ops/supabase-data-contract-verification.md
scp 'vm-stage/docs/ops/mobile-beta-build-readiness.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/ops/mobile-beta-build-readiness.md
scp 'vm-stage/docs/product/experience-spec.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/product/experience-spec.md
scp 'vm-stage/docs/product/ui-implementation-brief.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/product/ui-implementation-brief.md
scp 'vm-stage/docs/release/start-here.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/release/start-here.md
scp 'vm-stage/docs/release/ios-internal-build-readiness-review-2026-07-17.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/release/ios-internal-build-readiness-review-2026-07-17.md
scp 'vm-stage/docs/release/iphone-create-job-capture-packet.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/release/iphone-create-job-capture-packet.md
scp 'vm-stage/docs/release/android-create-job-capture-packet.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/release/android-create-job-capture-packet.md
scp 'vm-stage/docs/release/current-build-status.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/release/current-build-status.md
scp 'vm-stage/docs/release/beta-readiness.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/release/beta-readiness.md
scp 'vm-stage/docs/release/beta-verification-matrix.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/release/beta-verification-matrix.md
scp 'vm-stage/docs/release/beta-evidence-log.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/release/beta-evidence-log.md
scp 'vm-stage/docs/release/closed-beta-operator-runbook.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/release/closed-beta-operator-runbook.md
scp 'vm-stage/docs/release/mobile-build.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/release/mobile-build.md
scp 'vm-stage/docs/release/vm-sync-handoff.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/release/vm-sync-handoff.md
scp 'vm-stage/docs/release/engineering-state-snapshot.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/release/engineering-state-snapshot.md
scp 'vm-stage/docs/release/production-build-plan.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/release/production-build-plan.md
scp 'vm-stage/docs/release/implementation-backlog.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/release/implementation-backlog.md
```

Then verify on the VM:

```sh
cd /home/nurseapp/nursebridge
pnpm install --frozen-lockfile
node scripts/ops/verify-nursebridges-identity.mjs
node scripts/ops/verify-vm-stage-package.mjs
cd packages/shared && pnpm run typecheck && pnpm test && cd ../..
cd apps/mobile && pnpm run typecheck && pnpm test && cd ../..
cd apps/admin && pnpm run typecheck && pnpm test && cd ../..
rg "NurseBridge Start Here|Android Create-Job Capture Packet|Admin dispatcher|direct regression coverage|Production Build Plan|Active Risk Register|NurseBridge Experience Spec|NurseBridge UI Implementation Brief|NurseBridge Implementation Backlog|NurseBridge Beta Data Contract|Supabase Data Contract Verification|Mobile Beta Build Readiness|Workflow Source Of Truth Plan|Beta Legal And Consent Checklist|Closed Beta Operations Playbook|NurseBridge Deployment Runbook|Beta Verification Matrix|ADR 0001|Next.js admin routes now|duplicated lifecycle/dispatcher" docs
rm -f apps/admin/tsconfig.tsbuildinfo
git status --short
```

Docs, mobile config/assets, mobile helper/test, admin workflow-rule test slice, and ops-guard sync does not require a service restart. A rebuilt/signed installed app or recovered Android path is still required before the next real-device create-job proof.

## Next Product Unlock

1. Stop retrying the Expo Go/LAN path.
2. Review `docs/ops/mobile-beta-build-readiness.md` for an approval-gated internal iOS/TestFlight proof, or recover Android access.
3. Do not run EAS, TestFlight, app-store-connected steps, or credential changes without explicit owner approval.
4. After an installed build or Android device is available, trigger one patient create-request attempt.
5. If it fails, tap `Copy issue details`.
6. Capture the `Reference: mobile-...` value.
7. Inspect the create-job logs:

```sh
cd /home/nurseapp/nursebridge
scripts/ops/watch-create-job-logs.sh "30 minutes ago" "mobile-request-id"
```

8. Patch the exact issue shown in the logs, if a failure remains.
9. Run targeted tests if code changed.
10. Run full `pnpm verify`.
11. With explicit approval, run the guarded closed-beta smoke workflow.

## Architectural Direction

Keep the web admin console. Do not force dispatcher operations into Xcode. A serious product should have:

- Native/mobile-first care workflows for patients and nurses.
- Web admin operations for speed, visibility, audit, and support.
- Shared API/domain logic so both clients behave consistently.

The mobile UI should become serious, calm, role-based, and operationally clear. It should feel like a care coordination tool, not a demo app. The admin should feel like a dispatcher console, not a marketing dashboard.

## Production Roadmap

1. Prove real-device create-job after the deployed backend fix.
2. Prove patient -> nurse -> admin -> complete/cancel on real devices.
3. Tighten mobile UX around role-specific tasks and error recovery.
4. Tighten admin UX around queues, assignment, verification, and audit.
5. Consolidate duplicated lifecycle/dispatcher behavior into shared tested core paths.
6. Complete closed-beta evidence log.
7. Finalize privacy, terms, verification consent, support workflow, and data handling expectations.
8. Prepare controlled beta distribution.
9. Add monitoring ownership, backup restore drill, and incident response procedure.
10. Only after closed-beta proof, consider payments, partner dashboards, richer messaging, and broader marketplace mechanics.

See `docs/release/start-here.md` for the recommended reading order and first actions.
See `docs/release/iphone-create-job-capture-packet.md` only for historical context and the installed-build tester script.
See `docs/release/android-create-job-capture-packet.md` for the Android recheck script.
See `docs/release/production-build-plan.md` for the phase-by-phase execution plan and active risk register.
See `docs/release/implementation-backlog.md` for the ordered engineering work packages.
See `docs/release/beta-verification-matrix.md` for the evidence required before each beta gate advances.
See `docs/architecture/adrs/0001-product-architecture-decisions.md` for accepted architecture decisions and revisit triggers.
See `docs/architecture/workflow-source-of-truth.md` for lifecycle/assignment source-of-truth consolidation.
See `docs/legal/beta-legal-consent-checklist.md` for privacy, terms, consent, retention, support, and copy-review gates.
See `docs/ops/closed-beta-ops-playbook.md` for beta monitoring, support, severity, and stop-condition rules.
See `docs/ops/deployment-runbook.md` for VM/systemd deploy, restart, health-check, and rollback discipline.
See `docs/ops/supabase-data-contract-verification.md` for inspection-only Supabase schema, RLS, storage, and data-contract verification.
See `docs/ops/mobile-beta-build-readiness.md` for approval-gated Android/iOS beta build readiness.
See `docs/product/ui-implementation-brief.md` for mobile/admin UI build slices and QA rules.
