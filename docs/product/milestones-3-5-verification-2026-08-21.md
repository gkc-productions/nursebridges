# Milestones 3–5 Verification — 2026-08-21

Status: implementation complete in the consolidation checkout. Production migration/deployment and final physical-device workflow proof remain separately gated.

## Milestone 3 — Nurse Product

- Separate NurseBridges Care application with nurse-only role boundaries.
- Credential onboarding, approval gating, structured availability calendar, qualified-opportunity filtering, and grouped schedule views.
- Ordered visit checkpoints, request-specific communication, draft report state, and a required four-part completion report covering visit summary, provider instructions, follow-up ownership, and transportation/safe handoff.
- Atomic availability replacement through `replace_my_nurse_availability`, so an invalid replacement cannot erase the previous calendar.
- Native date/time picker linked through CocoaPods.

## Milestone 4 — Admin Operations

- SaaS-style exception-first navigation and workspaces for jobs, credentials, operations, continuity, quality, finance, team, users, and audit.
- Searchable owned queues, overdue and handoff views, explicit incident deadlines, internal notes, presence warnings, guarded version updates, and audited assignment/terminal actions.
- Team roster with operator, supervisor, credential-reviewer, support, and finance responsibilities.
- Transactional database protection prevents removal or demotion of the final active supervisor.
- Finance data and draft quote controls are restricted to active finance users and supervisors after team roles are configured.

## Milestone 5 — Marketplace Quality

- Preferred-nurse and safe rebooking foundation; rebooking preserves practical context but requires a fresh date, time, and arrival review.
- Recurring-care patient request and admin review lifecycle without automatic assignment, charging, or occurrence creation.
- Arrival confirmation/PIN, structured patient feedback, privacy-minimized quality signals, late-report detection, and service-recovery queues.
- Versioned package-quote and nurse-guarantee workbench behind `COMMERCIAL_LEDGER_ENABLED`; payment processing remains disabled.
- Patients no longer choose an hourly rate. Legacy rates are labeled as legacy estimates, and new requests state that the care team will confirm pricing.

## Automated verification

- Patient mobile: 35 tests passed.
- Nurse mobile: 6 tests passed.
- API: 84 tests passed.
- Admin: 19 tests passed.
- Patient, nurse, API, and admin TypeScript checks passed.
- Admin Next.js production build passed with all new routes.
- Expo Doctor dependency checks passed after updating both apps to Expo `~54.0.37` and Expo Constants `~18.0.14`.
- Expo Doctor continues to report the expected native-configuration warning because checked-in iOS projects are intentionally preserved; prebuild was not run.

## Native verification

- CocoaPods 1.17.0 completed for both iOS workspaces.
- Patient Release build 6 succeeded for `com.nursebridges.mobile` with an embedded JavaScript bundle and team entitlement `HKQJ75SQVF`.
- Nurse Release build 5 succeeded for `com.nursebridges.care` with an embedded JavaScript bundle, linked `RNDateTimePicker`, and team entitlement `HKQJ75SQVF`.
- The connected iPhone was unavailable during final verification, so these new artifacts were not installed or launched and no existing app data was touched.

## Remaining controlled gates

- Replay and lint the two new migrations in an isolated Supabase project. Local database lint was unavailable because Docker/Podman is not installed.
- Review and approve the database/API/admin deployment sequence before changing production.
- After deployment, run role-specific smoke tests for availability replacement, supervisor bootstrap/final-supervisor protection, recurring-care transitions, service recovery, and the locked finance ledger.
- Install the signed patient and nurse artifacts in place on an available iPhone and verify the new native date/time picker and core signed-in/signed-out flows.
- Payments, payouts, cards, archives, App Store/TestFlight uploads, and production money movement remain intentionally disabled and outside this implementation checkpoint.
