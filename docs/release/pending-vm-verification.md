# Pending VM Verification

This file records the exact verification gap left by the API terminal RPC finalizer contract slice.

## Current Pending Slice

The 131-file staged package adds the review-only API terminal RPC finalizer contract, build status command and regression test, Android install preflight guard, admin/API boundary readiness guard, closed-beta go/no-go packet, evidence templates, access and secrets readiness guard, API log hygiene guard, beta gate guard, beta operations readiness guard, canonical assignment readiness guard, in-app consent readiness guard, legal and consent readiness guard, production sequence readiness guard, release-doc link guard, mobile secret hygiene guard, mobile support snapshot guard, NurseBridge isolation guard, notification and audit privacy guard, private document path hygiene guard, real-device proof readiness guard, restore drill readiness guard, RPC SQL safety guard, workflow atomicity readiness guard, workflow smoke readiness guard, and trust-language guard:

- `services/api/src/jobTerminalCommand.ts`
- `services/api/test/jobTerminalCommand.test.ts`
- `services/api/package.json`
- `scripts/ops/verify-vm-stage-package.mjs`
- `scripts/ops/show-build-status.mjs`
- release/status docs
- `docs/release/closed-beta-go-no-go.md`
- `docs/release/beta-evidence-templates.md`
- `docs/ops/observability.md`
- `scripts/ops/check-admin-api-boundary-readiness.mjs`
- `scripts/ops/test/check-admin-api-boundary-readiness.test.mjs`
- `scripts/ops/check-api-log-hygiene.mjs`
- `scripts/ops/test/check-api-log-hygiene.test.mjs`
- `scripts/ops/check-access-and-secrets-readiness.mjs`
- `scripts/ops/test/check-access-and-secrets-readiness.test.mjs`
- `scripts/ops/check-canonical-assignment-readiness.mjs`
- `scripts/ops/test/check-canonical-assignment-readiness.test.mjs`
- `scripts/ops/check-beta-gates.mjs`
- `scripts/ops/test/check-beta-gates.test.mjs`
- `scripts/ops/check-beta-ops-readiness.mjs`
- `scripts/ops/test/check-beta-ops-readiness.test.mjs`
- `scripts/ops/check-in-app-consent-readiness.mjs`
- `scripts/ops/test/check-in-app-consent-readiness.test.mjs`
- `scripts/ops/check-release-doc-links.mjs`
- `scripts/ops/test/check-release-doc-links.test.mjs`
- `scripts/ops/check-legal-consent-readiness.mjs`
- `scripts/ops/test/check-legal-consent-readiness.test.mjs`
- `scripts/ops/check-mobile-secret-hygiene.mjs`
- `scripts/ops/test/check-mobile-secret-hygiene.test.mjs`
- `scripts/ops/check-mobile-support-snapshot.mjs`
- `scripts/ops/test/check-mobile-support-snapshot.test.mjs`
- `scripts/ops/check-nursebridge-isolation.mjs`
- `scripts/ops/test/check-nursebridge-isolation.test.mjs`
- `scripts/ops/check-notification-audit-privacy.mjs`
- `scripts/ops/test/check-notification-audit-privacy.test.mjs`
- `scripts/ops/check-private-document-path-hygiene.mjs`
- `scripts/ops/test/check-private-document-path-hygiene.test.mjs`
- `scripts/ops/check-production-sequence-readiness.mjs`
- `scripts/ops/test/check-production-sequence-readiness.test.mjs`
- `scripts/ops/check-real-device-proof-readiness.mjs`
- `scripts/ops/test/check-real-device-proof-readiness.test.mjs`
- `scripts/ops/check-restore-drill-readiness.mjs`
- `scripts/ops/test/check-restore-drill-readiness.test.mjs`
- `scripts/ops/check-rpc-sql-safety.mjs`
- `scripts/ops/test/check-rpc-sql-safety.test.mjs`
- `scripts/ops/check-workflow-smoke-readiness.mjs`
- `scripts/ops/test/check-workflow-smoke-readiness.test.mjs`
- `scripts/ops/check-workflow-atomicity-readiness.mjs`
- `scripts/ops/test/check-workflow-atomicity-readiness.test.mjs`
- `scripts/ops/check-trust-language.mjs`
- `scripts/ops/test/check-trust-language.test.mjs`
- `scripts/ops/test/show-build-status.test.mjs`
- `apps/mobile/scripts/verify-android-install-preflight.mjs`
- `apps/mobile/src/screens/ApiTestScreen.tsx`
- `apps/mobile/src/screens/TokenScreen.tsx`
- `apps/mobile/src/types.ts`

Focused VM proof already completed:

- API typecheck passed.
- Focused terminal RPC adapter tests passed: 3/3.
- Full API test suite passed: 62/62.

## Why This Is Pending

SSH escalation was rejected by account usage limits before final root workspace gates could run. Do not mark this slice as a full workspace pass until the commands below complete on `/home/nurseapp/nursebridge`.

## Commands To Run On VM

```sh
cd /home/nurseapp/nursebridge
node scripts/ops/verify-nursebridges-identity.mjs
node scripts/ops/verify-vm-stage-package.mjs
pnpm verify
pnpm run build
```

## Evidence Update After Pass

After the commands pass, update `docs/release/beta-evidence-log.md` entry `API terminal RPC finalizer contract` from:

```text
Result: Focused API pass; VM root workspace verification/build pending.
```

to:

```text
Result: Pass.
```

Also add the VM identity guard, VM staged-package guard, root `pnpm verify`, and root `pnpm run build` evidence lines.
