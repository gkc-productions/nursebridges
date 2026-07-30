# NurseBridge Lead Engineering Blueprint

Date: 2026-07-29

This blueprint is the current lead-engineering answer to what NurseBridge should become and how to build it without drifting into a toy app, an overbuilt marketplace, or an unsafe care product.

## Product Thesis

NurseBridge is a trusted care-access coordination platform.

The product should prove one serious loop before expanding:

```text
patient or family requests support
        -> approved nurse or caregiver applies
        -> admin or dispatcher assigns
        -> care is completed or cancelled
        -> status, notifications, and records show what happened
```

Everything we build should make that loop clearer, safer, more traceable, or easier to operate.

## Surface Strategy

### Mobile App

Keep the patient and nurse experience in the existing Expo/React Native app for the production track.

Reasons:

- The app already exists and compiles through native iOS.
- One codebase serves iOS and Android during beta learning.
- The current weakness is workflow/product quality, not lack of Swift.
- Native iOS can be introduced later only for proven platform-specific needs.

Mobile should feel like an installed care operations app:

- Role-specific home.
- One primary action per screen.
- Status visible before metrics.
- Request detail and record trail easy to understand.
- Calm errors with request references.
- No unsupported compliance, insurance, license-validation, or background-check claims.

### Admin Console

Keep admin as a protected web app.

Reasons:

- Dispatch work needs queues, tables, filters, applicant review, verification metadata, and audit context.
- Admin fixes should ship without app-store review.
- Cloudflare Access plus server-side admin code is the right closed-beta posture.

Admin should feel like a quiet operations console:

- Queue first.
- Detail on demand.
- Explicit assignment/cancel/complete controls.
- Audit and notification context near every trust-sensitive action.

### API And Data

Keep the Fastify API as the canonical patient/nurse workflow boundary and Supabase as the auth/database/storage layer.

Near-term posture:

- Mobile writes workflow state only through the API.
- Admin server routes remain acceptable for closed beta only while guarded by tests.
- Shared workflow rules stay in `@nursebridge/shared/workflow`.
- Assignment atomicity is the next database-backed trust hardening step after owner-approved RPC rollout.

## What We Build First

### Track 1: Installed-Build Proof

Goal:

- Prove real-device patient create-request against `https://api.nursebridges.com`.

Current blocker:

- iOS signing/provisioning for `com.nursebridges.mobile`, or recovered Android device access.

Engineering action while blocked:

- Keep unsigned native builds, mobile typecheck, mobile tests, and install preflight healthy.
- Do not run EAS, TestFlight, credential changes, or app-store actions without owner approval.

### Track 2: Closed-Beta Workflow Proof

Goal:

- Prove patient create -> nurse apply -> admin assign -> nurse/patient complete and cancellation paths.

Engineering action:

- Use the guarded smoke script only after explicit production approval.
- Record request IDs and results without secrets or private care details.
- Patch only evidence-backed workflow defects.

### Track 3: Serious Mobile Product Pass

Goal:

- Replace the generic mobile dashboard with role-specific care workflow screens.

Build order:

```text
patient home and request detail
        -> create request field experience
        -> nurse home and open requests
        -> assigned work and completion
        -> verification upload/review states
        -> notification and record views
```

Quality bar:

- A stressed patient knows within five seconds whether support is requested, assigned, completed, or cancelled.
- An unverified nurse knows why applying is blocked and what to do next.

### Track 4: Dispatcher Console Pass

Goal:

- Make admin usable for real manual dispatch.

Build order:

```text
request queue
        -> request detail/applicants
        -> assignment controls
        -> terminal actions
        -> verification queue
        -> audit and notification review
```

Quality bar:

- An operator can explain what happened to a request from the UI and the audit trail.

### Track 5: Trust And Operations

Goal:

- Avoid launching a care product that cannot be operated safely.

Build order:

```text
data contract verification
        -> assignment atomicity
        -> monitoring owner and response expectations
        -> backup/restore drill
        -> beta privacy, terms, and verification consent
        -> controlled 3-5 tester beta
```

## Architectural Commitments

- Keep NurseBridge isolated from Pathfinder paths, env files, services, domains, and deployment actions.
- Keep patients/nurses on mobile and dispatcher/admin on web.
- Keep API as the workflow backbone.
- Keep Supabase for closed beta unless a concrete reliability need forces change.
- Keep compliance language conservative until legal and operational processes exist.
- Keep payments, chat, ratings, claims, partner dashboards, recurring care automation, and public marketplace features deferred.

## Decision Triggers

Revisit Expo/React Native if:

- Native iOS capabilities become required for a beta-critical workflow.
- Performance or reliability blocks installed-device workflow proof.
- The product has enough workflow evidence to justify platform-specific investment.

Revisit VM/systemd if:

- Deployment reliability slows beta learning.
- Monitoring or rollback becomes operationally risky.
- The team needs managed deployment collaboration.

Revisit admin-as-web only if:

- Dispatch work becomes so simple that mobile admin is useful, or
- Field operators need mobile-only assignment controls during real operations.

## Next Engineering Move

The next non-blocked engineering move is to continue converting the mobile app from a single mixed dashboard into role-specific workflow surfaces while preserving the current verified backend and VM gates.

The next blocked-but-required proof move is to resolve installed-device access, then run one real create-request attempt and record the result.
