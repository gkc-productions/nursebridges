# VM Sync Handoff

This handoff records the guarded package synced to `/home/nurseapp/nursebridge` and keeps the repeatable sync manifest for future reconciliation.

## Current Access State

Guarded VM sync completed on 2026-07-18 from local `vm-stage` to `/home/nurseapp/nursebridge`.

Verified on the VM:

- `node scripts/ops/verify-nursebridges-identity.mjs` passed across 95 files.
- `node scripts/ops/verify-vm-stage-package.mjs` passed for 79 staged files.
- Mobile typecheck passed.
- Mobile tests passed: 23/23.
- Admin typecheck passed.
- Admin tests passed: 16/16.
- Shared package typecheck passed.
- Shared package tests passed: 13/13.
- Smoke workflow script tests passed: 2/2.
- Root production build passed.

No service restart was performed.

## Guarded Files Synced

These files were copied from local `vm-stage` into the same paths on the VM:

```text
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
scripts/ops/verify-nursebridges-identity.mjs
scripts/ops/verify-vm-stage-package.mjs
scripts/ops/check-assignment-rpc-contract.mjs
scripts/ops/check-terminal-job-rpc-contract.mjs
scripts/ops/smoke-beta-workflow.sh
scripts/ops/test/check-assignment-rpc-contract.test.mjs
scripts/ops/test/check-terminal-job-rpc-contract.test.mjs
scripts/ops/test/smoke-beta-workflow.test.mjs
packages/shared/package.json
packages/shared/tsconfig.json
packages/shared/src/types.ts
packages/shared/src/index.ts
packages/shared/src/workflow.ts
packages/shared/test/workflow.test.ts
services/api/package.json
services/api/src/audit.ts
services/api/src/jobAssignmentCommand.ts
services/api/src/jobTerminalCommand.ts
services/api/src/jobStatusCore.ts
services/api/src/jobWorkflow.ts
services/api/src/routes/adminAssignmentRoute.ts
services/api/src/routes/applications.ts
services/api/src/routes/applicationDecisionRoute.ts
services/api/src/routes/jobTerminalRoute.ts
services/api/test/jobAssignment.test.ts
services/api/test/adminAssignmentRoute.test.ts
services/api/test/applicationDecisionRoute.test.ts
services/api/test/jobStatusCore.test.ts
services/api/test/jobTerminalCommand.test.ts
services/api/test/jobTerminalRoute.test.ts
apps/mobile/package.json
apps/mobile/App.tsx
apps/mobile/app.config.ts
apps/mobile/assets/icon.png
apps/mobile/assets/splash.png
apps/mobile/scripts/verify-ios-release-readiness.mjs
apps/mobile/scripts/verify-ios-install-preflight.mjs
apps/mobile/src/theme.ts
apps/mobile/src/workflow.ts
apps/mobile/test/workflow.test.ts
apps/admin/package.json
apps/admin/lib/jobAssignmentActionsCore.ts
apps/admin/lib/workflowRules.ts
apps/admin/test/jobAssignmentActionsCore.test.ts
apps/admin/test/workflowRules.test.ts
docs/architecture/job-lifecycle.md
docs/architecture/production-architecture.md
docs/architecture/lead-engineering-blueprint.md
docs/architecture/workflow-source-of-truth.md
docs/architecture/sql/assignment-finalize-rpc.draft.sql
docs/architecture/sql/terminal-job-finalize-rpc.draft.sql
docs/architecture/data-contract.md
docs/architecture/adrs/0001-product-architecture-decisions.md
docs/legal/beta-legal-consent-checklist.md
docs/ops/closed-beta-ops-playbook.md
docs/ops/deployment-runbook.md
docs/ops/supabase-data-contract-verification.md
docs/ops/assignment-rpc-rollout-plan.md
docs/ops/terminal-job-rpc-rollout-plan.md
docs/ops/mobile-beta-build-readiness.md
docs/product/experience-spec.md
docs/product/ui-implementation-brief.md
docs/release/start-here.md
docs/release/ios-internal-build-readiness-review-2026-07-17.md
docs/release/iphone-create-job-capture-packet.md
docs/release/android-create-job-capture-packet.md
docs/release/current-build-status.md
docs/release/beta-readiness.md
docs/release/beta-verification-matrix.md
docs/release/beta-evidence-log.md
docs/release/closed-beta-operator-runbook.md
docs/release/mobile-build.md
docs/release/vm-sync-handoff.md
docs/release/engineering-state-snapshot.md
docs/release/production-build-plan.md
docs/release/implementation-backlog.md
```

These staged files reflect the latest verified engineering state:

