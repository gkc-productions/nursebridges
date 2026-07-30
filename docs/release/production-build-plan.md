# Production Build Plan

This plan turns the current NurseBridge build into a serious production-track care coordination product. It assumes user ownership/final say and Codex engineering leadership.

Use `docs/release/implementation-backlog.md` for the ordered engineering work packages that execute this plan.
Use `docs/architecture/adrs/0001-product-architecture-decisions.md` for the current architecture decisions and revisit triggers.
Use `docs/architecture/lead-engineering-blueprint.md` for the current lead-engineering answer to what to build high level, what stays mobile/web, and how work is sequenced while installed-device proof is blocked.
Use `docs/release/beta-verification-matrix.md` to verify the evidence required before beta gates move forward.
Use `docs/ops/mobile-beta-build-readiness.md` before requesting or running any Expo/EAS beta build.
Use `docs/architecture/workflow-source-of-truth.md` before consolidating duplicated lifecycle or assignment behavior.

## Product Principle

NurseBridge is not a generic marketplace and not a demo CRUD app. It is a trust-centered care access platform:

```text
patient/family request
        -> verified nurse/caregiver interest
        -> admin/dispatcher assignment
        -> tracked care outcome
        -> notifications, records, and audit trail
```

Every technical decision should make that trust loop more reliable, more understandable, or easier to operate.

Canonical beta identity:

```text
Expo slug/scheme: nursebridges
iOS bundle id: com.nursebridges.mobile
Android package: com.nursebridges.mobile
API base: https://api.nursebridges.com
```

Do not drift back to the singular bundle id. The visible product name can remain NurseBridge/NurseBridges until owner finalizes public brand copy, but the build identity is plural.

## Architecture Decision

Keep a hybrid architecture:

- Mobile app for patient/family and nurse/caregiver workflows.
- Web admin console for dispatcher and verification operations.
- Fastify API as the workflow backbone.
- Supabase for auth, database, RLS, and private document storage.
- Current VM/systemd/Cloudflare deployment while closed beta is proven.

Do not rebuild everything in Xcode right now. The serious move is to make the mobile app feel native and trustworthy while preserving one cross-platform codebase. Revisit Swift/SwiftUI only if native OS requirements, app-store polish, performance, or platform-specific care workflows become a proven blocker.

Do not force admin operations into the mobile app. Dispatcher work belongs on web because it needs queues, tables, audit context, verification documents, and fast operational iteration.

## 30/60/90 Production Track

### Days 0-30: Prove The Closed Beta Loop

Non-negotiable outcome:

- An installed mobile build proves patient create-request against `https://api.nursebridges.com`.
- A controlled patient -> nurse -> admin -> complete/cancel workflow has evidence.
- The admin console can support manual dispatch, verification review, and audit review.

Engineering focus:

1. Resolve iOS signing for `com.nursebridges.mobile` or recover Android access.
2. Install one real beta build.
3. Prove create-job, list jobs, notifications, nurse apply, admin assign, complete, and cancel.
4. Patch only evidence-backed workflow defects.
5. Tighten mobile and admin UI around the proven paths.

### Days 31-60: Make It Reliable

Non-negotiable outcome:

- The closed-beta workflow can be operated without developer improvisation.
- Failures have request IDs, logs, user-safe error states, and dispatcher-visible context.

Engineering focus:

1. Consolidate workflow and assignment rules or define one enforced canonical boundary.
2. Verify the Supabase data contract against production.
3. Improve notification tracking and in-app notification reliability.
4. Add dispatcher notes, filtering, request history, and support lookup.
5. Complete deployment, monitoring, rollback, and restore-drill evidence.

### Days 61-90: Prepare Real Operations

Non-negotiable outcome:

- NurseBridges can support a tiny supervised beta cohort with clear terms, support, monitoring, and stop conditions.

Engineering focus:

1. Polish patient and nurse mobile UX for trust, speed, and clarity.
2. Harden admin operations for assignment, verification, audit, and incident handling.
3. Prepare privacy, beta terms, verification consent, and support/data-request language.
4. Record several supervised workflows and rank product gaps.
5. Decide intentionally whether to expand beta, pause, or rebuild a specific surface.

## Active Risk Register

