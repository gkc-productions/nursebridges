# Beta Evidence Log

Use this file to record evidence for closed-beta readiness. Do not mark `docs/release/beta-readiness.md` items complete unless there is evidence here or in another linked source.

Do not paste secrets, bearer tokens, cookies, passwords, service keys, private document paths, or raw medical details.

Use `docs/release/beta-verification-matrix.md` to decide which evidence template is required for each gate.
Use `docs/release/beta-evidence-templates.md` when copying a fresh evidence block into this log.

## Engineering Evidence

### Installed iPhone end-to-end workflow proof

```text
Date/time: 2026-08-03 03:45-11:08
Timezone: America/New_York
Runner/tester: Owner with Codex-guided verification
Device: Physical iPhone, installed signed development build
Signing team: HKQJ75SQVF
API: https://api.nursebridges.com (connected)
Patient request: Test care support request
Request ID: 2785c7b5-96b8-4900-b1a7-54747332cf70
Observed workflow:
- Patient signed in and created the non-sensitive test request successfully.
- Approved test nurse nurse@example.com viewed the request and applied.
- Admin web displayed the applicant and assigned the request.
- Nurse app displayed the assigned request and completed it.
- Patient app displayed the completed final record and completion notification.
- Nurse and patient in-app notification surfaces displayed the relevant workflow updates.
Result: PASS for create -> apply -> admin assign -> nurse complete on the original combined engineering build.
Not proven by this evidence: cancellation, verification-document upload, push delivery, Android, redesigned Patient build, separate Care build, or public early-access endpoint.
Privacy note: Test-only care details were used; no credentials, tokens, or secret values are recorded here.
```

### Existing TestFlight distribution-path proof

```text
Date/time: 2026-08-04
Timezone: America/New_York
Runner/tester: Owner
Result: Owner confirmed the existing iOS beta could be downloaded through TestFlight after stable Xcode first-launch setup.
Limitation: This confirms the Apple/TestFlight distribution path, not the newly redesigned Patient build. A fresh signed archive, upload, processing check, and install verification are still required.
```

### Quick build status command

```text
Date/time: 2026-07-30
Timezone: America/New_York
Runner: Codex
Scope: Project visibility after context resets
Change: Added a quick local `pnpm status` command that prints the current NurseBridge closed-beta decision, built surfaces, staged package count, device blockers, and next commands. Updated start-here/current-status/handoff docs so the command becomes the first status entrypoint instead of requiring a long document read after every reset.
Files: scripts/ops/show-build-status.mjs, scripts/ops/test/show-build-status.test.mjs, package.json, scripts/ops/verify-vm-stage-package.mjs, scripts/ops/check-beta-gates.mjs, scripts/ops/check-release-doc-links.mjs, docs/release/start-here.md, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/pending-vm-verification.md, docs/release/closed-beta-go-no-go.md, docs/release/beta-evidence-log.md
Verification:
- Local `pnpm status` command passed and printed the current beta decision, staged package count, built surfaces, phone blockers, and next commands.
- Local staged-package guard passed for 131 staged files.
- Local release doc link guard passed.
- Local beta gate guard passed.
Result: Local pass; VM root workspace verification/build pending.
Follow-up issue: Keep `pnpm status` focused on current proof blockers; do not let it become another long release doc.
```

### Android install preflight and iOS team alignment

```text
Date/time: 2026-07-30
Timezone: America/New_York
Runner: Codex
Scope: Real-device installed-build preflight readiness
Change: Added a read-only Android install preflight command and package script. The team selection recorded here was later superseded: the confirmed active NurseBridge Apple Developer Program team is `HKQJ75SQVF`.
Files: apps/mobile/scripts/verify-android-install-preflight.mjs, apps/mobile/package.json, apps/mobile/ios/NurseBridge.xcodeproj/project.pbxproj, scripts/ops/verify-vm-stage-package.mjs, scripts/ops/check-beta-gates.mjs, scripts/ops/check-release-doc-links.mjs, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/pending-vm-verification.md, docs/release/closed-beta-go-no-go.md, docs/release/beta-evidence-log.md
Verification:
- iOS install preflight passed source identity, Xcode build settings, physical iPhone visibility, and signing identity; failed only on missing provisioning profile for `com.nursebridges.mobile`.
- Android install preflight initially proved `adb` was missing. After installing Android platform-tools, the preflight passed source identity and `adb` availability, then failed because no authorized Android device was visible to `adb devices -l`.
- Local staged-package guard passed for 129 staged files.
- Local release doc link guard passed.
- Local beta gate guard passed.
- Local real-device proof readiness guard passed.
- Local ops guard tests passed with 21/21 suites.
Result: Local pass; real-device create-request proof still blocked by iOS provisioning profile or Android device authorization/visibility.
Follow-up issue: Install/download the iOS provisioning profile for `com.nursebridges.mobile` or make the Android phone visible to adb by enabling USB debugging, accepting the trust prompt, using a data-capable cable, and confirming `adb devices -l` shows an authorized device.
```

### RPC SQL safety guard

```text
Date/time: 2026-07-29
Timezone: America/New_York
Runner: Codex
Scope: Review-only assignment and terminal RPC SQL deployment posture
Change: Added a dependency-free guard that checks both RPC SQL drafts for SECURITY DEFINER plus explicit search_path, job-row locks, service-role-only execute grants, revokes from anon/authenticated, durable notification/audit writes, stable workflow exceptions, and care-request notification privacy. Added regression coverage so root tests catch unsafe SQL drift before any owner-approved Supabase apply.
Files: scripts/ops/check-rpc-sql-safety.mjs, scripts/ops/test/check-rpc-sql-safety.test.mjs, scripts/ops/verify-vm-stage-package.mjs, scripts/ops/check-beta-gates.mjs, scripts/ops/check-release-doc-links.mjs, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/pending-vm-verification.md, docs/release/closed-beta-go-no-go.md, docs/release/beta-evidence-log.md
Verification:
- Local RPC SQL safety guard passed.
- Local staged-package guard passed for 128 staged files.
- Local release doc link guard passed.
- Local beta gate guard passed.
- Local ops guard tests passed with 21/21 suites.
Result: Local pass; VM root workspace verification/build pending.
Follow-up issue: Re-run on the VM before any approved Supabase function apply, then run the strict RPC exposure checks after apply.
```

### Beta verification matrix workflow-boundary gate

```text
Date/time: 2026-07-29
Timezone: America/New_York
Runner: Codex
Scope: Closed-beta evidence gate alignment
Change: Added a dedicated workflow boundary/atomicity gate to the beta verification matrix before ops/legal/access/restore readiness. The matrix now requires evidence for canonical assignment, RPC-backed assignment/terminal finalizers or written owner exception, and admin/API lifecycle boundary convergence before outside beta. Added a Workflow Boundary Evidence template and extended release-doc, access/secrets, legal/consent, and restore guards to the updated gate numbering.
Files: docs/release/beta-verification-matrix.md, docs/release/beta-evidence-templates.md, scripts/ops/check-release-doc-links.mjs, scripts/ops/check-beta-gates.mjs, scripts/ops/check-access-and-secrets-readiness.mjs, scripts/ops/check-legal-consent-readiness.mjs, scripts/ops/check-restore-drill-readiness.mjs, docs/release/beta-evidence-log.md
Verification:
- Local release doc link guard passed.
- Local beta gate guard passed.
- Local access/secrets, legal/consent, and restore readiness guards passed.
- Local ops guard tests passed with 20/20 suites.
- Local staged-package guard passed for 126 staged files.
Result: Local pass; VM root workspace verification/build pending.
Follow-up issue: Collect Workflow Boundary Evidence after approved VM/Supabase reconciliation and RPC finalizer rollout or owner-signed exception.
```

### Production sequence readiness guard

```text
Date/time: 2026-07-29
Timezone: America/New_York
Runner: Codex
Scope: Production-track execution order
Change: Updated the implementation backlog and production build plan so the execution path stays ordered around installed-device create-request proof, full workflow proof, RPC-backed assignment/terminal finalizers plus admin/API boundary convergence before outside beta, then focused patient/nurse/admin product hardening. Added a dependency-free guard that prevents the track from drifting back to broad UI redesign before proof or vague backend consolidation before outside beta.
Files: scripts/ops/check-production-sequence-readiness.mjs, scripts/ops/test/check-production-sequence-readiness.test.mjs, docs/release/implementation-backlog.md, docs/release/production-build-plan.md, docs/release/start-here.md, scripts/ops/verify-vm-stage-package.mjs, scripts/ops/check-beta-gates.mjs, scripts/ops/check-release-doc-links.mjs, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/pending-vm-verification.md, docs/release/closed-beta-go-no-go.md, docs/release/beta-evidence-log.md
Verification:
- Local production sequence readiness guard passed.
- Local ops guard tests passed with 20/20 suites.
- Local staged-package guard passed for 126 staged files.
Result: Local pass; VM root workspace verification/build pending.
Follow-up issue: Keep broad UI redesign behind installed-device workflow proof; continue only focused role-specific workflow surface work until create-request evidence exists.
```

### Active blocker wording refresh

```text
Date/time: 2026-07-29
Timezone: America/New_York
Runner: Codex
Scope: Operational runbook accuracy for create-request proof
Change: Refreshed active operational docs so the current blocker is described as missing installed-device create-request proof after the deployed backend fix, not only the older Android `POST /jobs` 400 observation. Historical Android/iPhone capture packets still preserve the original POST /jobs context. Updated beta-ops and API log hygiene guards so the current proof path names approved iOS internal/TestFlight or recovered Android install.
Files: docs/ops/observability.md, docs/ops/closed-beta-ops-playbook.md, docs/ops/deployment-runbook.md, docs/release/vm-sync-handoff.md, scripts/ops/check-beta-ops-readiness.mjs, scripts/ops/check-api-log-hygiene.mjs, docs/release/beta-evidence-log.md
Verification:
- Local beta operations readiness guard passed.
- Local API log hygiene guard passed.
- Local ops guard tests passed with 19/19 suites.
- Local staged-package guard passed for 124 staged files.
Result: Local pass; VM root workspace verification/build pending.
Follow-up issue: Capture one real installed-device create-request attempt from approved iOS internal/TestFlight or recovered Android access, then inspect safe logs by request reference if it fails.
```

### Admin/API boundary readiness guard

```text
Date/time: 2026-07-29
Timezone: America/New_York
Runner: Codex
Scope: Admin/API lifecycle command-boundary convergence
Change: Tightened the architecture target so admin assignment/cancel/complete converge on the same RPC-backed finalizer contracts as API routes before outside beta, while admin-only nurse verification can remain in the protected admin server path with audit and notification coverage. Added a dependency-free guard that keeps the current admin/API route split visible and prevents the convergence target from drifting back to vague shared-logic language.
Files: scripts/ops/check-admin-api-boundary-readiness.mjs, scripts/ops/test/check-admin-api-boundary-readiness.test.mjs, docs/architecture/workflow-source-of-truth.md, docs/architecture/production-architecture.md, docs/release/beta-readiness.md, scripts/ops/verify-vm-stage-package.mjs, scripts/ops/check-beta-gates.mjs, scripts/ops/check-release-doc-links.mjs, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/pending-vm-verification.md, docs/release/closed-beta-go-no-go.md, docs/release/beta-evidence-log.md
Verification:
- Local admin/API boundary readiness guard passed.
- Local ops guard tests passed with 19/19 suites.
- Local staged-package guard passed for 124 staged files.
Result: Local pass; VM root workspace verification/build pending.
Follow-up issue: During approved VM reconciliation, wire admin assignment and terminal actions to the same RPC-backed finalizer contracts as API while preserving admin-only verification as a protected admin service.
```

### Canonical assignment readiness guard

```text
Date/time: 2026-07-29
Timezone: America/New_York
Runner: Codex
Scope: Production assignment source-of-truth decision
Change: Documented `jobs.assigned_nurse_user_id` as the production canonical assignment field and accepted application state as supporting evidence/compatibility state. Updated the data contract, workflow source-of-truth plan, Supabase verification runbook, assignment RPC rollout plan, and beta readiness checklist. Added a dependency-free guard that keeps the canonical assignment decision, live Supabase recheck, RPC draft write target, assignment contract check, and current compatibility surfaces visible.
Files: scripts/ops/check-canonical-assignment-readiness.mjs, scripts/ops/test/check-canonical-assignment-readiness.test.mjs, docs/architecture/data-contract.md, docs/architecture/workflow-source-of-truth.md, docs/ops/supabase-data-contract-verification.md, docs/ops/assignment-rpc-rollout-plan.md, docs/release/beta-readiness.md, scripts/ops/verify-vm-stage-package.mjs, scripts/ops/check-beta-gates.mjs, scripts/ops/check-release-doc-links.mjs, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/pending-vm-verification.md, docs/release/closed-beta-go-no-go.md, docs/release/beta-evidence-log.md
Verification:
- Local canonical assignment readiness guard passed.
- Local ops guard tests passed with 18/18 suites.
- Local staged-package guard passed for 122 staged files.
Result: Local pass; VM root workspace verification/build pending.
Follow-up issue: Reverify live Supabase exposes `jobs.assigned_nurse_user_id`, then reconcile accepted-application-only read paths during the RPC-backed API/admin rollout.
```

