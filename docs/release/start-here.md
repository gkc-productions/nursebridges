# NurseBridge Start Here

This is the navigation index for the current NurseBridge production-track planning pack. Use it when resuming engineering leadership work.

## Current Truth

- Run `pnpm status` for the quick local build status summary before reading the longer packet.
- The actual repo lives on `nursebridge-vm` at `/home/nurseapp/nursebridge`.
- This local `vm-stage` folder is the guarded local staging copy used for scoped VM sync and verification.
- Closed beta is still blocked by missing real-device proof of patient create-request and the full patient -> nurse -> admin workflow.
- The backend create-job payload fix is deployed and verified; the next unlock is one fresh real-device patient create-request attempt.
- The Expo Go/LAN iPhone path was attempted and abandoned. The next device path is a signed installed iOS build/TestFlight path or recovered Android access.
- Canonical mobile build identity is `nursebridges` with the `s`: iOS bundle id and Android package `com.nursebridges.mobile`.
- Local iOS Release compile succeeds with signing disabled and validates `com.nursebridges.mobile`.
- Signed iPhone install requires the authenticated Apple Developer Program team `HKQJ75SQVF` and a development profile for `com.nursebridges.mobile`.
- Do not touch Pathfinder.
- Do not run Twin.
- Do not run EAS, production smoke, Cloudflare changes, Supabase schema/env/secrets changes, or live production job creation without explicit approval.

## Read In This Order

1. `docs/release/engineering-state-snapshot.md`
   - Current state, last verified VM status, blocker, and staged changes.
2. `docs/release/vm-sync-handoff.md`
   - Exact commands to sync local staged docs back to the VM.
3. `docs/release/production-build-plan.md`
   - Phase-by-phase path from current build to controlled beta.
4. `docs/architecture/lead-engineering-blueprint.md`
   - Lead-engineering surface strategy, build tracks, and decision triggers for the serious production product.
5. `docs/release/ios-internal-build-readiness-review-2026-07-17.md`
   - Current iOS build configuration review after retiring Expo Go/LAN proof.
6. `docs/release/implementation-backlog.md`
   - Ordered engineering work packages.
7. `docs/release/beta-verification-matrix.md`
   - Evidence required before beta gates move forward.
8. `docs/release/closed-beta-operator-runbook.md`
   - Operating sequence for create-job debug and workflow proof.

## Architecture And Product

- `docs/architecture/production-architecture.md`
  - High-level product and system architecture.
- `docs/architecture/lead-engineering-blueprint.md`
  - What to build high-level, why mobile stays Expo/React Native for now, why admin stays web, and how to sequence production-track work.
- `docs/architecture/adrs/0001-product-architecture-decisions.md`
  - Accepted closed-beta decisions and revisit triggers.
- `docs/architecture/job-lifecycle.md`
  - Job/application lifecycle contract.
- `docs/architecture/workflow-source-of-truth.md`
  - Consolidation plan for lifecycle, assignment, notifications, audit, and API/admin source-of-truth.
- `docs/architecture/data-contract.md`
  - Intended closed-beta data contract to verify against live Supabase.
- `docs/product/experience-spec.md`
  - Screen-level patient, nurse, and admin experience contract.
- `docs/product/ui-implementation-brief.md`
  - Build slices, shared components, UI state rules, and QA checklist.

## Operations And Release

- `docs/ops/observability.md`
  - Logs, request IDs, health checks, and create-job diagnostics.
- `docs/ops/deployment-runbook.md`
  - VM/systemd deploy, restart, health-check, rollback, and evidence rules.
- `docs/ops/supabase-data-contract-verification.md`
  - Inspection-only Supabase schema, RLS, storage, and data-contract verification.
- `docs/ops/mobile-beta-build-readiness.md`
  - Approval-gated checklist for Android/iOS beta builds, app identity, environment, signing, and EAS readiness.
- `docs/ops/closed-beta-ops-playbook.md`
  - Monitoring roles, severity levels, incident intake, support response, and stop conditions.
- `docs/release/beta-readiness.md`
  - Current readiness checklist.
- `docs/release/beta-evidence-log.md`
  - Evidence templates.
- `docs/legal/beta-legal-consent-checklist.md`
  - Legal/consent readiness checklist and copy guardrails.

## First Actions When VM Access Returns

1. Sync staged docs using `docs/release/vm-sync-handoff.md`.
2. Verify docs landed with the handoff `rg` command.
3. Resolve Apple signing/provisioning for `com.nursebridges.mobile`, or recover Android access.
4. If it fails, copy the issue details from the app.
5. Inspect create-job logs with the copied request reference or recent time window.
6. Patch the exact root cause if a failure appears.
7. Add/update regression coverage if code changed.
8. Run focused tests and `pnpm verify`.
9. Rebuild/restart only the affected service if code changed.
10. Record evidence.
11. Recheck Android before wider beta, or capture owner approval to defer Android.

## What Not To Do Next

- Do not start broad UI redesign before installed-device create-request proof exists.
- Do not migrate infrastructure while the core workflow is unproven.
- Do not broaden into payments, marketplace mechanics, chat, ratings, claims, insurance, or partner dashboards.
- Do not mark readiness items complete without evidence.
- Do not claim HIPAA, SOC 2, insurance, background-check, or license-verification readiness.

## Current Build Philosophy

NurseBridge should be built as a serious care-access coordination product:

```text
patient/family request
        -> verified nurse/caregiver interest
        -> admin/dispatcher assignment
        -> tracked care outcome
        -> notifications, records, and audit trail
```

Every release should make that trust loop more reliable, more understandable, or easier to operate.