| Risk | Current posture | Mitigation |
| --- | --- | --- |
| Apple signing blocks installed iOS proof | Active blocker | Use `com.nursebridges.mobile`, sign into team `R2N3CHKSBB`, create/download matching development profile, keep unsigned Xcode builds green. |
| Workflow looks proven only in tests | Active risk | Require installed-device evidence for create/apply/assign/complete/cancel before beta claims. |
| API/admin lifecycle drift creates unsafe states | Known technical debt | Use `docs/architecture/workflow-source-of-truth.md`; consolidate before broader beta or force admin through canonical API endpoints. |
| Supabase schema drift breaks runtime behavior | Known technical debt | Verify `docs/architecture/data-contract.md` against production; keep DB contract checks. |
| Product feels unserious | User-confirmed concern | Redesign around role-specific homes, clear status, restrained UI, no fake marketplace decoration. |
| Pathfinder contamination | Explicit constraint | Keep paths, env files, services, domains, docs, and deploy actions isolated. |
| Unsupported compliance/trust claims | Product/legal risk | No HIPAA, insurance, license-verification, or background-check claims until processes are real and reviewed. |
| Overbuilding before proof | Product risk | Defer payments, chat, ratings, marketplace, claims, partner dashboards, and automation until the trust loop is proven. |

## Phase 0: Current Stabilization

Goal: remove the current blocker and protect the workflow from regression.

Status:

- API tests are passing.
- Mobile tests are passing.
- Admin tests are passing.
- Full `pnpm verify` passed on the VM before access was blocked.
- API/admin runtime health was verified before access was blocked.
- Backend create-job payload fix is deployed, but real-device create-job proof after the fix is still missing.
- Local iOS Release compile succeeds with signing disabled and validates `com.nursebridges.mobile`.
- Signed iPhone install is blocked by Apple account/provisioning: Xcode still has no authenticated account for team `R2N3CHKSBB` and no development profile for `com.nursebridges.mobile`.

Actions:

1. Sync staged docs when VM access returns.
2. Resolve Apple signing/provisioning for `com.nursebridges.mobile`, or recover Android access for the real-device create-request proof.
3. Inspect create-job logs with the copied request reference or time window if the attempt fails.
4. Patch the exact cause if a failure remains.
5. Add or update the regression test for any code fix.
6. Run focused tests, then `pnpm verify`.
7. Restart only the affected service if code changed.
8. Run `node scripts/ops/verify-nursebridges-identity.mjs` after app identity, release, or docs changes.

Exit criteria:

- Real-device patient create-job succeeds after the deployed backend fix.
- The fixed failure has a regression test.
- `pnpm verify` passes.
- Evidence is recorded in `docs/release/beta-evidence-log.md`.
- Installed-build path is documented: signed iOS internal/TestFlight or Android device path.

## Phase 1: Closed-Beta Workflow Proof

Goal: prove the care request lifecycle with controlled accounts.

Workflow to prove:

```text
patient creates request
        -> approved nurse sees request
        -> nurse applies
        -> admin assigns
        -> assigned nurse completes
        -> patient/admin can see final state
```

Also prove cancellation paths:

```text
patient creates request
        -> nurse applies
        -> patient/admin cancels
        -> pending applications are rejected
        -> cancelled request cannot be applied to or completed
```

Actions:

1. Run the guarded workflow smoke script only with explicit production approval.
2. Verify patient Android flow on a real device.
3. Verify nurse Android flow on a real device.
4. Verify admin web assignment, cancellation, completion, and audit visibility.
5. Verify in-app notifications.
6. Verify nurse verification upload on a real device.
7. Record evidence for every pass/fail.

Exit criteria:

- Full patient -> nurse -> admin -> complete path has evidence.
- Cancellation path has evidence.
- Real-device patient and nurse evidence exists.
- Admin web evidence exists.
- No known blocker remains for a 3 to 5 user closed beta.

## Phase 2: Serious Mobile Product Pass

Goal: make the patient/nurse app feel like a care coordination product, not a prototype.

Use `docs/product/experience-spec.md` as the screen-level contract for patient, nurse, and admin product work.
Use `docs/product/ui-implementation-brief.md` for the implementation slices and UI QA checklist.

Principles:

- Role-specific home screens.
- Clear next action.
- No decorative noise.
- Calm language for stressful care moments.
- Strong status visibility.
- Recoverable errors with request references.
- Visible trust signals without making unsupported compliance claims.

Patient app should prioritize:

- Current request state.
- Create care request.
- Assigned provider information when assigned.
- Cancel/complete eligible request.
- Notifications.
- Support and safety language.