### Workflow atomicity readiness guard

```text
Date/time: 2026-07-29
Timezone: America/New_York
Runner: Codex
Scope: Assignment and terminal action atomicity posture before outside beta
Change: Added a dependency-free guard that keeps the assignment and terminal RPC rollout plans aligned with the serious-product default: atomic database finalization, owner-approved apply gate, read-only prerequisite checks, strict `--expect-rpc` exposure checks after apply, durable in-app notification rows, and guarded multi-write treated as internal engineering proof unless the owner signs an outside-tester exception. Added a Workflow Atomicity section to beta readiness and removed stale terminal-RPC notification wording that conflicted with the care-request notification privacy decision.
Files: scripts/ops/check-workflow-atomicity-readiness.mjs, scripts/ops/test/check-workflow-atomicity-readiness.test.mjs, docs/ops/terminal-job-rpc-rollout-plan.md, docs/release/beta-readiness.md, scripts/ops/verify-vm-stage-package.mjs, scripts/ops/check-beta-gates.mjs, scripts/ops/check-release-doc-links.mjs, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/pending-vm-verification.md, docs/release/closed-beta-go-no-go.md, docs/release/beta-evidence-log.md
Verification:
- Local workflow atomicity readiness guard passed.
- Local ops guard tests passed with 17/17 suites.
- Local staged-package guard passed for 120 staged files.
Result: Local pass; VM root workspace verification/build pending.
Follow-up issue: After approved VM/Supabase access returns, reconcile source, run RPC prerequisite checks, apply/wire assignment RPC first, then terminal RPC.
```

### API log hygiene guard

```text
Date/time: 2026-07-29
Timezone: America/New_York
Runner: Codex
Scope: Staged API/admin log hygiene and observability runbook truthfulness
Change: Added a dependency-free guard that scans staged API/admin source for raw request, header, token, password, private storage path, and care-detail logging. Added the observability runbook to the staged package and made the beta checklist explicit that live VM Fastify logger redaction must still be reverified before outside testers because the local staged API snapshot does not include every VM bootstrap file.
Files: scripts/ops/check-api-log-hygiene.mjs, scripts/ops/test/check-api-log-hygiene.test.mjs, docs/ops/observability.md, docs/release/beta-readiness.md, scripts/ops/verify-vm-stage-package.mjs, scripts/ops/check-beta-gates.mjs, scripts/ops/check-release-doc-links.mjs, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/pending-vm-verification.md, docs/release/closed-beta-go-no-go.md, docs/release/beta-evidence-log.md
Verification:
- Local API log hygiene guard passed.
- Local ops guard tests passed with 16/16 suites.
- Local staged-package guard passed for 118 staged files.
Result: Local pass; VM root workspace verification/build pending.
Follow-up issue: Re-run this guard and verify live Fastify logger redaction on `/home/nurseapp/nursebridge` during approved VM root verification.
```

### Notification and audit privacy guard

```text
Date/time: 2026-07-29
Timezone: America/New_York
Runner: Codex
Scope: Notification payloads, review-only RPC drafts, and admin audit display minimization
Change: Replaced assignment and terminal notification bodies that repeated user-entered request titles with generic care-request language. Updated the review-only assignment and terminal RPC drafts to use the same generic notification copy. Added a dependency-free guard that keeps notification bodies from leaking request titles and confirms the admin audit panel does not select or render audit metadata.
Files: packages/shared/src/workflow.ts, packages/shared/test/workflow.test.ts, docs/architecture/sql/assignment-finalize-rpc.draft.sql, docs/architecture/sql/terminal-job-finalize-rpc.draft.sql, scripts/ops/check-notification-audit-privacy.mjs, scripts/ops/test/check-notification-audit-privacy.test.mjs, scripts/ops/verify-vm-stage-package.mjs, scripts/ops/check-beta-gates.mjs, scripts/ops/check-release-doc-links.mjs, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/pending-vm-verification.md, docs/release/closed-beta-go-no-go.md, docs/release/beta-evidence-log.md
Verification:
- Local notification and audit privacy guard passed.
- Local ops guard tests passed with 15/15 suites.
- Local staged-package guard passed for 115 staged files.
Result: Local pass; VM root workspace verification/build pending.
Follow-up issue: Confirm live notification rows and admin audit display use only safe summaries during approved workflow proof.
```

### Private document path hygiene guard

```text
Date/time: 2026-07-29
Timezone: America/New_York
Runner: Codex
Scope: Verification document privacy and display minimization
Change: Removed `storage_path` from the mobile verification document display row type and added a dependency-free guard that keeps private verification storage paths out of mobile/admin display surfaces. The guard also confirms admin dashboard queries select only verification metadata, mobile upload paths remain limited to the upload/cleanup flow, and legal/access docs keep private-path warnings visible.
Files: apps/mobile/src/types.ts, scripts/ops/check-private-document-path-hygiene.mjs, scripts/ops/test/check-private-document-path-hygiene.test.mjs, docs/legal/beta-legal-consent-checklist.md, scripts/ops/verify-vm-stage-package.mjs, scripts/ops/check-beta-gates.mjs, scripts/ops/check-release-doc-links.mjs, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/pending-vm-verification.md, docs/release/closed-beta-go-no-go.md, docs/release/beta-evidence-log.md
Verification:
- Local private document path hygiene guard passed.
- Local staged-package guard passed for 113 staged files.
Result: Local pass; VM root workspace verification/build pending.
Follow-up issue: Confirm live API/admin responses do not expose private verification storage paths during approved VM/root verification and admin proof.
```

### In-app consent readiness guard

```text
Date/time: 2026-07-29
Timezone: America/New_York
Runner: Codex
Scope: Patient, nurse, admin, and support consent touchpoints
Change: Tightened mobile patient create-request copy to say requests are for closed-beta review and not a full medical chart or emergency service. Tightened nurse verification upload copy to say document sharing is for beta review, approval is not automatic, and no background-check/license-verification completion is claimed. Tightened admin verification queue copy to warn operators not to expose private paths and not to treat beta eligibility as a background-check or license-verification claim. Added a dependency-free guard over these in-app consent touchpoints.
Files: apps/mobile/App.tsx, apps/admin/app/page.tsx, scripts/ops/check-in-app-consent-readiness.mjs, scripts/ops/test/check-in-app-consent-readiness.test.mjs, scripts/ops/verify-vm-stage-package.mjs, scripts/ops/check-beta-gates.mjs, scripts/ops/check-release-doc-links.mjs, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/pending-vm-verification.md, docs/release/closed-beta-go-no-go.md, docs/release/beta-evidence-log.md
Verification:
- Local in-app consent readiness guard passed.
- Local ops guard tests passed with 13/13 suites.
- Local staged-package guard passed for 110 staged files.
Result: Local pass; VM root workspace verification/build pending.
Follow-up issue: Final legal/privacy review must still approve these touchpoints before outside testers.
```

### Legal and consent readiness guard

```text
Date/time: 2026-07-29
Timezone: America/New_York
Runner: Codex
Scope: Closed-beta legal, consent, retention, support, and copy-review readiness
Change: Added a dependency-free legal and consent readiness guard that keeps the legal owner, privacy policy path, terms path, verification consent path, retention note, support/data request process, emergency language, in-app consent touchpoints, product copy review, and formal reviewer status explicit before outside testers.
Files: scripts/ops/check-legal-consent-readiness.mjs, scripts/ops/test/check-legal-consent-readiness.test.mjs, docs/release/beta-evidence-templates.md, scripts/ops/verify-vm-stage-package.mjs, scripts/ops/check-beta-gates.mjs, scripts/ops/check-release-doc-links.mjs, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/pending-vm-verification.md, docs/release/closed-beta-go-no-go.md, docs/release/beta-evidence-log.md
Verification:
- Local legal and consent readiness guard passed.
- Local ops guard tests passed with 12/12 suites.
- Local staged-package guard passed for 108 staged files.
Result: Local pass; VM root workspace verification/build pending.
Follow-up issue: Finalize and review privacy, terms, verification document consent, data retention expectations, support/data request process, and in-app consent touchpoints before outside testers.
```

### Access and secrets readiness guard

