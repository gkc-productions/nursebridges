# NurseBridge Production Architecture

Date: 2026-07-17
Updated: 2026-07-29

## Executive Direction

NurseBridge should become a serious care-access coordination product, not a generic CRUD app and not a flashy marketplace.

Canonical app-store and build identity for the closed beta:

```text
Public product: NurseBridge / NurseBridges
Owner-provided app identity: nursebridges
iOS bundle identifier: com.nursebridges.mobile
Android package: com.nursebridges.mobile
Public API: https://api.nursebridges.com
```

Keep the native Xcode project and Expo configuration aligned to `com.nursebridges.mobile`. The local Xcode target/module may still be named `NurseBridge` to avoid unnecessary native-project churn.

The product architecture is:

```text
Patient/family mobile app
        |
        v
NurseBridge API
        |
        v
Supabase auth/database/storage
        ^
        |
Nurse/caregiver mobile app

Admin/dispatcher web console
        |
        v
NurseBridge API or controlled server-side admin services
```

The first production milestone is not public launch. It is a controlled closed beta where the care request workflow is real, traceable, and trustworthy.

See `docs/architecture/adrs/0001-product-architecture-decisions.md` for the accepted closed-beta architecture decisions and revisit triggers. See `docs/architecture/lead-engineering-blueprint.md` for the current lead-engineering build strategy and production-track sequencing.

## Product Surfaces

### 1. Mobile App

Audience:

- Patients/families
- Nurses/caregivers

Technology:

- Keep Expo / React Native for now.
- Do not switch to pure Xcode yet.
- Ship through the native iOS/TestFlight path for beta, not Expo Go/LAN.
- Keep Xcode build configuration healthy because the product must feel and distribute like a real installed app.
- Reconsider native Swift/SwiftUI only after workflow/product-market proof or if iOS-native requirements become a real blocker.

Why:

- One codebase can serve Android and iOS.
- The current app already exists.
- The immediate problem is product quality and workflow proof, not the choice of mobile framework.

Mobile app should become:

- Calm
- Trustworthy
- Clear under stress
- Role-specific
- Serious care coordination, not demo UI

Patient mobile experience:

```text
Home/status
Create care request
Track request status
See assigned nurse/caregiver
Cancel/complete eligible request
View notifications
Access support/safety information
```

Nurse/caregiver mobile experience:

```text
Verification status
Upload verification documents
Browse eligible open requests
Apply to requests
Track assigned requests
Complete assigned request
View notifications
```

### 2. Admin Web Console

Audience:

- Admin
- Dispatcher
- Operations owner

Technology:

- Keep as Next.js web app.
- Keep protected by Cloudflare Access.
- Improve it into an operations console.

Why web:

- Dispatch work needs tables, filters, queues, detail pages, verification review, and audit context.
- Admin updates should deploy instantly without app store review.
- Web is easier to secure behind Cloudflare Access.

Admin console should become:

```text
Request queue
Job/request detail
Applicant list
Nurse/caregiver verification queue
Assignment workflow
Status controls
Notifications/audit visibility
User lookup
Operational issue handling
```

The admin UI should not feel like a marketing site. It should feel like a quiet, dense, reliable operations tool.

## Backend Architecture

### API

Current:

- Fastify API in `services/api`
- Supabase JWT auth
- Role checks
- Jobs, applications, notifications, push, nurse verification routes

Direction:

- Make Fastify API the canonical patient/nurse workflow API.
- Keep all patient/nurse behavior behind API routes, not direct client database writes.
- Improve safe structured logging for all important workflow failures.
- Add integration tests around the core lifecycle.
- Treat request IDs as first-class support evidence for every failed mobile workflow.

Canonical workflow rules should live in one place:

```text
create request
list eligible requests
apply
assign
cancel
complete
notify
audit
```

Current risk:

- Admin Next API routes duplicate lifecycle logic from Fastify API.
- Admin assignment, terminal job actions, and nurse verification decisions now use guarded server helpers with direct regression coverage, but they still live in a separate admin server path.

Decision:

- For closed beta, keep the duplication only where it has matching guardrails and verification.
- Before broader beta, consolidate shared lifecycle/dispatcher rules or make admin call canonical API endpoints for lifecycle transitions.

### Database/Auth/Storage

Current:

- Supabase Auth
- Supabase Postgres
- Supabase Storage
- RLS policies
- Private `nurse-verification` bucket

Direction:

- Keep Supabase.
- Treat database schema as a contract.
- Use `docs/architecture/data-contract.md` as the closed-beta data contract.
- Avoid casual schema changes until create-job and full workflow are proven.

Core tables:

```text
profiles
nurse_profiles
jobs
applications
notifications
push_tokens
nurse_verification_documents
admin_audit_logs
```

Schema risk:

- Historical repair migrations introduced compatibility columns and naming drift.
- `patient_user_id` is canonical in current API.
- Assignment is partly accepted application and possibly `assigned_nurse_user_id`.

