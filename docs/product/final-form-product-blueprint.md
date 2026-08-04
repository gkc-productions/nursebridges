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

## Entry and Onboarding

The first launch must not assume that every person already has credentials. It must present two equally clear entry paths:

```text
Get started | Sign in
```

### Patient and Family Entry

`Get started` opens a short eligibility and access flow rather than the credential form:

1. Choose `I have an invitation` or `Request early access`.
2. Invitation holders verify the invited email or phone number and continue account setup.
3. Early-access requests collect only name, contact method, general service area, and consent to be contacted.
4. Do not collect care details, diagnoses, documents, payment details, or other sensitive information before an account is approved and protected.
5. Show a clear submitted state, expected response window, and support path.

`Sign in` remains a direct path for returning patients and family members. It must include account recovery and must remain usable with the keyboard open.

Public self-registration is not enabled until the enrollment API, abuse controls, consent records, privacy copy, and operator queue are implemented and verified. During closed beta, approval or invitation precedes account activation.

### Nurse Entry

Nurse enrollment exists only in NurseBridges Care:

1. Create or recover a NurseBridges Care account.
2. Verify contact and identity in progressive steps.
3. Submit required credentials and consents.
4. Preserve progress between sessions.
5. Show review status, missing items, rejection reasons, and support options.
6. Do not expose opportunities or assigned care until the required approval gate passes.

This separation follows the proven service-marketplace pattern: lightweight customer registration, a distinct provider application, progressive verification, resumable onboarding, and explicit activation gates.

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

## TestFlight Release Gate

The Patient and Nurse products ship as separate TestFlight apps and are never uploaded from a partial design checkpoint.

Before uploading either app:

- the product-specific bundle identifier and App Store Connect record are verified;
- Release configuration, signing, entitlements, privacy metadata, icon, launch assets, and version/build number are verified;
- automated tests and an Archive build pass;
- the critical role-specific workflow passes on a physical iPhone;
- secrets and generated output are absent from the committed release tree;
- release notes identify tested behavior and remaining beta limitations;
- the exact release commit is pushed without force and the uploaded build is traceable to it.

Patient and Nurse builds may advance independently. A ready Patient build must not be delayed by an unfinished Nurse build, and an unfinished Nurse build must never be disguised as the Patient product.