Nurse app should prioritize:

- Verification status.
- Upload/review verification documents.
- Available requests.
- Applied/assigned work.
- Complete assigned request.
- Notifications.

Exit criteria:

- Role switch/login state is clear.
- Patient can complete the main beta flow without developer guidance.
- Nurse can complete the main beta flow without developer guidance.
- Common API errors are understandable and include support-ready references.
- Mobile beta build readiness is reviewed before any internal distribution build is requested.

## Phase 3: Dispatcher Console Pass

Goal: make admin feel like a real operations console.

Admin console should prioritize:

- Request queue with status, urgency/time, location, patient, applicant count, and assignment state.
- Job detail with request data, applicant list, assignment controls, terminal actions, notifications/audit context.
- Nurse verification queue with document metadata and approve/reject controls.
- User lookup for support.
- Clear failure states and audit visibility.

Exit criteria:

- Dispatcher can assign without guessing.
- Verification decisions are traceable.
- Cancellation/completion decisions are traceable.
- Admin can understand what happened to a request from the UI.

## Phase 4: Backend Consolidation

Goal: reduce lifecycle drift before broader beta.

Current acceptable beta risk:

- Admin routes have matching guardrails and direct regression coverage.

Longer-term fix:

- Move lifecycle rules into one canonical service layer used by both Fastify API and admin server routes, or make admin call canonical API endpoints for state transitions. Use `docs/architecture/workflow-source-of-truth.md` as the implementation plan.
- Verify `docs/architecture/data-contract.md` against production and add database contract checks around canonical job/application fields.
- Clarify canonical assignment representation.
- Keep logs structured and safe.

Exit criteria:

- One canonical job lifecycle implementation.
- One canonical assignment implementation.
- Tests cover patient, nurse, admin, stale-write, wrong-role, and terminal-state cases.

## Phase 5: Operational Readiness

Goal: closed beta can run without improvising.

Required:

- Deploy checklist: `docs/ops/deployment-runbook.md`.
- Rollback note.
- Monitoring owner.
- Beta support path.
- Incident response expectations.
- Closed-beta operations playbook: `docs/ops/closed-beta-ops-playbook.md`.
- Backup/restore drill in a non-production Supabase project.
- Cloudflare Access tester/admin rules verified.
- Secrets owner and rotation procedure confirmed.

Exit criteria:

- Someone can deploy, verify, monitor, and respond using documented steps.
- Evidence exists for restore drill and access rules.
- No secrets or private medical details are stored in logs/docs.

## Phase 6: Legal, Consent, and Beta Gate

Goal: avoid overclaiming and protect users.

Required before outside testers:

- Beta legal and consent checklist: `docs/legal/beta-legal-consent-checklist.md`.
- Privacy policy for beta.
- Terms of service for beta.
- Nurse verification document consent language.
- Data retention expectations.
- Support/escalation language.
- No HIPAA, insurance, background-check, or license-verification claims unless reviewed and real.

Exit criteria:

- Beta legal language is reviewed and linked in evidence.
- App wording matches what the operation can actually support.

## Phase 7: Controlled Beta

Goal: test with a tiny real cohort.

Start with:

- 1 admin/operator.
- 1 to 2 patient/family testers.
- 1 to 2 nurse/caregiver testers.
- Manual oversight for every request.

Measure:

- Can patients request help without confusion?
- Can nurses understand and apply safely?
- Can admin assign confidently?
- Are notifications and records reliable?
- Where do users hesitate?
- What must be manual before automation?

Exit criteria:

- At least several complete workflows are recorded.
- Support issues are understood.
- Product gaps are ranked.
- Broader beta scope is intentionally approved.

## Deferred Until After Proof

- Payments and payouts.
- Public nurse marketplace.
- Hospital/clinic partner dashboards.
- Insurance/claims workflows.
- Ratings/reviews.
- Full chat.
- Broad public launch.
- Compliance marketing claims.

## Current Next Move

The next technical move remains:

```text
resolve iOS signing for com.nursebridges.mobile or recover Android access
        -> install a real mobile build
        -> trigger one real-device patient create-request
        -> inspect request-specific API log if needed
        -> patch exact root cause if a failure remains
        -> regression test any code fix
        -> pnpm verify
        -> prove full workflow
        -> recheck Android before wider beta unless explicitly deferred
```

Until that is done, design work should be constrained to serious product direction and workflow clarity, not broad visual churn.