- API tests: 54 passing.
- Shared package tests: 13 passing.
- Mobile tests: 23 passing.
- Admin tests: 16 passing.
- Admin production build passes.
- Admin dispatcher assignment, cancel/complete, and nurse verification actions have direct regression coverage.
- Admin workflows now have matching guardrails, notifications, and audit assertions.
- Admin and mobile consume `@nursebridge/shared/workflow` for canonical pure job/application workflow predicates.
- API pure workflow predicates consume `@nursebridge/shared/workflow` through `services/api/src/jobWorkflow.ts`.
- `@nursebridge/shared` emits compiled ESM output under `dist/`, and shared tests verify compiled `dist/workflow.js`.
- API/admin assignment flows now claim the open job before mutating application statuses, and stale job assignment failures no longer accept/reject applications or send notifications/audit rows. Full transaction/RPC work remains open.
- API/admin terminal cancel/complete flows now classify stale guarded status writes as shared `conflict` failures and return/throw 409 before notifications or audit rows are written. Full transaction/RPC work remains open because cancel still rejects applied applications before the final job status claim.
- Shared assignment planning and notification payload construction now live in `@nursebridge/shared/workflow` and are consumed by API/admin assignment paths.
- Shared assignment command side-effect planning now lives in `@nursebridge/shared/workflow` and is consumed by API/admin assignment paths.
- Review-only assignment RPC design now lives at `docs/architecture/sql/assignment-finalize-rpc.draft.sql`, with the approval-gated rollout path in `docs/ops/assignment-rpc-rollout-plan.md`. This has not been applied to Supabase.
- API RPC finalizer preparation now lives in `services/api/src/jobAssignmentCommand.ts`, with RPC contract/error-mapping coverage in `services/api/test/jobAssignment.test.ts`. Current assignment routes still use the guarded multi-write path until the Supabase function and integration are explicitly approved.
- API admin assignment and patient application acceptance now use an injectable assignment finalizer seam and pass actor context through it. Route tests prove the seam without changing the default multi-write behavior.
- `scripts/ops/check-assignment-rpc-contract.mjs` provides a read-only Supabase metadata check for assignment RPC prerequisites and a strict `--expect-rpc` gate after the function is approved/applied.
- The assignment RPC contract checker has mock OpenAPI regression coverage under `scripts/ops/test/check-assignment-rpc-contract.test.mjs` so root tests prove prerequisite mode, strict mode, and missing-column failures without live secrets.
- Review-only terminal job RPC design now lives at `docs/architecture/sql/terminal-job-finalize-rpc.draft.sql`, with the approval-gated rollout path in `docs/ops/terminal-job-rpc-rollout-plan.md`. This has not been applied to Supabase.
- API terminal RPC finalizer preparation now lives in `services/api/src/jobTerminalCommand.ts`, with RPC contract/error-mapping coverage in `services/api/test/jobTerminalCommand.test.ts`. Current terminal routes still use the guarded multi-write path until the Supabase function and runtime integration are explicitly approved.
- `scripts/ops/check-terminal-job-rpc-contract.mjs` provides a read-only Supabase metadata check for terminal cancel/complete RPC prerequisites and a strict `--expect-rpc` gate after the function is approved/applied.
- The terminal job RPC contract checker has mock OpenAPI regression coverage under `scripts/ops/test/check-terminal-job-rpc-contract.test.mjs` so root tests prove prerequisite mode, strict mode, and missing-column failures without live secrets.
- Shared terminal notification payload construction now lives in `@nursebridge/shared/workflow` and is consumed by API/admin cancel/complete terminal paths.
- Shared terminal eligibility classification now lives in `@nursebridge/shared/workflow` and is consumed by API/admin cancel/complete terminal paths.
- Shared terminal command side-effect planning now lives in `@nursebridge/shared/workflow` and is consumed by API/admin cancel/complete terminal paths.
- Patient application accept/reject decisions write a structured audit row after the guarded decision succeeds, and the mounted applications route passes the production audit writer into the decision route.
- API admin assignment and patient application acceptance now share `services/api/src/jobAssignmentCommand.ts` for the final assignment sequence: read rejection recipients, claim the open job, accept the selected application, reject competing applied applications, and notify affected nurses.
- Closed beta is still blocked by installed-device create-job proof. iOS compilation succeeds with signing disabled, but signed iPhone install still needs Apple account/provisioning for `com.nursebridges.mobile`; Android access can also unlock the proof path.
- Mobile home now includes a tested role-specific workflow snapshot for status, next step, and records before generic metrics. This is a focused seriousness/pass-one UX improvement, not the full mobile redesign.
- Patient mobile now renders a tested current-request detail panel with status, timeline, assigned caregiver, related updates, and lifecycle-gated cancel/complete actions.
- Patient mobile now has a first role-specific tab structure: Home, New Request, Records, and Updates. This separates the create form, request history, and notifications instead of mixing every patient workflow on one long screen.
- Nurse mobile now has a first role-specific tab structure: Home, Open Requests, My Work, Verification, and Updates. This separates available work, assigned/applied work, document upload, and notifications instead of mixing every nurse workflow on one long screen.
- Nurse selected-request detail now uses a tested workflow model for application state, apply eligibility, complete eligibility, assignment ownership, and safe request details.
- Patient and nurse mobile now include an Account tab with beta access context, support/safety language, role/API details, nurse verification status when relevant, and sign-out.
- Patient and nurse identity/sign-out details now live in Account instead of above every workflow screen. Admin mobile keeps the signed-in panel because admin operations remain web-console centered.
- Patient Home now includes a support/safety panel that keeps the non-emergency boundary and beta support path visible beside current request status.
- Patient create-request now captures contact context and mobility/support notes, folding them into the existing API description payload as labeled sections without sending unsupported backend columns.
- Patient and nurse request detail screens now share one mobile workflow detail shell for status, summary, safe fields, timeline, actions, and final-record language.
- Patient records, nurse open requests, and nurse work now share one mobile request-summary card pattern, with cancel/complete confirmation copy coming from tested workflow helpers.
- Lead engineering blueprint now records the explicit product surface strategy: mobile for patients/nurses, web for admin, API as workflow backbone, Supabase/VM retained for closed beta, and native Swift/Xcode deferred until a real platform need is proven.