```text
Date/time: 2026-07-29
Timezone: America/New_York
Runner: Codex
Scope: Closed-beta access and secret ownership readiness
Change: Added a dependency-free access and secrets readiness guard that keeps beta access rules, invite/revocation process, secrets owner, rotation procedure, runtime env owner, emergency revocation path, and no-secrets-in-evidence confirmation explicit before outside testers.
Files: scripts/ops/check-access-and-secrets-readiness.mjs, scripts/ops/test/check-access-and-secrets-readiness.test.mjs, docs/release/beta-evidence-templates.md, scripts/ops/verify-vm-stage-package.mjs, scripts/ops/check-beta-gates.mjs, scripts/ops/check-release-doc-links.mjs, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/pending-vm-verification.md, docs/release/closed-beta-go-no-go.md, docs/release/beta-evidence-log.md
Verification:
- Local access and secrets readiness guard passed.
- Local ops guard tests passed with 11/11 suites.
- Local staged-package guard passed for 106 staged files.
Result: Local pass; VM root workspace verification/build pending.
Follow-up issue: Assign named access/secrets owners, confirm invite and revocation flow, confirm rotation expectations, and record `## Beta Access Rules Evidence` before outside testers.
```

### Workflow smoke readiness guard

```text
Date/time: 2026-07-29
Timezone: America/New_York
Runner: Codex
Scope: Controlled closed-beta workflow smoke readiness
Change: Added a dependency-free workflow smoke readiness guard that keeps the mutating smoke workflow production-gated and evidence-ready. The guard checks the smoke script's non-mutating preflight, patient/nurse/admin token role checks, production approval gate, requestId trace output, completion/cancellation/wrong-role assertions, smoke regression test coverage, operator runbook, beta readiness checklist, verification matrix, evidence template, and go/no-go packet.
Files: scripts/ops/check-workflow-smoke-readiness.mjs, scripts/ops/test/check-workflow-smoke-readiness.test.mjs, scripts/ops/verify-vm-stage-package.mjs, scripts/ops/check-beta-gates.mjs, scripts/ops/check-release-doc-links.mjs, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/pending-vm-verification.md, docs/release/closed-beta-go-no-go.md, docs/release/beta-evidence-log.md
Verification:
- Local workflow smoke readiness guard passed.
- Local ops guard tests passed with 10/10 suites.
- Local staged-package guard passed for 104 staged files.
Result: Local pass; VM root workspace verification/build pending.
Follow-up issue: After installed-device create-request is proven and owner approval exists, run `scripts/ops/smoke-beta-workflow.sh --preflight`, then the approved mutating smoke, and record `## Workflow Smoke Evidence`.
```

### Restore drill readiness guard

```text
Date/time: 2026-07-29
Timezone: America/New_York
Runner: Codex
Scope: Closed-beta backup/restore proof gate
Change: Added a dependency-free restore drill readiness guard that keeps backup/restore proof visible before outside testers. The guard checks beta readiness blockers, restore drill evidence fields, closed-beta operations requirements, Supabase restore-drill safety rules, go/no-go restore proof language, and verification matrix restore gate language.
Files: scripts/ops/check-restore-drill-readiness.mjs, scripts/ops/test/check-restore-drill-readiness.test.mjs, docs/ops/supabase-data-contract-verification.md, scripts/ops/verify-vm-stage-package.mjs, scripts/ops/check-beta-gates.mjs, scripts/ops/check-release-doc-links.mjs, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/pending-vm-verification.md, docs/release/closed-beta-go-no-go.md, docs/release/beta-evidence-log.md
Verification:
- Local restore drill readiness guard passed.
- Local ops guard tests passed with 9/9 suites.
- Local staged-package guard passed for 104 staged files.
- Local beta gate, release-doc link, beta operations readiness, mobile support snapshot, mobile secret hygiene, NurseBridge isolation, real-device proof readiness, and trust-language guards passed.
Result: Local pass; VM root workspace verification/build pending.
Follow-up issue: Complete an actual non-production Supabase restore drill and record `## Restore Drill Evidence` before outside testers.
```

### API terminal RPC finalizer contract

```text
Date/time: 2026-07-29 18:35
Timezone: America/New_York
Runner: Codex
Scope: API terminal cancel/complete RPC adapter preparation
Change: Added a review-only API terminal RPC finalizer contract for the planned `finalize_terminal_job_rpc` boundary. The adapter calls the terminal RPC with job, actor, expected-status, and next-status context and maps database/RPC errors back to shared workflow categories. Current runtime terminal routes still use the guarded multi-write path; no Supabase schema, runtime env, Cloudflare route, secret, live service, or terminal smoke path was changed.
Files: services/api/src/jobTerminalCommand.ts, services/api/test/jobTerminalCommand.test.ts, services/api/package.json, scripts/ops/verify-vm-stage-package.mjs, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification:
- VM API typecheck passed.
- VM focused API terminal RPC finalizer contract tests passed with 3/3 tests.
- VM full API test suite passed with 62/62 tests.
- Local staged-package guard passed for 102 staged files.
Result: Focused API pass; VM root workspace verification/build pending.
Follow-up issue: Re-run VM identity guard, staged-package guard, root `pnpm verify`, and root `pnpm run build` when SSH escalation/usage access is available.
```

### Terminal job RPC approval package

```text
Date/time: 2026-07-29 18:20
Timezone: America/New_York
Runner: Codex
Scope: Terminal cancel/complete database-atomicity preparation
Change: Added a review-only terminal job RPC approval package for the known cancel/complete partial-write risk. The package includes a draft `finalize_terminal_job_rpc` SQL boundary, an approval-gated rollout plan, a read-only Supabase OpenAPI contract checker, and mock OpenAPI tests for prerequisite mode, strict post-apply mode, and missing-column failures. No Supabase schema, runtime env, Cloudflare route, secret, or live service was changed.
Files: docs/architecture/sql/terminal-job-finalize-rpc.draft.sql, docs/ops/terminal-job-rpc-rollout-plan.md, scripts/ops/check-terminal-job-rpc-contract.mjs, scripts/ops/test/check-terminal-job-rpc-contract.test.mjs, scripts/ops/verify-vm-stage-package.mjs, docs/architecture/workflow-source-of-truth.md, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification:
- VM terminal and assignment RPC contract checker tests passed with 6/6 tests.
- VM NurseBridges identity verification passed across 102 files.
- VM staged-package guard passed for 77 staged files.
- VM root `pnpm verify` passed with scripts/ops tests 8/8 and no failures.
- VM root `pnpm run build` passed across shared, API, and admin.
Result: Pass.
Follow-up issue: Owner approval is required before any Supabase function creation/replacement, grants/revokes, runtime RPC integration, or live terminal-action smoke test.
```

### Mobile request summary cards

```text
Date/time: 2026-07-29 18:00
Timezone: America/New_York
Runner: Codex
Scope: Patient/nurse mobile request list surfaces and terminal-action confirmation copy
Change: Added a shared mobile request-summary card used by patient records, nurse open requests, and nurse work. Cancel/complete confirmation copy now comes from a tested workflow helper so terminal-action language stays consistent across list and detail surfaces.
Files: apps/mobile/App.tsx, apps/mobile/src/workflow.ts, apps/mobile/test/workflow.test.ts, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification:
- VM mobile typecheck passed.
- VM mobile tests passed with 24/24 tests, including care request transition confirmation copy coverage.
- VM NurseBridges identity verification passed across 99 files.
- VM staged-package guard passed for 73 staged files.
- VM root `pnpm verify` passed with services/api 59 tests, scripts/ops tests 5/5, and no failures.
- VM root `pnpm run build` passed across shared, API, and admin.
Result: Pass.
Follow-up issue: Continue installed-device create-request proof before deeper visual polish.
```

### Mobile workflow detail shell

```text
Date/time: 2026-07-29 17:45
Timezone: America/New_York
Runner: Codex
Scope: Patient/nurse mobile request detail surfaces
Change: Added a shared mobile request-detail shell for patient current-request and nurse selected-request panels. The shared shell owns status badge rendering, summary placement, safe field rows, optional lifecycle timeline, role actions, final-record language, and support-copy error notice rendering.
Files: apps/mobile/App.tsx, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification:
- VM mobile typecheck passed.
- VM mobile tests passed with 23/23 tests.
- VM NurseBridges identity verification passed across 99 files.
- VM staged-package guard passed for 73 staged files.
- VM root `pnpm verify` passed with services/api 59 tests, scripts/ops tests 5/5, and no failures.
- VM root `pnpm run build` passed across shared, API, and admin.
Result: Pass.
Follow-up issue: Continue workflow-first UI componentization after installed-device create-request proof, including confirmation dialogs and reusable request summaries.
```

### Patient create request context fields

```text
Date/time: 2026-07-29 17:30
Timezone: America/New_York
Runner: Codex
Scope: Patient mobile Create Request, dispatch-context fields
Change: Added Contact context and Mobility/support notes fields to the patient create-request form. The tested payload builder folds those values into the existing API `description` payload as labeled sections and proves the mobile client still does not send ownership fields or unsupported backend columns.
Files: apps/mobile/App.tsx, apps/mobile/src/workflow.ts, apps/mobile/test/workflow.test.ts, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification:
- VM mobile tests passed with 23/23 tests, including create-request payload coverage for contact context and mobility/support notes.
- VM mobile typecheck passed.
- VM NurseBridges identity verification passed across 99 files.
- VM staged-package guard passed for 73 staged files.
- VM root `pnpm verify` passed with services/api 59 tests, scripts/ops tests 5/5, and no failures.
- VM root `pnpm run build` passed across shared, API, and admin.
Result: Pass.
Follow-up issue: Continue installed-device create-request proof once signing/device access is available.
```

### Patient Home support safety

```text
Date/time: 2026-07-29 17:16
Timezone: America/New_York
Runner: Codex
Scope: Patient mobile Home, support/safety slice
Change: Added a Patient Home support/safety panel below the current status/request detail. The panel states NurseBridge is for closed-beta care coordination, is not an emergency service, directs urgent medical or safety needs to local emergency services or the patient's normal care contact, and links to Account support details.
Files: apps/mobile/App.tsx, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification:
- VM mobile tests passed with 23/23 tests.
- VM mobile typecheck passed.
- VM NurseBridges identity verification passed across 99 files.
- VM staged-package guard passed for 73 staged files.
- VM root `pnpm verify` passed with services/api 59 tests, scripts/ops tests 5/5, and no failures.
- VM root `pnpm run build` passed across shared, API, and admin.
Result: Pass.
Follow-up issue: Continue installed-device workflow proof once signing/device access is available.
```

### Account-owned identity layout

```text
Date/time: 2026-07-29 17:04
Timezone: America/New_York
Runner: Codex
Scope: Mobile role navigation, Account layout cleanup
Change: Moved patient/nurse identity and sign-out details fully into the Account tab by removing the signed-in panel from patient/nurse workflow screens. Admin mobile keeps the signed-in panel because admin actions remain directed to the protected web console. Cleaned Account support copy so it renders plain text in React Native.
Files: apps/mobile/App.tsx, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification:
- VM mobile tests passed with 23/23 tests.
- VM mobile typecheck passed.
- VM NurseBridges identity verification passed across 99 files.
- VM staged-package guard passed for 73 staged files.
- VM root `pnpm verify` passed with services/api 59 tests, scripts/ops tests 5/5, and no failures.
- VM root `pnpm run build` passed across shared, API, and admin.
Result: Pass.
Follow-up issue: Continue installed-device workflow proof once signing/device access is available.
```

### Mobile account tabs

```text
Date/time: 2026-07-29 16:52
Timezone: America/New_York
Runner: Codex
Scope: Mobile role navigation, Account/support slice
Change: Added Account tabs for patient and nurse mobile flows. The Account panel shows closed-beta context, signed-in email, role, API connection, nurse verification status when relevant, sign-out, and support/safety language that says NurseBridge is not an emergency service and directs urgent medical or safety needs to local emergency services or the patient's normal care contact.
Files: apps/mobile/App.tsx, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification:
- VM mobile tests passed with 23/23 tests.
- VM mobile typecheck passed.
- VM NurseBridges identity verification passed across 99 files.
- VM staged-package guard passed for 73 staged files.
- VM root `pnpm verify` passed with services/api 59 tests, scripts/ops tests 5/5, and no failures.
- VM root `pnpm run build` passed across shared, API, and admin.
Result: Pass.
Follow-up issue: Move the global signed-in header into the Account tab during a later visual/layout pass.
```

### Nurse request detail model

```text
Date/time: 2026-07-29 16:36
Timezone: America/New_York
Runner: Codex
Scope: Nurse mobile workflow pass, selected-request detail slice
Change: Added a tested nurse request detail model and used it to render selected request details with status, summary, application state, assignment ownership, location, start, rate, description, and only eligible Apply or Complete actions. The model covers open applyable requests, assigned-to-you work, and assigned-to-another/not-selected states without unsupported verification or background-check claims.
Files: apps/mobile/App.tsx, apps/mobile/src/workflow.ts, apps/mobile/test/workflow.test.ts, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification:
- VM mobile tests passed with 23/23 tests, including nurse request detail model coverage.
- VM mobile typecheck passed.
- VM NurseBridges identity verification passed across 99 files.
- VM staged-package guard passed for 73 staged files.
- VM root `pnpm verify` passed with services/api 59 tests, scripts/ops tests 5/5, and no failures.
- VM root `pnpm run build` passed across shared, API, and admin.
Result: Pass.
Follow-up issue: Continue installed-device workflow proof once signing/device access is available.
```

### Nurse role tabs

```text
Date/time: 2026-07-29 16:18
Timezone: America/New_York
Runner: Codex
Scope: Nurse mobile workflow pass, role-specific navigation slice
Change: Added nurse-only role tabs for Home, Open Requests, My Work, Verification, and Updates. Nurse Home keeps verification/work status and next action first; Open Requests holds eligible request review/application; My Work holds assigned/applied requests and completion; Verification holds document upload/review state without unsupported background-check or license-verification claims; Updates holds notifications. Patient/admin layouts remain unchanged in this slice.
Files: apps/mobile/App.tsx, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification:
- VM mobile tests passed with 21/21 tests.
- VM mobile typecheck passed.
- VM NurseBridges identity verification passed across 99 files.
- VM staged-package guard passed for 73 staged files.
- VM root `pnpm verify` passed with services/api 59 tests, scripts/ops tests 5/5, and no failures.
- VM root `pnpm run build` passed across shared, API, and admin.
Result: Pass.
Follow-up issue: Continue request-detail polish and installed-device proof once signing/device access is available.
```

### Patient role tabs

```text
Date/time: 2026-07-29 16:02
Timezone: America/New_York
Runner: Codex
Scope: Patient mobile workflow pass, role-specific navigation slice
Change: Added patient-only role tabs for Home, New Request, Records, and Updates. Patient Home keeps status/next-action/current-request detail first; New Request holds the create-request form and returns to Home after successful submit; Records holds request history; Updates holds notifications. Nurse/admin layouts remain unchanged for their own future passes.
Files: apps/mobile/App.tsx, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification:
- VM mobile tests passed with 21/21 tests.
- VM mobile typecheck passed.
- VM NurseBridges identity verification passed across 99 files.
- VM staged-package guard passed for 73 staged files.
- VM root `pnpm verify` passed with services/api 59 tests, scripts/ops tests 5/5, and no failures.
- VM root `pnpm run build` passed across shared, API, and admin.
Result: Pass.
Follow-up issue: Continue role-specific navigation for nurse workflows after patient create/status flow is proven on an installed build.
```

### Patient request detail panel

```text
Date/time: 2026-07-29 15:43
Timezone: America/New_York
Runner: Codex
Scope: Patient mobile workflow pass, current-request detail slice
Change: Added a tested patient request detail model and rendered it in the mobile patient surface above generic notifications and request history. The panel shows status, assigned caregiver, start, location, rate, related update count, lifecycle timeline, and only eligible cancel/complete actions. Final completed/cancelled requests render as final records with no active actions.
Files: apps/mobile/App.tsx, apps/mobile/src/workflow.ts, apps/mobile/test/workflow.test.ts, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification:
- Local NurseBridges identity verification passed across 97 files.
- Local staged-package guard passed for 73 staged files.
- VM mobile tests passed with 21/21 tests, including patient request detail model coverage.
- VM mobile typecheck passed.
- VM NurseBridges identity verification passed across 99 files.
- VM staged-package guard passed for 73 staged files.
- VM root `pnpm verify` passed with services/api 59 tests, scripts/ops tests 5/5, and no failures.
- VM root `pnpm run build` passed across shared, API, and admin.
Result: Pass.
Follow-up issue: Continue patient workflow into true navigation and installed-device create-request proof when signing/device access is available.
```

### Lead engineering blueprint

```text
Date/time: 2026-07-29 15:24
Timezone: America/New_York
Runner: Codex
Scope: Production-track architecture and sequencing correction
Change: Added `docs/architecture/lead-engineering-blueprint.md` as the current lead-engineering strategy for what to build high level: mobile remains Expo/React Native for patients/nurses, admin remains protected web for dispatch, Fastify API remains the workflow backbone, Supabase/VM remain the closed-beta base, and native Swift/Xcode is deferred until a proven platform-specific need appears. Updated roadmap docs to clarify that iOS/internal can prove the first installed-device workflow, Android must be rechecked before wider beta unless explicitly deferred by the owner, NB-00 is now a repeatable guarded sync package, and narrow workflow-clarity UI slices are allowed before full real-device proof.
Files: docs/architecture/lead-engineering-blueprint.md, docs/architecture/production-architecture.md, docs/product/ui-implementation-brief.md, docs/release/start-here.md, docs/release/production-build-plan.md, docs/release/implementation-backlog.md, docs/release/current-build-status.md, docs/release/beta-readiness.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, scripts/ops/verify-vm-stage-package.mjs, docs/release/beta-evidence-log.md
Verification:
- Local NurseBridges identity verification passed across 97 files.
- Local VM staged-package verification passed for 73 staged files.
- VM NurseBridges identity verification passed across 99 files.
- VM staged-package verification passed for 73 staged files.
Result: Pass.
Follow-up issue: Continue role-specific mobile workflow implementation while installed-device signing/proof remains externally blocked.
```

### Mobile workflow snapshot

```text
Date/time: 2026-07-29 14:52
Timezone: America/New_York
Runner: Codex
Scope: Mobile product seriousness pass, status/next-action/record slice
Change: Added a role-specific workflow snapshot to the mobile app header so patient and nurse users see status, next step, and record context before generic metrics. Added tested workflow helpers for patient and nurse snapshot copy, including unverified nurse, assigned nurse, available-request, no-active-request, assigned, and cancelled patient states.
Files: apps/mobile/App.tsx, apps/mobile/src/workflow.ts, apps/mobile/test/workflow.test.ts, scripts/ops/verify-vm-stage-package.mjs, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification:
- Local NurseBridges identity verification passed across 96 files.
- Local VM staged-package verification passed for 72 staged files.
- VM mobile tests passed with 19/19 tests, including patient and nurse workflow snapshot coverage.
- VM mobile typecheck passed.
- VM NurseBridges identity verification passed across 98 files.
- VM staged-package verification passed for 72 staged files.
- VM root `pnpm verify` passed with apps/mobile 19 tests, services/api 59 tests, scripts/ops tests 5/5, and no failures.
- VM root `pnpm run build` passed across shared, API, and admin.
Result: Pass.
Follow-up issue: Continue the mobile redesign into true role-specific navigation and request/detail screens after installed-device create-request proof.
```

### Assignment RPC contract checker

```text
Date/time: 2026-07-29 14:48
Timezone: America/New_York
Runner: Codex
Scope: NB-08 assignment RPC readiness verification
Change: Added `scripts/ops/check-assignment-rpc-contract.mjs`, a read-only Supabase Data API/OpenAPI metadata checker for the planned assignment RPC integration. Default mode verifies required assignment table/column prerequisites while allowing the RPC to remain pending; `--expect-rpc` becomes the strict post-apply gate once the owner approves and applies the function.
Files: package.json, scripts/ops/check-assignment-rpc-contract.mjs, scripts/ops/test/check-assignment-rpc-contract.test.mjs, scripts/ops/verify-vm-stage-package.mjs, docs/ops/assignment-rpc-rollout-plan.md, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification:
- Local script help passed.
- Local mock script tests passed with 5/5 after rerunning outside the desktop sandbox loopback restriction.
- Local NurseBridges identity verification passed across 96 files.
- Local VM staged-package verification passed for 71 staged files.
- VM staged-package verification passed for 71 staged files.
- VM script tests passed with 5/5, including 3 assignment RPC contract checker tests and 2 smoke workflow script tests.
- VM NurseBridges identity verification passed across 98 files.
- VM root `pnpm verify` passed with packages/shared 13 tests, apps/mobile 17 tests, apps/admin 16 tests, services/api 59 tests, and scripts/ops tests 5/5.
- VM root `pnpm run build` passed across shared, API, and admin.
- Live read-only Supabase preflight was not completed because `/etc/nursebridge/api.env` is not readable by the current VM SSH user; no secret workaround was attempted.
Result: pass
Follow-up issue: Run `node scripts/ops/check-assignment-rpc-contract.mjs --expect-rpc` only after the assignment RPC is approved/applied and REST schema cache exposure is expected.
```

### Assignment finalizer route seam

```text
Date/time: 2026-07-29 14:45
Timezone: America/New_York
Runner: Codex
Scope: NB-08 assignment atomicity route preparation
Change: Added an injectable assignment finalizer seam to API admin assignment and patient application acceptance routes. The default remains the existing guarded multi-write finalizer, but both routes now pass actor context to the finalizer input so a future approved RPC-backed finalizer can write assignment and audit evidence through one boundary.
Files: services/api/src/jobAssignmentCommand.ts, services/api/src/routes/adminAssignmentRoute.ts, services/api/src/routes/applicationDecisionRoute.ts, services/api/test/adminAssignmentRoute.test.ts, services/api/test/applicationDecisionRoute.test.ts, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification:
- Local NurseBridges identity verification passed across 94 files.
- Local VM staged-package verification passed for 69 staged files.
- VM API tests passed with 59 tests, including admin and patient finalizer seam coverage.
- VM API typecheck passed.
- VM staged-package verification passed for 69 staged files.
- VM NurseBridges identity verification passed across 96 files.
- VM root `pnpm verify` passed with packages/shared 13 tests, apps/mobile 17 tests, apps/admin 16 tests, services/api 59 tests, and scripts/ops smoke workflow 2 tests.
- VM root `pnpm run build` passed across shared, API, and admin.
Result: pass
Follow-up issue: After owner approval and live function/grant verification, wire the injectable finalizer to the RPC finalizer and verify the full workflow before removing the multi-write default.
```

### Assignment RPC API finalizer contract

```text
Date/time: 2026-07-29 14:43
Timezone: America/New_York
Runner: Codex
Scope: NB-08 assignment atomicity API preparation
Change: Added a review-only API RPC finalizer function for the planned `finalize_applied_assignment_rpc` database boundary. The helper sends job, selected application, selected nurse, and optional actor context to Supabase RPC and maps controlled SQLSTATE/PostgREST errors into the shared workflow categories. Existing assignment routes still use the guarded multi-write finalizer until the owner approves the Supabase function and route integration.
Files: services/api/src/jobAssignmentCommand.ts, services/api/test/jobAssignment.test.ts, scripts/ops/verify-vm-stage-package.mjs, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification:
- Local NurseBridges identity verification passed across 94 files.
- Local VM staged-package verification passed for 69 staged files.
- VM API tests passed with 57 tests, including 7 job assignment database/RPC contract tests.
- VM API typecheck passed.
- VM API production build passed.
- VM staged-package verification passed for 69 staged files.
- VM NurseBridges identity verification passed across 96 files.
- VM root `pnpm verify` passed with packages/shared 13 tests, apps/mobile 17 tests, apps/admin 16 tests, services/api 57 tests, and scripts/ops smoke workflow 2 tests.
- VM root `pnpm run build` passed across shared, API, and admin.
Result: pass
Follow-up issue: After owner approval and live function/grant verification, route admin assignment and patient acceptance through the RPC finalizer and remove the multi-write fallback only after full workflow verification.
```

### Assignment RPC design package

```text
Date/time: 2026-07-29 14:39
Timezone: America/New_York
Runner: Codex
Scope: NB-08 assignment atomicity design
Change: Added a review-only Supabase RPC draft and rollout plan for atomic assignment finalization. The draft targets one transaction for job assignment, selected application acceptance, competing application rejection, in-app notifications, and admin audit evidence. This has not been applied to Supabase and requires owner approval, live schema verification, function grant verification, API integration, and full verification before use.
Files: docs/architecture/sql/assignment-finalize-rpc.draft.sql, docs/ops/assignment-rpc-rollout-plan.md, scripts/ops/verify-vm-stage-package.mjs, docs/architecture/workflow-source-of-truth.md, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification:
- Local NurseBridges identity verification passed across 94 files.
- Local VM staged-package verification passed for 68 staged files.
- Synced only the review package docs and staged-package manifest to `/home/nurseapp/nursebridge`.
- VM staged-package verification passed for 68 staged files.
- VM NurseBridges identity verification passed across 96 files.
Result: pass
Follow-up issue: Convert this review package into an approved migration/API integration slice only after live schema and grants are verified.
```

### Shared assignment command planning

```text
Date/time: 2026-07-29 11:50
Timezone: America/New_York
Runner: Codex
Scope: NB-08 workflow source-of-truth consolidation, assignment command-plan slice
Change: Added createAssignmentCommandPlan to @nursebridge/shared/workflow and locally routed API/admin assignment paths through it for selected-application validation, competing rejection recipients, assignment notifications, and admin assignment audit intent. finalizeAppliedAssignment now validates that the selected application is still in the applied set before attempting the guarded job assignment write.
Files: packages/shared/src/workflow.ts, packages/shared/test/workflow.test.ts, services/api/src/jobWorkflow.ts, services/api/src/jobAssignmentCommand.ts, services/api/src/routes/adminAssignmentRoute.ts, services/api/test/adminAssignmentRoute.test.ts, services/api/test/applicationDecisionRoute.test.ts, apps/admin/lib/workflowRules.ts, apps/admin/lib/jobAssignmentActionsCore.ts, docs/release/current-build-status.md, docs/release/beta-evidence-log.md
Verification: Locally, NurseBridges identity verification passed across 93 files, VM staged-package verification passed for 66 staged files, and no local node_modules were left behind. On the VM, NurseBridges identity verification passed across 95 files; VM staged-package verification passed for 66 staged files; focused @nursebridge/shared tests passed with 13 tests including assignment command planning; focused services/api tests passed with 54 tests; focused apps/admin tests passed with 16 tests; API and admin typechecks passed after the FinalizeAppliedAssignmentResult category typing fix; root `pnpm verify` passed with packages/shared 13 tests, apps/mobile 17 tests, apps/admin 16 tests, services/api 54 tests, and scripts/ops smoke workflow 2 tests; root `pnpm run build` passed across shared, API, and admin.
Result: pass
Follow-up issue: Assignment persistence is still not transaction/RPC-backed; this slice centralizes assignment command intent and selected-application revalidation only.
```

### Shared terminal command planning

```text
Date/time: 2026-07-18 03:35
Timezone: America/New_York
Runner: Codex
Scope: NB-08 workflow source-of-truth consolidation, terminal command-plan slice
Change: Added createCancelJobCommandPlan and createCompleteJobCommandPlan to @nursebridge/shared/workflow and routed API/admin cancel/complete terminal actions through them. Terminal next status, applied-application rejection intent, notification nurse recipients, and admin audit intent are now shared command-plan outputs while API/admin continue to own database writes and response rendering.
Files: packages/shared/src/workflow.ts, packages/shared/test/workflow.test.ts, services/api/src/jobWorkflow.ts, services/api/src/routes/jobTerminalRoute.ts, apps/admin/lib/workflowRules.ts, apps/admin/lib/jobTerminalActionsCore.ts, docs/architecture/workflow-source-of-truth.md, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification: Locally, NurseBridges identity verification passed across 93 files and VM staged-package verification passed for 66 staged files. On the VM, NurseBridges identity verification passed across 95 files; VM staged-package verification passed for 66 staged files; focused @nursebridge/shared tests passed with 11 tests including cancel/complete command-plan side effects; focused services/api tests passed with 54 tests; focused apps/admin tests passed with 16 tests; API and admin typechecks passed; root `pnpm verify` passed with packages/shared 11 tests, apps/mobile 17 tests, apps/admin 16 tests, services/api 54 tests, and scripts/ops smoke workflow 2 tests; root `pnpm run build` passed across shared, API, and admin.
Result: pass
Follow-up issue: API/admin terminal persistence orchestration is still duplicated and not transaction/RPC-backed; this slice centralizes command intent only.
```

### Shared terminal decision contract

```text
Date/time: 2026-07-18 03:30
Timezone: America/New_York
Runner: Codex
Scope: NB-08 workflow source-of-truth consolidation, terminal decision contract slice
Change: Added getCancelJobDecision and getCompleteJobDecision to @nursebridge/shared/workflow and routed API/admin cancel/complete terminal actions through them. Role, ownership, accepted-nurse, and invalid-transition classification for terminal actions now share one tested decision contract while API/admin continue to own persistence and response rendering.
Files: packages/shared/src/workflow.ts, packages/shared/test/workflow.test.ts, services/api/src/jobWorkflow.ts, services/api/src/routes/jobTerminalRoute.ts, apps/admin/lib/workflowRules.ts, apps/admin/lib/jobTerminalActionsCore.ts, docs/architecture/workflow-source-of-truth.md, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification: Locally, NurseBridges identity verification passed across 93 files and VM staged-package verification passed for 66 staged files. On the VM, NurseBridges identity verification passed across 95 files; VM staged-package verification passed for 66 staged files; focused @nursebridge/shared tests passed with 9 tests including terminal cancel/complete decision classification; focused services/api tests passed with 54 tests; focused apps/admin tests passed with 16 tests; API and admin typechecks passed after explicit accepted-nurse narrowing; root `pnpm verify` passed with packages/shared 9 tests, apps/mobile 17 tests, apps/admin 16 tests, services/api 54 tests, and scripts/ops smoke workflow 2 tests; root `pnpm run build` passed across shared, API, and admin.
Result: pass
Follow-up issue: API/admin terminal persistence orchestration is still duplicated and not transaction/RPC-backed; this slice centralizes terminal decision classification only.
```

### Shared terminal notification planning

```text
Date/time: 2026-07-18 03:25
Timezone: America/New_York
Runner: Codex
Scope: NB-08 workflow source-of-truth consolidation, terminal notification planning slice
Change: Added buildTerminalJobNotifications to @nursebridge/shared/workflow and routed API/admin cancel/complete terminal actions through it. Patient/nurse terminal notification payload shape, fallback job title, omitted missing patient recipients, and duplicate nurse recipient de-duplication now have one shared implementation instead of duplicated API/admin construction.
Files: packages/shared/src/workflow.ts, packages/shared/test/workflow.test.ts, services/api/src/jobWorkflow.ts, services/api/src/routes/jobTerminalRoute.ts, apps/admin/lib/workflowRules.ts, apps/admin/lib/jobTerminalActionsCore.ts, docs/architecture/workflow-source-of-truth.md, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification: Locally, NurseBridges identity verification passed across 93 files and VM staged-package verification passed for 66 staged files. On the VM, NurseBridges identity verification passed across 95 files; VM staged-package verification passed for 66 staged files; focused @nursebridge/shared tests passed with 7 tests including terminal notification planning; focused services/api tests passed with 54 tests; focused apps/admin tests passed with 16 tests; API and admin typechecks passed; root `pnpm verify` passed with packages/shared 7 tests, apps/mobile 17 tests, apps/admin 16 tests, services/api 54 tests, and scripts/ops smoke workflow 2 tests; root `pnpm run build` passed across shared, API, and admin.
Result: pass
Follow-up issue: API/admin terminal persistence orchestration is still duplicated and not transaction/RPC-backed; this slice centralizes notification intent only.
```

### Terminal action error contract mapping

```text
Date/time: 2026-07-18 03:20
Timezone: America/New_York
Runner: Codex
Scope: NB-08 workflow source-of-truth consolidation, terminal action error mapping slice
Change: Wired the shared workflow error contract into API and admin cancel/complete terminal actions. Stale guarded cancel/complete status writes now map to the shared conflict category and 409 HTTP/statusCode behavior. API route tests and admin action-core tests cover stale terminal writes and assert that notifications and audit rows are not written after the failed final status claim.
Files: services/api/src/routes/jobTerminalRoute.ts, services/api/src/jobStatusCore.ts, services/api/test/jobTerminalRoute.test.ts, services/api/test/jobStatusCore.test.ts, apps/admin/lib/jobTerminalActionsCore.ts, apps/admin/test/jobTerminalActionsCore.test.ts, scripts/ops/verify-vm-stage-package.mjs, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/current-build-status.md, docs/release/beta-evidence-log.md
Verification: Locally, NurseBridges identity verification passed across 93 files and VM staged-package verification passed for 66 staged files. On the VM, NurseBridges identity verification passed across 95 files; VM staged-package verification passed for 66 staged files; focused services/api tests passed with 54 tests including cancel/complete stale-write conflict coverage; focused apps/admin tests passed with 16 tests including terminal action conflict-category coverage; API and admin typechecks passed; root `pnpm verify` passed with packages/shared 6 tests, apps/mobile 17 tests, apps/admin 16 tests, services/api 54 tests, and scripts/ops smoke workflow 2 tests; root `pnpm run build` passed across shared, API, and admin.
Result: pass
Follow-up issue: Cancel still rejects applied applications before the final job status write, so full transaction/RPC-backed terminal actions remain required before broader beta.
```

### Assignment error contract mapping

```text
Date/time: 2026-07-18 03:10
Timezone: America/New_York
Runner: Codex
Scope: NB-08 workflow source-of-truth consolidation, assignment error mapping slice
Change: Wired the shared workflow error contract into trust-sensitive assignment paths. API admin assignment and patient application acceptance now use shared workflow status mapping for not_found, forbidden, invalid_transition, storage_or_db_error, and assignment conflict cases. The shared assignment command classifies stale assignment claim failures as conflict, so stale open-job claim failures now return 409 instead of a generic 400. Admin assignment core actions now attach the shared category and statusCode to thrown workflow errors, and admin/API tests assert the stale assignment conflict behavior.
Files: services/api/src/jobAssignmentCommand.ts, services/api/src/routes/adminAssignmentRoute.ts, services/api/src/routes/applicationDecisionRoute.ts, services/api/test/adminAssignmentRoute.test.ts, services/api/test/applicationDecisionRoute.test.ts, apps/admin/lib/jobAssignmentActionsCore.ts, apps/admin/test/jobAssignmentActionsCore.test.ts, scripts/ops/verify-vm-stage-package.mjs, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/current-build-status.md, docs/release/beta-evidence-log.md
Verification: Locally, NurseBridges identity verification passed across 93 files and VM staged-package verification passed for 62 staged files. On the VM, NurseBridges identity verification passed across 95 files; VM staged-package verification passed for 62 staged files; focused services/api tests passed with 52 tests including admin assignment and patient application acceptance stale-claim conflict coverage; focused apps/admin tests passed with 14 tests including assignment core conflict-category coverage; API and admin typechecks passed; root `pnpm verify` passed with packages/shared 6 tests, apps/mobile 17 tests, apps/admin 14 tests, services/api 52 tests, and scripts/ops smoke workflow 2 tests; root `pnpm run build` passed across shared, API, and admin.
Result: pass
Follow-up issue: Assignment still is not fully transaction/RPC-backed; this maps stale assignment failures consistently but does not make the multi-record assignment sequence atomic.
```

### Shared workflow error contract

```text
Date/time: 2026-07-18 03:05
Timezone: America/New_York
Runner: Codex
Scope: NB-08 workflow source-of-truth consolidation, typed error-contract slice
Change: Added a stable typed workflow error contract to @nursebridge/shared/workflow. The shared package now exports workflowErrorCategories, WorkflowErrorCategory, workflowErrorHttpStatus, isWorkflowErrorCategory, and getWorkflowErrorHttpStatus for unauthorized, forbidden, not_found, invalid_transition, conflict, and storage_or_db_error. API, admin, and mobile workflow adapters re-export the contract so future command-boundary work can map errors consistently instead of each surface inventing status/category behavior independently.
Files: packages/shared/src/workflow.ts, packages/shared/test/workflow.test.ts, apps/admin/lib/workflowRules.ts, services/api/src/jobWorkflow.ts, apps/mobile/src/workflow.ts, docs/release/current-build-status.md, docs/release/beta-evidence-log.md
Verification: Locally, NurseBridges identity verification passed across 93 files and VM staged-package verification passed for 60 staged files. On the VM, NurseBridges identity verification passed across 95 files; VM staged-package verification passed for 60 staged files; focused @nursebridge/shared tests passed with 6 tests including the compiled workflow error contract; admin, mobile, and API typechecks passed against the new adapter exports; root `pnpm verify` passed with packages/shared 6 tests, apps/mobile 17 tests, apps/admin 14 tests, services/api 52 tests, and scripts/ops smoke workflow 2 tests; root `pnpm run build` passed across shared, API, and admin.
Result: pass
Follow-up issue: This defines the shared error vocabulary but does not yet move every route response through the typed contract or solve assignment transaction/RPC atomicity.
```

### Closed-beta smoke regression coverage

```text
Date/time: 2026-07-18 03:02
Timezone: America/New_York
Runner: Codex
Scope: NB-02/NB-09 closed-beta workflow smoke regression coverage slice
Change: Added scripts/ops/test/smoke-beta-workflow.test.mjs and wired the root test script to run it after workspace tests. The regression starts a local mock API and proves smoke preflight is non-mutating, parses patient/nurse/admin roles correctly, prints support-ready requestId traces, and does not expose bearer tokens. A second test proves mutating production smoke is blocked unless explicit approval is represented by ALLOW_PRODUCTION_SMOKE=1. Added the test file to the guarded VM package and sync handoff docs.
Files: package.json, scripts/ops/test/smoke-beta-workflow.test.mjs, scripts/ops/verify-vm-stage-package.mjs, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/current-build-status.md, docs/release/beta-evidence-log.md
Verification: Locally, the focused smoke workflow regression passed with 2 tests when run against a local mock API with the bundled Node runtime; local NurseBridges identity verification passed across 93 files; local VM staged-package verification passed for 60 staged files; no local node_modules remained after cleanup. On the VM, NurseBridges identity verification passed across 95 files; VM staged-package verification passed for 60 staged files; root `pnpm test` passed with packages/shared 5 tests, apps/mobile 17 tests, apps/admin 14 tests, services/api 52 tests, and scripts/ops smoke workflow 2 tests; root `pnpm verify` passed; root `pnpm run build` passed across shared, API, and admin.
Result: pass
Follow-up issue: This protects the smoke tool itself, but the approved mutating closed-beta workflow smoke and real-device create-request proof are still required.
```

### Closed-beta smoke request trace output

```text
Date/time: 2026-07-18 02:57
Timezone: America/New_York
Runner: Codex
Scope: NB-02/NB-09 closed-beta workflow smoke evidence-capture slice
Change: Updated scripts/ops/smoke-beta-workflow.sh so successful API calls and expected rejection checks print method, path, status, and requestId to stderr while preserving JSON response bodies on stdout for script parsing. Updated the closed-beta operator runbook to tell operators to save approved smoke output and copy request IDs into the evidence log without exposing tokens or private care details.
Files: scripts/ops/smoke-beta-workflow.sh, docs/release/closed-beta-operator-runbook.md, docs/release/current-build-status.md, docs/release/beta-evidence-log.md
Verification: Locally, `bash -n scripts/ops/smoke-beta-workflow.sh` passed, `scripts/ops/smoke-beta-workflow.sh --help` passed, a local mock `--preflight` run printed requestId trace lines for health and patient/nurse/admin role checks without creating or mutating requests, NurseBridges identity verification passed across 92 files, and VM staged-package verification passed for 59 staged files. On the VM, `bash -n scripts/ops/smoke-beta-workflow.sh` passed, `scripts/ops/smoke-beta-workflow.sh --help` passed, NurseBridges identity verification passed across 94 files, and VM staged-package verification passed for 59 staged files.
Result: pass
Follow-up issue: This prepares evidence capture for the approved workflow smoke, but no mutating smoke or real-device workflow proof was run.
```

### Closed-beta smoke preflight hardening

```text
Date/time: 2026-07-18 02:54
Timezone: America/New_York
Runner: Codex
Scope: NB-02/NB-09 closed-beta workflow smoke operator-safety slice
Change: Hardened scripts/ops/smoke-beta-workflow.sh with explicit --preflight and --help modes, required command checks, API base URL normalization, a non-mutating API health check, token role validation before mutation, and production gating that still refuses mutating production smoke unless ALLOW_PRODUCTION_SMOKE=1 is set after owner approval. Added the smoke script to the guarded VM package so future VM sync verification cannot omit the beta workflow proof tool.
Files: scripts/ops/smoke-beta-workflow.sh, scripts/ops/verify-vm-stage-package.mjs, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/current-build-status.md, docs/release/beta-evidence-log.md
Verification: Locally, `bash -n scripts/ops/smoke-beta-workflow.sh` passed, `scripts/ops/smoke-beta-workflow.sh --help` passed, NurseBridges identity verification passed across 92 files, and VM staged-package verification passed for 59 staged files. On the VM, `bash -n scripts/ops/smoke-beta-workflow.sh` passed, `scripts/ops/smoke-beta-workflow.sh --help` passed, NurseBridges identity verification passed across 94 files, and VM staged-package verification passed for 59 staged files.
Result: pass
Follow-up issue: This improves smoke-test readiness but does not replace the required real-device create-request proof or approved controlled workflow smoke.
```

### Mobile action error references

```text
Date/time: 2026-07-18 04:10
Timezone: America/New_York
Runner: Codex
Scope: NB-03/NB-04 mobile support-ready action error slice
Change: Reused the existing tested mobile API error formatter for additional mobile workflow actions. Nurse apply, patient/nurse cancel/complete, notification update actions, and verification metadata save failures now preserve server/mobile request references when the API returns them, so Copy issue details can carry support-ready debugging context beyond create-request submission.
Files: apps/mobile/App.tsx, docs/release/current-build-status.md, docs/release/beta-evidence-log.md
Verification: On the VM, NurseBridges identity verification passed across 94 files; VM staged-package verification passed for 58 staged files; apps/mobile typecheck passed; apps/mobile tests passed with 17 tests; root `pnpm verify` passed; packages/shared tests passed with 5 tests against compiled dist/workflow.js; services/api tests passed with 52 tests; apps/admin tests passed with 14 tests; root `pnpm run build` passed across shared, API, and admin.
Result: pass
Follow-up issue: Real-device action proof remains required; this improves failure capture but does not replace installed-device workflow testing.
```

### Mobile nurse apply eligibility

```text
Date/time: 2026-07-18 03:55
Timezone: America/New_York
Runner: Codex
Scope: NB-04 nurse open-request eligibility UI slice
Change: Added tested mobile nurse apply eligibility helpers. The mobile app now shows the apply action only when the nurse is approved, the request is open, and the nurse has no existing application state. Existing applications display nurse-facing state labels such as Application sent, Assigned to you, Not selected, or Application withdrawn instead of a disabled apply button.
Files: apps/mobile/App.tsx, apps/mobile/src/workflow.ts, apps/mobile/test/workflow.test.ts, docs/release/current-build-status.md, docs/release/beta-evidence-log.md
Verification: On the VM, NurseBridges identity verification passed across 94 files; VM staged-package verification passed for 58 staged files; apps/mobile typecheck passed; apps/mobile tests passed with 17 tests including approved/open/no-existing-application apply eligibility and nurse-facing application state labels; root `pnpm verify` passed; packages/shared tests passed with 5 tests against compiled dist/workflow.js; services/api tests passed with 52 tests; apps/admin tests passed with 14 tests; root `pnpm run build` passed across shared, API, and admin.
Result: pass
Follow-up issue: Real-device nurse apply proof remains required after installed-device create-request proof and controlled approved-nurse account setup.
```

### Mobile create-request form clarity

```text
Date/time: 2026-07-18 03:38
Timezone: America/New_York
Runner: Codex
Scope: NB-03 patient create-request form clarity and payload guard slice
Change: Added tested mobile create-request payload validation in apps/mobile/src/workflow.ts. The helper trims and normalizes care-request fields, returns patient-safe validation errors, and proves the mobile client does not send patient_user_id, patient_id, or created_by ownership fields. The patient form now uses that helper and shows visible labels for support type/title, care details, location, requested date/time, and optional hourly rate instead of relying only on placeholders.
Files: apps/mobile/App.tsx, apps/mobile/src/workflow.ts, apps/mobile/test/workflow.test.ts, docs/release/current-build-status.md, docs/release/beta-evidence-log.md
Verification: On the VM, NurseBridges identity verification passed across 94 files; VM staged-package verification passed for 58 staged files; apps/mobile typecheck passed; apps/mobile tests passed with 15 tests including create-request payload ownership and validation coverage; root `pnpm verify` passed; packages/shared tests passed with 5 tests against compiled dist/workflow.js; services/api tests passed with 52 tests; apps/admin tests passed with 14 tests; root `pnpm run build` passed across shared, API, and admin.
Result: pass
Follow-up issue: Installed-device create-request proof remains required; this improves clarity and payload safety but does not replace the real iOS/Android create-request attempt.
```

### Mobile care-request language polish

```text
Date/time: 2026-07-18 03:22
Timezone: America/New_York
Runner: Codex
Scope: NB-03/NB-04 mobile workflow UX language slice
Change: Added tested mobile workflow copy helpers for care-request status labels, patient/nurse empty states, and request progress summaries. Updated the mobile app to use patient-safe care request language instead of internal job language in high-visibility notices, errors, request empty states, status summaries, and admin/nurse copy. This keeps the UI aligned with the serious closed-beta care coordination experience without starting a broad redesign before installed-device create-job proof.
Files: apps/mobile/App.tsx, apps/mobile/src/theme.ts, apps/mobile/src/workflow.ts, apps/mobile/test/workflow.test.ts, scripts/ops/verify-vm-stage-package.mjs, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification: On the VM, NurseBridges identity verification passed across 94 files; VM staged-package verification passed for 58 staged files; apps/mobile typecheck passed; apps/mobile tests passed with 13 tests including patient-safe care request copy coverage; root `pnpm verify` passed; packages/shared tests passed with 5 tests against compiled dist/workflow.js; services/api tests passed with 52 tests; apps/admin tests passed with 14 tests; root `pnpm run build` passed across shared, API, and admin.
Result: pass
Follow-up issue: Broader role-based mobile navigation/redesign still waits on installed-device create-job proof unless a UI change directly unblocks workflow proof.
```

### API assignment command boundary

```text
Date/time: 2026-07-18 03:03
Timezone: America/New_York
Runner: Codex
Scope: NB-08 API command-boundary consolidation, assignment finalization slice
Change: Added services/api/src/jobAssignmentCommand.ts as the shared API command for finalizing assignment after route-level authorization and validation. API admin assignment and patient application acceptance now both use the same sequence to read rejection recipients, claim the open job, accept the selected application, reject competing applied applications, and notify affected nurses. Route tests were updated to prove both paths use the shared selected-application update shape and preserve stale-failure behavior.
Files: services/api/src/jobAssignmentCommand.ts, services/api/src/routes/adminAssignmentRoute.ts, services/api/src/routes/applicationDecisionRoute.ts, services/api/test/adminAssignmentRoute.test.ts, services/api/test/applicationDecisionRoute.test.ts, scripts/ops/verify-vm-stage-package.mjs, docs/release/implementation-backlog.md, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification: On the VM, NurseBridges identity verification passed across 94 files; VM staged-package verification passed for 57 staged files; focused services/api admin-assignment and application-decision route coverage passed and the full API suite passed with 52 tests; root `pnpm verify` passed; packages/shared tests passed with 5 tests against compiled dist/workflow.js; apps/mobile tests passed with 12 tests; apps/admin tests passed with 14 tests; root `pnpm run build` passed across shared, API, and admin.
Result: pass
Follow-up issue: This creates one API command boundary for assignment finalization but is not yet a database transaction/RPC; full assignment atomicity remains required before broader beta.
```

### Patient application decision audit

```text
Date/time: 2026-07-18 02:45
Timezone: America/New_York
Runner: Codex
Scope: NB-08 trust-sensitive application decision audit slice
Change: Added a production-wired audit dependency to the API patient application decision route. The mounted applications route now passes the production audit writer into the decision route, and successful patient accept/reject decisions write a structured application_decision audit row after the guarded decision succeeds. Route regression coverage now proves accepted and rejected decisions audit the patient decision, while stale accept failures still avoid application mutations, notifications, and audit rows.
Files: services/api/src/audit.ts, services/api/src/routes/applications.ts, services/api/src/routes/applicationDecisionRoute.ts, services/api/test/applicationDecisionRoute.test.ts, scripts/ops/verify-vm-stage-package.mjs, docs/release/implementation-backlog.md, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification: On the VM, NurseBridges identity verification passed across 94 files; VM staged-package verification passed for 56 staged files; focused services/api application-decision route coverage passed and the full API suite passed with 52 tests; root `pnpm verify` passed; packages/shared tests passed with 5 tests against compiled dist/workflow.js; apps/mobile tests passed with 12 tests; apps/admin tests passed with 14 tests; root `pnpm run build` passed across shared, API, and admin.
Result: pass
Follow-up issue: Full assignment atomicity still needs a database transaction/RPC or one canonical command boundary before broader beta.
```

### Shared assignment planning

```text
Date/time: 2026-07-18 02:19
Timezone: America/New_York
Runner: Codex
Scope: NB-08 command-boundary consolidation, shared assignment intent slice
Change: Added shared pure assignment helpers to @nursebridge/shared/workflow for selected-application planning, rejected-nurse recipient planning, and assignment notification payload construction. API admin assignment and admin web assignment now consume the shared assignment plan; API patient application acceptance consumes the shared assignment notification builder. Shared tests now verify assignment planning and notification payloads against compiled dist/workflow.js.
Files: packages/shared/src/workflow.ts, packages/shared/test/workflow.test.ts, services/api/src/jobWorkflow.ts, services/api/src/routes/adminAssignmentRoute.ts, services/api/src/routes/applicationDecisionRoute.ts, apps/admin/lib/workflowRules.ts, apps/admin/lib/jobAssignmentActionsCore.ts, docs/release/implementation-backlog.md, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification: On the VM, NurseBridges identity verification passed across 94 files; VM staged-package verification passed for 54 staged files; root `pnpm verify` passed; packages/shared tests passed with 5 tests against compiled dist/workflow.js; services/api tests passed with 51 tests; apps/mobile tests passed with 12 tests; apps/admin tests passed with 14 tests; root `pnpm run build` passed across shared, API, and admin.
Result: pass
Follow-up issue: Full assignment atomicity still needs a database transaction/RPC or one canonical command boundary before broader beta.
```

### Assignment stale-write hardening

```text
Date/time: 2026-07-18 02:12
Timezone: America/New_York
Runner: Codex
Scope: NB-08 assignment consistency hardening, partial-atomicity slice
Change: Reordered API admin assignment, patient application acceptance, and admin web assignment paths so the guarded job assignment write claims an open job before application statuses are accepted/rejected. Added regression tests proving stale job assignment failures do not mutate application rows and do not send notifications or audit rows. This reduces stale-job partial-write risk but does not replace the planned database transaction/RPC assignment gate.
Files: services/api/src/routes/adminAssignmentRoute.ts, services/api/src/routes/applicationDecisionRoute.ts, services/api/test/adminAssignmentRoute.test.ts, services/api/test/applicationDecisionRoute.test.ts, apps/admin/lib/jobAssignmentActionsCore.ts, apps/admin/test/jobAssignmentActionsCore.test.ts, scripts/ops/verify-vm-stage-package.mjs, docs/release/implementation-backlog.md, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification: On the VM, `pnpm install --frozen-lockfile` passed; NurseBridges identity verification passed across 94 files; VM staged-package verification passed for 54 staged files; root `pnpm verify` passed; services/api tests passed with 51 tests including stale assignment failure coverage for admin assignment and patient application acceptance; packages/shared tests passed with 3 tests; apps/mobile tests passed with 12 tests; apps/admin tests passed with 14 tests including stale assignment failure coverage; root `pnpm run build` passed across shared, API, and admin.
Result: pass
Follow-up issue: Full assignment atomicity still needs a database transaction/RPC or one canonical command boundary before broader beta.
```

### API workflow predicate consolidation

```text
Date/time: 2026-07-18 02:04
Timezone: America/New_York
Runner: Codex
Scope: NB-08 workflow source-of-truth consolidation, Fastify API pure predicate slice
Change: Reconciled the VM's full services/api workflow helper and package manifest into the guarded local package. Added @nursebridge/shared as an API workspace dependency and changed services/api/src/jobWorkflow.ts to re-export canonical pure predicates and JobStatus from @nursebridge/shared/workflow. This removes duplicate pure workflow predicate implementations across API, admin, and mobile without changing API route orchestration.
Files: services/api/package.json, services/api/src/jobWorkflow.ts, pnpm-lock.yaml, scripts/ops/verify-vm-stage-package.mjs, docs/architecture/workflow-source-of-truth.md, docs/release/implementation-backlog.md, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification: On the VM, `pnpm install --frozen-lockfile` passed; NurseBridges identity verification passed across 94 files; VM staged-package verification passed for 50 staged files; root `pnpm verify` passed; services/api typecheck passed; services/api tests passed with 49 tests; packages/shared tests passed with 3 tests against compiled dist/workflow.js; apps/mobile tests passed with 12 tests; apps/admin tests passed with 13 tests; root `pnpm run build` passed across shared, API, and admin.
Result: pass
Follow-up issue: NB-08 remains open for API/admin command-boundary consolidation and assignment atomicity.
```

### Shared workflow runtime output

```text
Date/time: 2026-07-18 02:00
Timezone: America/New_York
Runner: Codex
Scope: NB-08 workflow source-of-truth consolidation, production-safe shared runtime output
Change: Updated @nursebridge/shared to build compiled ESM output under dist/, expose runtime-safe package exports for Node/import consumers, and run shared workflow tests against compiled dist/workflow.js. Updated root typecheck/build and admin build scripts so shared runtime output is generated before workspace typecheck/build paths that consume it.
Files: package.json, packages/shared/package.json, packages/shared/tsconfig.json, packages/shared/test/workflow.test.ts, apps/admin/package.json, docs/architecture/workflow-source-of-truth.md, docs/release/implementation-backlog.md, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification: On the VM, `pnpm install --frozen-lockfile` passed; NurseBridges identity verification passed across 94 files; VM staged-package verification passed for 48 staged files; shared compiled runtime import from dist/workflow.js passed; root `pnpm verify` passed; services/api tests passed with 49 tests; packages/shared tests passed with 3 tests against compiled dist/workflow.js; apps/mobile tests passed with 12 tests; apps/admin tests passed with 13 tests; root `pnpm run build` passed across shared, API, and admin.
Result: pass
Follow-up issue: NB-08 remains open. Reconcile the Fastify API from the VM's full source and move pure workflow predicates onto the shared runtime path, then consolidate API/admin command behavior and make assignment atomic.
```

### Shared workflow predicate package

```text
Date/time: 2026-07-18 01:49
Timezone: America/New_York
Runner: Codex
Scope: NB-08 workflow source-of-truth consolidation, shared pure predicate slice
Change: Added packages/shared/src/workflow.ts as the canonical pure job/application workflow predicate module with direct shared tests. Updated packages/shared exports and test script. Rewired apps/admin/lib/workflowRules.ts and apps/mobile/src/workflow.ts to consume @nursebridge/shared/workflow while preserving existing adapter/helper names. Added workspace dependencies for admin and mobile and updated the lockfile. The API intentionally keeps its runtime-local workflow adapter until @nursebridge/shared has a production-safe JavaScript build/export path for plain Node runtime imports.
Files: packages/shared/package.json, packages/shared/src/index.ts, packages/shared/src/types.ts, packages/shared/src/workflow.ts, packages/shared/test/workflow.test.ts, apps/admin/package.json, apps/admin/lib/workflowRules.ts, apps/mobile/package.json, apps/mobile/src/workflow.ts, pnpm-lock.yaml, docs/architecture/workflow-source-of-truth.md, docs/release/implementation-backlog.md, docs/release/beta-evidence-log.md
Verification: On the VM, `pnpm install --frozen-lockfile` passed; root `pnpm verify` passed; packages/shared tests passed with 3 tests; services/api tests passed with 49 tests; apps/mobile tests passed with 12 tests; apps/admin tests passed with 13 tests; apps/admin production build passed.
Result: pass
Follow-up issue: Superseded by the later shared workflow runtime output entry. NB-08 remains open for API predicate reconciliation, API/admin command-boundary consolidation, and assignment atomicity.
```

### VM iOS preflight command sync

```text
Date/time: 2026-07-18 01:42
Timezone: America/New_York
Runner: Codex
Scope: VM command-surface alignment for installed iOS proof
Change: Synced apps/mobile/package.json, verify-ios-release-readiness.mjs, verify-ios-install-preflight.mjs, staged-package guard updates, and related handoff/readiness docs to the VM so docs and runnable commands agree.
Files: apps/mobile/package.json, apps/mobile/scripts/verify-ios-release-readiness.mjs, apps/mobile/scripts/verify-ios-install-preflight.mjs, scripts/ops/verify-vm-stage-package.mjs, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md, docs/release/current-build-status.md, docs/release/iphone-create-job-capture-packet.md, docs/ops/mobile-beta-build-readiness.md
Verification: On the VM, NurseBridges identity verification passed across 94 files; VM staged-package verification passed for 39 staged files; apps/mobile typecheck passed; apps/mobile tests passed with 12 tests; root pnpm verify passed across API, mobile, admin, and shared workspaces.
Result: pass
Follow-up issue: The installed iOS proof still requires owner-machine signing/device readiness. Run `cd apps/mobile && pnpm run ios:install-preflight` locally after connecting/trusting the iPhone and restoring Apple signing/provisioning for com.nursebridges.mobile.
```

### iOS installed-build preflight

```text
Date/time: 2026-07-18 01:37
Timezone: America/New_York
Runner: Codex
Scope: local iOS installed-build readiness for com.nursebridges.mobile
Change: Added apps/mobile/scripts/verify-ios-install-preflight.mjs and package script ios:install-preflight. The script is read-only and checks source identity, Xcode availability, physical device visibility, code-signing identities, and provisioning profiles without running EAS, building, uploading, or changing credentials.
Files: apps/mobile/scripts/verify-ios-install-preflight.mjs, apps/mobile/scripts/verify-ios-release-readiness.mjs, apps/mobile/package.json, scripts/ops/verify-vm-stage-package.mjs, docs/ops/mobile-beta-build-readiness.md, docs/release/iphone-create-job-capture-packet.md, docs/release/current-build-status.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification: apps/mobile typecheck passed; apps/mobile tests passed with 12 tests; apps/mobile ios:release-check passed. `pnpm run ios:install-preflight` confirmed source identity and Xcode project identity for nursebridges / com.nursebridges.mobile, then failed with 3 blocking items: no physical iPhone/iPad visible to Xcode, no valid code-signing identity installed, and no provisioning profile referencing com.nursebridges.mobile.
Result: blocked for installed iOS proof
Follow-up issue: Resolve Apple/Xcode signing locally: connect/trust the owner iPhone, install or refresh an Apple Development signing identity for team R2N3CHKSBB, and create/download a development provisioning profile for com.nursebridges.mobile. Owner approval remains required before any EAS, TestFlight, app-store-connected, or credential-changing action.
```

### VM full verification baseline

```text
Date/time: 2026-07-18 00:43
Timezone: America/New_York
Runner: Codex
Scope: full VM repository verification before real-device workflow proof
Change: Ran the VM root verification command after guarded package sync and API contract verification. Also ran the admin production build to prove the synced dispatcher/admin app still compiles for production.
Files: package.json, services/api/*, apps/mobile/*, apps/admin/*, packages/shared/*
Verification: On the VM, `pnpm verify` passed: workspace lint placeholders completed, all workspace typechecks passed, services/api tests passed with 49 tests, apps/mobile tests passed with 12 tests, apps/admin tests passed with 13 tests, and packages/shared reported no tests. `apps/admin pnpm run build` passed and generated the Next.js production route map.
Result: pass
Follow-up issue: This proves repository/test/build coherence, not live workflow completion. The next required evidence is one installed-device patient create-request attempt and then the full patient -> nurse -> admin -> complete/cancel proof.
```

### VM API create-job contract verification

```text
Date/time: 2026-07-18 00:43
Timezone: America/New_York
Runner: Codex
Scope: VM API verification and read-only live create-job schema contract
Change: Verified the full VM API source state instead of the partial local services/api snapshot. Ran API typecheck, build, route/unit tests, and the read-only create-job contract check against Supabase REST schema metadata using the VM service-local API env.
Files: services/api/src/*, services/api/test/*, scripts/ops/check-create-job-contract.mjs, docs/release/beta-evidence-log.md
Verification: On the VM, services/api typecheck passed; services/api build passed; services/api tests passed with 49 tests; create-job contract check reported live jobs required fields created_at, created_by, id, status, title, updated_at and API insert payload fields address, created_by, description, hourly_rate, patient_id, patient_user_id, start_time, status, title. Result: create-job insert payload satisfies live jobs required-column contract.
Result: pass
Follow-up issue: Real-device create-job proof remains required. The next test should use an installed iOS build after signing/provisioning is resolved or recovered Android access, then inspect POST /jobs logs by request reference if it fails.
```

### Guarded VM package sync

```text
Date/time: 2026-07-18 00:43
Timezone: America/New_York
Runner: Codex
Scope: VM reconciliation, NurseBridges identity, mobile/admin workflow-rule parity
Change: Synced the guarded package from local vm-stage to /home/nurseapp/nursebridge using the nursebridge-vm SSH alias. Included plural mobile app config/assets/scripts, mobile workflow predicates/tests, admin workflow rule test slice, release/architecture/ops docs, and identity/package guards. Removed the superseded VM-only production roadmap file after confirming production-build-plan.md is the canonical plan.
Files: docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md, scripts/ops/verify-nursebridges-identity.mjs, scripts/ops/verify-vm-stage-package.mjs, apps/mobile/package.json, apps/mobile/app.config.ts, apps/mobile/assets/icon.png, apps/mobile/assets/splash.png, apps/mobile/scripts/verify-ios-release-readiness.mjs, apps/mobile/scripts/verify-ios-install-preflight.mjs, apps/mobile/src/workflow.ts, apps/mobile/test/workflow.test.ts, apps/admin/package.json, apps/admin/lib/workflowRules.ts, apps/admin/test/workflowRules.test.ts
Verification: On the VM, NurseBridges identity verification passed across 94 files; VM staged-package verification passed; apps/mobile typecheck passed; apps/mobile tests passed with 12 tests; apps/admin typecheck passed; apps/admin tests passed with 13 tests.
Result: pass
Follow-up issue: Real-device create-job proof remains the next production unlock. API work must reconcile from the VM's full API state, not local vm-stage/services/api.
```

### VM staged-package guard

```text
Date/time: 2026-07-18 00:43
Timezone: America/New_York
Runner: Codex
Scope: VM sync safety and partial API overwrite prevention
Change: Added scripts/ops/verify-vm-stage-package.mjs to verify that the staged VM package lists every intended file, runs identity and package guards, includes mobile config/assets plus helper/test verification, and refuses unsafe services/api sync instructions because the local API folder is partial. Extended the identity guard to fail if the superseded production roadmap file reappears.
Files: scripts/ops/verify-vm-stage-package.mjs, apps/mobile/app.config.ts, apps/mobile/assets/icon.png, apps/mobile/assets/splash.png, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/implementation-backlog.md, docs/release/beta-evidence-log.md
Verification: VM staged-package verification passed for 39 staged files; NurseBridges identity verification passed across 94 files on the VM.
Result: pass
Follow-up issue: Run the staged-package guard again on the VM after syncing before any API reconciliation, mobile beta build, or workflow proof.
```

### Mobile workflow predicate parity

```text
Date/time: 2026-07-18 00:43
Timezone: America/New_York
Runner: Codex
Scope: NB-08 workflow source-of-truth consolidation, mobile parity slice
Change: Added mobile lifecycle predicates for canonical job statuses, assignment eligibility, cancellation eligibility, completion eligibility, selectable applications, and terminal job states. Rewired mobile completion eligibility through the shared predicate so an assigned job without an accepted/assigned nurse signal does not expose completion.
Files: apps/mobile/src/workflow.ts, apps/mobile/test/workflow.test.ts, docs/release/implementation-backlog.md, docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification: apps/mobile typecheck passed; apps/mobile tests passed with 12 tests; NurseBridges identity verification passed across 89 files.
Result: pass
Follow-up issue: Extract API/admin/mobile workflow rules into a canonical package or API boundary after VM sync and real-device create-job proof; assignment still needs transactional handling before broader beta.
```

### VM handoff identity guard wiring

```text
Date/time: 2026-07-18 00:43
Timezone: America/New_York
Runner: Codex
Scope: VM sync discipline and app identity drift prevention
Change: Added scripts/ops/verify-nursebridges-identity.mjs to the VM sync handoff and engineering snapshot so the staged server copy includes the guard script and runs it during VM verification.
Files: docs/release/vm-sync-handoff.md, docs/release/engineering-state-snapshot.md, docs/release/beta-evidence-log.md
Verification: NurseBridges identity verification passed across 89 files. Text scan found stale singular bundle-id and production-roadmap literals only inside the guard script's own forbidden-list assertions.
Result: pass
Follow-up issue: Sync the staged package to /home/nurseapp/nursebridge when VM access is available, then run the guard on the VM before any beta build or workflow proof.
```

### NurseBridges identity guard

```text
Date/time: 2026-07-18 00:43
Timezone: America/New_York
Runner: Codex
Scope: app identity and production-track drift prevention
Change: Added scripts/ops/verify-nursebridges-identity.mjs to assert the canonical nursebridges slug/scheme, com.nursebridges.mobile bundle/package identity, production-build-plan references, and absence of stale singular bundle-id references in scanned app/docs/script files.
Files: scripts/ops/verify-nursebridges-identity.mjs, docs/release/beta-evidence-log.md
Verification: NurseBridges identity verification passed across 89 files; apps/mobile ios:release-check passed; apps/mobile tests passed with 12 tests; apps/admin tests passed with 13 tests.
Result: pass
Follow-up issue: Sync this guard onto the VM and run it there before beta build/workflow proof.
```

### Mobile workflow helper extraction

```text
Date/time: 2026-07-18 00:39
Timezone: America/New_York
Runner: Codex
Scope: mobile workflow source-of-truth, first UI helper slice
Change: Moved mobile cancel/complete eligibility and patient/nurse focus-job selection from App.tsx into apps/mobile/src/workflow.ts. Added direct tests for terminal action eligibility and focus-job selection.
Files: apps/mobile/src/workflow.ts, apps/mobile/App.tsx, apps/mobile/test/workflow.test.ts
Verification: apps/mobile typecheck passed; apps/mobile tests passed with 12 tests; pnpm run ios:release-check passed; xcodebuild Release iphoneos with CODE_SIGNING_ALLOWED=NO passed and validated bundle id com.nursebridges.mobile.
Result: pass
Follow-up issue: Real-device workflow proof still requires signed iPhone install/TestFlight or recovered Android access; full backend/admin/mobile canonical lifecycle consolidation remains open.
```

### Admin workflow rule extraction

```text
Date/time: 2026-07-18 00:39
Timezone: America/New_York
Runner: Codex
Scope: NB-08 workflow source-of-truth consolidation, first admin slice
Change: Extracted shared admin workflow predicates for assign, cancel, complete, application selection, and terminal job status into apps/admin/lib/workflowRules.ts. Updated admin assignment and terminal-action helpers to use the shared rules. Added direct workflow rule regression coverage.
Files: apps/admin/lib/workflowRules.ts, apps/admin/lib/jobAssignmentActionsCore.ts, apps/admin/lib/jobTerminalActionsCore.ts, apps/admin/test/workflowRules.test.ts, apps/admin/package.json
Verification: apps/admin typecheck passed; apps/admin regression tests passed with 13 tests; apps/admin Next production build passed.
Result: pass
Follow-up issue: Full API/admin lifecycle source-of-truth consolidation remains open before broader beta; assignment still needs stronger transactional handling or canonical API/RPC boundary.
```

### Admin dispatcher triage lane

```text
Date/time: 2026-07-18 00:36
Timezone: America/New_York
Runner: Codex
Scope: admin web dispatcher console
Change: Added operational triage lanes for requests needing assignment and active assigned care, applicant summaries, dispatcher priority labels, and corrected the ops gate copy to use com.nursebridges.mobile.
Files: apps/admin/app/page.tsx, apps/admin/app/globals.css
Verification: apps/admin typecheck passed; apps/admin regression tests passed; apps/admin Next production build passed; stale singular bundle-id search passed in checked app/docs paths.
Result: pass
Follow-up issue: Live admin workflow proof still requires VM deployment/env and controlled admin account testing.
```

### Mobile role-based next-action UI slice

```text
Date/time: 2026-07-18 00:33
Timezone: America/New_York
Runner: Codex
Scope: mobile patient/nurse/admin experience foundation
Change: Added role-specific next-action panels, patient/nurse focus request summaries, latest-update context, lifecycle helper checks, and confirmation prompts before cancel/complete terminal actions. Kept existing API contracts and com.nursebridges.mobile build identity unchanged.
Files: apps/mobile/App.tsx
Verification: apps/mobile typecheck passed; apps/mobile tests passed; pnpm run ios:release-check passed; xcodebuild Release iphoneos with CODE_SIGNING_ALLOWED=NO passed and validated bundle id com.nursebridges.mobile.
Result: pass
Follow-up issue: Real-device UX proof still requires signed iPhone install/TestFlight or recovered Android access.
```

### NurseBridges plural app identity alignment

```text
Date/time: 2026-07-18 00:24
Timezone: America/New_York
Runner: Codex
Scope: iOS/app-store identity correction
Owner correction: App identity is nursebridges with the s.
Change: Updated Expo slug/scheme, iOS bundle identifier, Android package, native iOS URL schemes, Xcode product bundle identifier, Xcode development team, and release-readiness assertions to use com.nursebridges.mobile.
Files: apps/mobile/app.config.ts, apps/mobile/ios/NurseBridge/Info.plist, apps/mobile/ios/NurseBridge.xcodeproj/project.pbxproj, apps/mobile/scripts/verify-ios-release-readiness.mjs
Verification: pnpm run ios:repair passed; pnpm run ios:release-check passed; mobile typecheck passed; mobile tests passed; xcodebuild Release iphoneos with CODE_SIGNING_ALLOWED=NO passed and validated bundle id com.nursebridges.mobile.
Result: pass
Follow-up issue: Signed iPhone install remains blocked because Xcode still has no authenticated account for team R2N3CHKSBB and no development provisioning profile for com.nursebridges.mobile.
```

### Admin dispatcher console foundation

```text
Date/time: 2026-07-18
Timezone: America/New_York
Runner: Codex
Scope: admin web dispatcher console
Change: Added Next.js App Router shell, dispatcher request queue, verification queue, audit panel, ops status panel, admin auth/request-id/push helpers required by existing API routes, and safe Supabase admin config handling for local builds.
Files: apps/admin/app/page.tsx, apps/admin/app/layout.tsx, apps/admin/app/globals.css, apps/admin/lib/adminDashboardData.ts, apps/admin/lib/adminAuth.ts, apps/admin/lib/requestId.ts, apps/admin/lib/push.ts, apps/admin/lib/supabaseAdmin.ts, apps/admin/tsconfig.json
Verification: apps/admin typecheck passed; apps/admin tests passed; apps/admin Next production build passed.
Result: pass
Follow-up issue: Live admin evidence still requires Supabase service-role env on the VM and controlled admin account workflow proof.
```

### iOS TestFlight configuration hardening

```text
Date/time: 2026-07-17 23:55
Timezone: America/New_York
Runner: Codex
Scope: iOS/TestFlight build configuration and app identity
Change: Added app icon and splash assets, wired Expo icon/splash/adaptive icon config, added physical iOS internal and iOS TestFlight EAS profiles, removed the simulator-only iOS preview blocker, added an idempotent iOS native repair script, aligned app/package/Xcode version to 0.1.0 build 1, added export option plists, and added a release-readiness verifier.
Files: apps/mobile/app.config.ts, apps/mobile/eas.json, apps/mobile/assets/icon.png, apps/mobile/assets/splash.png, apps/mobile/scripts/repair-ios-native-project.mjs, apps/mobile/scripts/verify-ios-release-readiness.mjs, apps/mobile/package.json, apps/mobile/ios/ExportOptions.development.plist, apps/mobile/ios/ExportOptions.testflight.plist
Verification: pnpm run ios:repair passed; pnpm run ios:release-check passed; expo config resolved; plist lint passed; asset dimensions verified; mobile typecheck passed; mobile tests passed; xcodebuild Debug iphoneos with CODE_SIGNING_ALLOWED=NO passed; xcodebuild Release iphoneos with CODE_SIGNING_ALLOWED=NO passed.
Result: pass
Follow-up issue: Signed iPhone install/TestFlight remains blocked by Apple account/provisioning for team R2N3CHKSBB and bundle com.nursebridges.mobile.
```

### Native iOS Xcode build proof

```text
Date/time: 2026-07-17 23:42
Timezone: America/New_York
Runner: Codex
Scope: local native iOS build path
Reviewed: apps/mobile/app.config.ts, apps/mobile/ios, CocoaPods, Xcode workspace
Change: Generated native iOS project, installed Pods, patched Xcode 27 deployment target handling, patched generated scripts for the local folder path with a space, and completed a first serious mobile UI pass.
Verification: apps/mobile typecheck passed; apps/mobile tests passed; xcodebuild Debug iphoneos with CODE_SIGNING_ALLOWED=NO passed.
Result: pass
Artifact: /private/tmp/nursebridge-xcodebuild/Build/Products/Debug-iphoneos/NurseBridge.app
Follow-up issue: Signed iPhone install/TestFlight is blocked by missing authenticated Apple account/provisioning profile for team R2N3CHKSBB and bundle com.nursebridges.mobile.
```

### Signed iPhone build attempt

```text
Date/time: 2026-07-17
Timezone: America/New_York
Runner: Codex
Scope: local physical iPhone build signing check
Device/platform: kossivi’s iPhone, iPhone 16 Pro Max
Bundle id: com.nursebridges.mobile
Team attempted: R2N3CHKSBB
Result: blocked
Blocking errors: No Account for Team "R2N3CHKSBB"; no development provisioning profile for "com.nursebridges.mobile".
Follow-up issue: Add/sign in to the Apple Developer account in Xcode or provide the correct team/profile path before device install or TestFlight.
```

### iOS internal build readiness review

```text
Date/time: 2026-07-17
Timezone: America/New_York
Runner: Codex
Scope: iOS installed-build proof readiness
Reviewed: apps/mobile/eas.json, apps/mobile/app.config.ts, apps/mobile/package.json
Finding: Expo Go/LAN proof is retired; current preview iOS EAS profile targets simulator and is not suitable for owner iPhone installation.
Evidence link: docs/release/ios-internal-build-readiness-review-2026-07-17.md
Result: build not approved; readiness gaps documented
Follow-up issue: Owner approval and physical-device iOS internal/TestFlight profile review required before any EAS build.
```

### Physical-device API fallback

```text
Date/time: 2026-07-17
Timezone: America/New_York
Runner: Codex
Scope: mobile API environment selection
Change: Physical iPhone and Android devices now fall back from stored localhost API URLs to the configured tunnel/API base.
Files: apps/mobile/src/envCore.ts, apps/mobile/test/workflow.test.ts
Verification: mobile tests pass; mobile typecheck passes
Result: pass
Follow-up issue: Real iPhone create-request proof still pending approval-gated installed iOS/TestFlight build or recovered Android access.
```

### Retired iPhone Expo test launcher

```text
Date/time: 2026-07-17
Timezone: America/New_York
Runner: Codex
Scope: local iPhone engineering proof setup
Change: Added scripts/ops/start-iphone-expo-test.sh to check connected iPhone, detect missing Expo Go, resolve the Expo LAN URL dynamically when possible, print a direct-open `xcrun devicectl` command, and start the Expo LAN server when ready.
Verification: local syntax check passed; local run detected connected iPhone; VM syntax check passed; repeated QR/LAN attempts did not provide reliable proof.
Result: retired
Follow-up issue: Stop retrying Expo Go/LAN; use approval-gated installed iOS/TestFlight build or recovered Android access.
```

## Entry Template

Copy this block for each verification event:

```text
Date/time:
Timezone:
Tester:
Role:
Device/platform:
App/build:
Environment:
Workflow:
Request ID:
Job ID:
Expected:
Actual:
Result:
Evidence link or note:
Follow-up issue:
```

## Create-Job Debug Evidence

Record the first fresh real-device create-job attempt after the backend payload fix.
Use `docs/ops/mobile-beta-build-readiness.md` for the internal iOS/TestFlight path and `docs/release/android-create-job-capture-packet.md` for the Android recheck.

```text
Date/time:
Timezone:
Tester:
Role: patient
Device/platform:
App/build:
Environment:
Workflow: patient create care request
Copied issue reference:
Watcher command:
Log event:
Request ID:
HTTP status:
Root cause:
Fix commit/change:
Regression test:
Result:
Follow-up issue:
```

## Workflow Smoke Evidence

Record each approved smoke run.

```text
Date/time:
Timezone:
Runner:
Environment:
Production approval:
Command:
Patient account:
Nurse account:
Admin account:
Completion job ID:
Cancellation job ID:
Result:
Failures:
Follow-up issue:
```

Smoke run must verify:

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
- nurse cannot cancel patient request

## Real-Device Workflow Evidence

### Patient iPhone

```text
Date/time:
Tester:
Device:
App/build: internal iOS/TestFlight build
Patient account:
Create request:
List request:
Cancel request:
Complete assigned request:
Notifications visible:
Result:
Follow-up issue:
```

### Patient Android

```text
Date/time:
Tester:
Device:
App/build:
Patient account:
Create request:
List request:
Cancel request:
Complete assigned request:
Notifications visible:
Result:
Follow-up issue:
```

### Nurse iPhone

```text
Date/time:
Tester:
Device:
App/build: internal iOS/TestFlight build
Nurse account:
Verification status:
View requests:
Apply to open request:
Complete assigned request:
Notifications visible:
Result:
Follow-up issue:
```

### Nurse Android

```text
Date/time:
Tester:
Device:
App/build:
Nurse account:
Verification status:
View requests:
Apply to open request:
Complete assigned request:
Notifications visible:
Result:
Follow-up issue:
```

### Admin Web

```text
Date/time:
Tester:
Browser/device:
Admin account:
Request queue visible:
Applicant list visible:
Assignment action:
Cancel action:
Complete action:
Audit evidence:
Result:
Follow-up issue:
```

## Notification Evidence

```text
Date/time:
Tester:
Device/platform:
Trigger:
In-app notification:
Push notification:
Notification row/request ID:
Result:
Follow-up issue:
```

## Nurse Verification Upload Evidence

```text
Date/time:
Tester:
Device:
Nurse account:
Document type:
Metadata created:
Signed upload succeeded:
Private bucket confirmed:
Admin review visible:
Approval/rejection notification:
Result:
Follow-up issue:
```

## Security/Ops Evidence

### Beta Access Rules

```text
Date/time:
Owner:
Cloudflare Access rule checked:
Allowed tester group:
Admin access rule:
Result:
Follow-up issue:
```

### Monitoring Owner

```text
Date/time:
Owner:
Beta monitoring window:
Primary responder:
Escalation path:
Expected response time:
Result:
Follow-up issue:
```

### Restore Drill

```text
Date/time:
Owner:
Source:
Target non-production project:
Schema backup command:
Restore command:
Non-sensitive seed data:
Result:
Follow-up issue:
```

## Legal/Consent Evidence

```text
Date/time:
Owner:
Document:
Review status:
Approved beta language:
Link/path:
Result:
Follow-up issue:
```
