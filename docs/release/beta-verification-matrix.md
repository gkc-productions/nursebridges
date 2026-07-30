# Beta Verification Matrix

This matrix defines what evidence is required before NurseBridge can move from current build state into controlled closed beta. It complements `docs/release/beta-readiness.md` and `docs/release/beta-evidence-log.md`.

## Evidence Rule

Do not mark a readiness item complete unless the evidence proves the actual requirement.

Examples:

- Passing API tests can prove route behavior, but not real-device UX.
- A successful smoke script can prove API workflow, but not Expo push delivery.
- A screenshot can prove UI state, but not RLS security.
- A checklist can prove preparation exists, but not legal review.

## Current Gate Order

```text
Gate 0: staged docs synced
        -> Gate 1: create-job fixed
        -> Gate 2: API workflow smoke passed
        -> Gate 3: real-device patient/nurse/admin proof
        -> Gate 4: notifications and verification upload proof
        -> Gate 5: ops/legal/access/restore readiness
        -> Gate 6: tiny controlled beta
```

## Gate Matrix

| Gate | Requirement | Required Evidence | Record In |
| --- | --- | --- | --- |
| Gate 0 | Staged docs are synced to VM | `git status --short` and `rg` references after copy | `docs/release/beta-evidence-log.md` general entry |
| Gate 1 | Real-device create-job result captured after deployed fix | Fresh installed iOS/internal build attempt or Android attempt, copied reference if failed, safe log event | Create-job debug evidence |
| Gate 1 | Mobile create-job fixed/proven | Real-device patient creates request, request visible through job list or `GET /jobs`, job is `open` | Create-job debug evidence + patient real-device evidence |
| Gate 1 | Regression coverage added | Focused test result and `pnpm verify` pass | Create-job debug evidence |
| Gate 2 | Completion workflow works through API | Approved smoke: patient create, nurse apply, admin assign, nurse complete | Workflow smoke evidence |
| Gate 2 | Cancellation workflow works through API | Approved smoke: patient/admin cancel, pending apps rejected, terminal guards pass | Workflow smoke evidence |
| Gate 2 | Wrong-role/invalid transition guards work | Smoke or targeted tests return expected `400`, `403`, or `409` | Workflow smoke evidence |
| Gate 3 | Patient real-device workflow works | iPhone and Android patient create/list/cancel/complete evidence, unless one platform is explicitly deferred | Patient real-device evidence |
| Gate 3 | Nurse real-device workflow works | iPhone and Android nurse verification status/view/apply/complete evidence, unless one platform is explicitly deferred | Nurse real-device evidence |
| Gate 3 | Admin dispatcher workflow works | Admin queue/detail/applicant/assign/cancel/complete/audit evidence | Admin Web evidence |
| Gate 4 | In-app notifications work | Notification visible for workflow events | Notification evidence |
| Gate 4 | Push delivery tested | Expo push result on real Android and iOS device, pass or recorded follow-up | Notification evidence |
| Gate 4 | Nurse verification upload works | Real-device metadata creation, signed upload, private bucket/admin review | Nurse verification upload evidence |
| Gate 5 | Beta access rules confirmed | Cloudflare/admin/tester access rule evidence | Beta access rules evidence |
| Gate 5 | Monitoring owner assigned | Named owner, monitoring window, response expectation | Monitoring owner evidence |
| Gate 5 | Restore drill completed | Non-production restore drill result | Restore drill evidence |
| Gate 5 | Legal/consent gate reviewed | Privacy, terms, verification consent, retention, support path, copy review | Legal/consent evidence |
| Gate 6 | Controlled beta launch approved | Beta owner go/no-go, tester list, monitoring window, stop condition | General beta session evidence |

## Minimum Closed-Beta Evidence Set

Before inviting outside testers, collect at least:

1. Create-job debug evidence showing mobile create-job is proven after the deployed backend fix.
2. Workflow smoke evidence showing completion and cancellation paths.
3. Patient real-device evidence.
4. Nurse real-device evidence.
5. Admin web evidence.
6. Notification evidence for in-app notifications.
7. Nurse verification upload evidence.
8. Beta access rules evidence.
9. Monitoring owner evidence.
10. Restore drill evidence.
11. Legal/consent evidence.

Push delivery can remain a follow-up only if in-app notifications and visible status are reliable and the beta owner explicitly accepts that limitation for the closed beta.

## Evidence Quality Bar

Good evidence includes:

- Date/time and timezone.
- Tester/runner.
- Role.
- Device/browser.
- Environment.
- Request ID/reference when relevant.
- Expected result.
- Actual result.
- Pass/fail result.
- Follow-up issue when failed.

Weak evidence:

- "Looks good."
- "Should work."
- Unit tests used as proof of real-device behavior.
- Screenshots without role/environment/context.
- Logs copied with secrets or private details.

## Current Blockers

As of this staged local pass:

- Gate 1 is blocked by missing real-device create-job proof after the deployed backend fix.
- Gate 2 is blocked until create-job is proven on a real device.
- Gate 3 is blocked until API workflow is proven and real-device checks run.
- Gate 4 is blocked by missing real-device notification/upload proof.
- Gate 5 is blocked by missing owner/access/restore/legal evidence.
- Gate 6 is blocked until gates 1 through 5 are proven or explicitly accepted with documented limitations.