## API Snapshot Warning

Do not copy local `vm-stage/services/api` over the VM API directory as part of this handoff. The local `services/api` folder is a partial reference snapshot and does not contain the full route/test set required by the VM's last verified API state. API reconciliation must start by reading the VM copy, then selectively applying intended API patches only. The only API files in this guarded package are the VM-reconciled workflow, assignment command, application-decision, and audit files listed above.

## Sync Commands

Repeatable commands from the local workspace:

```sh
scp 'vm-stage/package.json' nursebridge-vm:/home/nurseapp/nursebridge/package.json
scp 'vm-stage/pnpm-lock.yaml' nursebridge-vm:/home/nurseapp/nursebridge/pnpm-lock.yaml
scp 'vm-stage/pnpm-workspace.yaml' nursebridge-vm:/home/nurseapp/nursebridge/pnpm-workspace.yaml
ssh nursebridge-vm 'mkdir -p /home/nurseapp/nursebridge/docs/product /home/nurseapp/nursebridge/docs/architecture/adrs /home/nurseapp/nursebridge/docs/architecture/sql /home/nurseapp/nursebridge/docs/legal'
ssh nursebridge-vm 'mkdir -p /home/nurseapp/nursebridge/scripts/ops'
ssh nursebridge-vm 'mkdir -p /home/nurseapp/nursebridge/scripts/ops/test'
ssh nursebridge-vm 'mkdir -p /home/nurseapp/nursebridge/packages/shared/src /home/nurseapp/nursebridge/packages/shared/test'
scp 'vm-stage/scripts/ops/verify-nursebridges-identity.mjs' nursebridge-vm:/home/nurseapp/nursebridge/scripts/ops/verify-nursebridges-identity.mjs
scp 'vm-stage/scripts/ops/verify-vm-stage-package.mjs' nursebridge-vm:/home/nurseapp/nursebridge/scripts/ops/verify-vm-stage-package.mjs
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
scp 'vm-stage/docs/architecture/sql/assignment-finalize-rpc.draft.sql' nursebridge-vm:/home/nurseapp/nursebridge/docs/architecture/sql/assignment-finalize-rpc.draft.sql
scp 'vm-stage/docs/architecture/data-contract.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/architecture/data-contract.md
scp 'vm-stage/docs/architecture/adrs/0001-product-architecture-decisions.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/architecture/adrs/0001-product-architecture-decisions.md
scp 'vm-stage/docs/legal/beta-legal-consent-checklist.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/legal/beta-legal-consent-checklist.md
scp 'vm-stage/docs/ops/closed-beta-ops-playbook.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/ops/closed-beta-ops-playbook.md
scp 'vm-stage/docs/ops/deployment-runbook.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/ops/deployment-runbook.md
scp 'vm-stage/docs/ops/supabase-data-contract-verification.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/ops/supabase-data-contract-verification.md
scp 'vm-stage/docs/ops/assignment-rpc-rollout-plan.md' nursebridge-vm:/home/nurseapp/nursebridge/docs/ops/assignment-rpc-rollout-plan.md
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

Then verify references on the VM:

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

No service restart is required for these docs, mobile config/assets, mobile helper/test, admin workflow-rule test slice, and ops-guard changes. The next installed mobile proof still needs a rebuilt/signed app or recovered Android path.

## Next Production Unlock

After the guarded sync, return to the active blocker:

1. Trigger one Android patient create-job attempt.
2. Tap `Copy issue details` if it fails.
3. Paste the copied `Reference: mobile-...` text into the engineering thread.
4. Use:

```sh
cd /home/nurseapp/nursebridge
scripts/ops/watch-create-job-logs.sh "30 minutes ago" "mobile-example-request-id"
```

5. Patch the exact validation, schema, RLS, or insert issue shown in the logs.