Required cleanup:

- Verify `docs/architecture/data-contract.md` against the live Supabase schema.
- Use `docs/architecture/workflow-source-of-truth.md` to consolidate lifecycle and assignment behavior before broader beta.
- Update stale shared types.
- Add database contract tests or smoke scripts.

## Infrastructure Architecture

Current:

```text
Ubuntu VM
systemd API service
systemd admin service
Cloudflare Tunnel
Cloudflare Access for admin
Supabase hosted backend
```

Direction:

- Keep current VM while stabilizing product.
- Do not migrate infrastructure during create-job/workflow stabilization.
- Keep NurseBridge/NurseBridges operational paths, env files, service names, domains, and deployment steps separate from Pathfinder.
- Add deployment discipline before closed beta:
  - deployment runbook
  - rollback note
  - service restart checklist
  - health check checklist
  - log check checklist

Use `docs/ops/deployment-runbook.md` as the current VM/systemd deployment guide.

Later options:

- Keep VM if simple and reliable.
- Move admin/API to a managed platform later if deploy reliability or team workflow demands it.

## Trust And Safety Architecture

Trust is the product. The app cannot feel like random matching.

Required trust concepts:

```text
verified caregiver/nurse status
admin oversight
clear request details
status history
notifications
audit records
support/escalation
privacy and consent language
```

Beta trust layer:

- Verification status visible to nurse and admin.
- Admin can approve/reject verification.
- Patients should see only assigned provider details once assigned.
- Request details should be structured enough to avoid confusion.
- Completion/cancellation should be explicit.

Do not claim:

- HIPAA compliance
- insurance coverage
- clinical care guarantees
- background-check completion
- nurse licensure validation

unless the legal/operational process truly exists.

## UI Architecture Direction

The current UI is disposable scaffolding.

New mobile UI principle:

```text
One primary action per screen.
Status is always visible.
Care request details are clear.
Errors explain next step.
The tone is calm and serious.
```

New admin UI principle:

```text
Queues first.
Filters second.
Details on demand.
Actions are explicit.
Every operational action leaves a record.
```

Avoid:

- Toy cards everywhere
- Marketing-page layout for operational screens
- Overly warm beige prototype look
- Vague dashboard numbers without action
- Hidden request state

Preferred product feel:

- Clean healthcare operations
- Quiet confidence
- Modern but restrained
- Clear hierarchy
- Accessible contrast
- Mobile-first for patient/nurse, desktop-first for admin

See `docs/product/experience-spec.md` for the screen-level patient, nurse, and admin experience contract.

## Canonical Closed-Beta Workflow

The whole build should optimize this:

```text
Patient logs in
Patient creates request
Request becomes open
Approved nurse sees request
Nurse applies
Admin sees request and applicant
Admin assigns nurse
Request becomes assigned
Patient and nurse get status update
Job is completed or cancelled
Notifications and audit trail reflect what happened
```

If a feature does not strengthen that workflow, defer it.

## Deferred Features

Do not build yet:

- Payments
- Payouts
- Chat
- Ratings/reviews
- Public provider marketplace
- Advanced scheduling
- Recurring request automation
- Partner dashboards
- Claims/insurance workflows
- Hospital/clinic integrations
- HIPAA marketing claims

These are later-stage features after the workflow proves itself.

## Production Readiness Gates

### Gate 1: Workflow Proof

- Installed mobile build can create a patient request against the production API. iOS/internal can prove first; Android must be rechecked before wider beta unless the owner explicitly accepts an iPhone-first beta limitation.
- Nurse can see job.
- Nurse can apply.
- Admin can assign.
- Job can complete/cancel.
- Notifications appear.
- Admin audit exists.

### Gate 2: Beta Product Shape

- Mobile UI redesigned by role.
- Admin console supports dispatch flow.
- Docs match actual verified state.
- Known limitations documented.
- Support process defined.

### Gate 3: Safety/Operations

- Privacy/terms/disclaimer drafts exist.
- Verification document consent language exists.
- Backup/restore drill planned.
- Log monitoring owner defined.
- Incident/support process defined.

### Gate 4: Controlled Beta

- 3 to 5 testers.
- Real-device tests pass.
- Feedback collection exists.
- No public marketing promises beyond current capability.

### Gate 5: Public Launch Candidate

- Legal review complete.
- Insurance/liability plan clear.
- Payment model decided or explicitly not offered.
- Monitoring and backups verified.
- Data retention policy defined.
- Operational support process staffed.

## Engineering Leadership Rules

1. Fix blockers before adding features.
2. Build from verified workflow, not imagined launch scope.
3. Keep mobile for patients/nurses and web for admin.
4. Use logs and tests instead of guessing.
5. Treat trust/safety as core product, not polish.
6. Keep secrets and production controls isolated.
7. Do not claim compliance before it is real.
8. Every release should improve the care request workflow.
