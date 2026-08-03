# NurseBridges Final-Form Product Blueprint

Status: approved direction, implementation staged by milestone.

## Product Portfolio

NurseBridges is one service platform with three purpose-built products. The products share the existing API, Supabase project, workflow rules, and audit model; they do not share a combined end-user interface.

### NurseBridges — Patient and Family

- Preserve the existing App Store record and bundle identifier `com.nursebridges.mobile`.
- Serve patients, family organizers, and invited care-circle members.
- Never expose nurse, administrator, or developer workflows.
- Optimize the home screen around one next action and the current care state.

Primary navigation:

```text
Home | Care | Messages | Activity | Account
```

### NurseBridges Care — Nurses

- Ship as a separate app and App Store record.
- Proposed bundle identifier: `com.nursebridges.care`.
- Serve credentialing, availability, qualified opportunities, assigned visits, communication, safety, and earnings.
- Never expose patient request creation or administrator workflows.

Primary navigation:

```text
Home | Opportunities | Schedule | Messages | Account
```

### NurseBridges Admin — Operations

- Remain a secure web application.
- Serve intake, matching, credentialing, care coordination, support, incidents, finance, supervision, and audit.
- Optimize for exceptions and queues rather than passive database tables.

Primary navigation:

```text
Overview | Requests | Assignments | Nurses | Patients | Support | Incidents | Audit
```

## Architecture Decision

The current mobile application has patient, nurse, administrator, diagnostics, authentication, data loading, mutations, and presentation in one `App.tsx`. It must be decomposed before broad visual redesign.

Target workspace:

```text
apps/mobile/                 existing Patient native shell and App Store identity
apps/nurse/                  new Nurse native shell and App Store identity
packages/mobile-core/        auth, API client, session, notifications, shared workflow adapters
packages/mobile-ui/          tokens, typography, controls, feedback, accessibility primitives
packages/shared/             domain types and workflow rules (existing)
apps/admin/                  operations web app (existing)
```

Migration is incremental. Do not create both final apps in one change.

## Experience Principles

1. One primary action per state.
2. Show what happens next, not internal implementation details.
3. Make trust evidence precise and visible without overclaiming.
4. Keep safety and human support reachable during active care.
5. Collect information progressively instead of using long forms.
6. Preserve continuity: care circles, preferred nurses, repeat requests, and shared updates.
7. Use calm motion, native controls, accessible contrast, and large targets.
8. Keep support diagnostics available, but outside the normal experience.

## Theme and Brand Rules

- The complete Patient and Nurse interfaces support light, dark, and system appearance.
- Home Screen icons provide default, dark, and tinted appearances independently of the in-app theme.
- Rebalance the master logo so the foreground mark reads at actual Home Screen size.
- Patient and Nurse icons use the same brand family but remain distinguishable at a glance.
- Launch motion lasts no longer than necessary and honors reduced-motion settings.

## Operational Concurrency

Every administrator action item needs:

- an owner or unclaimed state;
- status, priority, and due time;
- last activity and complete timeline;
- version or update timestamp checked before mutation;
- a visible viewer/editor presence indicator;
- internal notes and shift handoff;
- an immutable audit event for sensitive actions.

Conflicting mutations must fail safely and ask the second operator to refresh. Supervisor override must be explicit and audited.

## Milestones

### Milestone 1 — Patient Foundation

- Make the existing TestFlight binary explicitly Patient-only.
- Extract design tokens and shared UI primitives.
- Replace the beta dashboard shell with a professional Patient shell.
- Move authentication near the beginning of the experience and fix keyboard avoidance.
- Remove role switching and nurse/admin UI from the Patient product.
- Preserve the proven create, status, notification, cancellation, and completion engine.
- Verify with patient typecheck, tests, Release build, and installed-device workflow.

### Milestone 2 — Patient Care Journey

- Guided care-request flow.
- Context-aware home states.
- Patient-friendly request timeline.
- Request-specific messages.
- Care-circle foundation.
- Trusted nurse profile and visit preparation.

### Milestone 3 — Nurse Product

- Create the separate NurseBridges Care application.
- Nurse onboarding and credentialing.
- Availability, qualified opportunities, schedule, active visit, and completion.
- Nurse safety, support, and communication.

### Milestone 4 — Admin Operations

- Exception-first overview and owned queues.
- Credential-review workbench.
- Matching and assignment workspace.
- Support and incident workspaces.
- Team roles, collision prevention, handoff, and audit.

### Milestone 5 — Marketplace Quality

- Preferred nurse and rebooking.
- Recurring care.
- Arrival confirmation and visit PIN.
- Payments and earnings after legal and operational approval.
- Structured feedback, quality signals, and service recovery.

## Milestone Gate

Do not start the next milestone until the current milestone has:

- a focused diff;
- automated checks appropriate to its risk;
- visual review on target screen sizes;
- real-device proof when native behavior changes;
- a recoverable Git checkpoint;
- a short record of remaining limitations.

