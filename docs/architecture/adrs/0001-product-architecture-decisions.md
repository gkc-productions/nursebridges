# ADR 0001: Product Architecture Decisions

Date: 2026-07-17

Status: accepted for closed beta

This record captures the current high-level product and architecture decisions for NurseBridge. User ownership and final say remain with the project owner; Codex is leading engineering execution and sequencing.

## Context

NurseBridge is being built as a trusted care-access coordination platform:

```text
patient/family request
        -> verified nurse/caregiver interest
        -> admin/dispatcher assignment
        -> tracked care outcome
        -> notifications, records, and audit trail
```

The current goal is a controlled closed beta, not a public launch.

The previous observed technical blocker was Android patient create-job returning `400`. The backend payload fix is now deployed, and the current blocker is missing real-device proof after that fix. The build also has known risks around workflow source-of-truth split, schema drift, operational readiness, and unproven real-device workflows.

The owner has confirmed the app-store/build identity is `nursebridges` with the `s`; the closed-beta bundle/package identifier is `com.nursebridges.mobile`.

## Decision 1: Keep Mobile For Patients/Nurses And Web For Admin

Decision:

- Patient/family and nurse/caregiver workflows stay in the mobile app.
- Admin/dispatcher workflows stay in the web console.

Rationale:

- Patients and nurses need a mobile-first experience.
- Dispatchers need queues, tables, filters, detail views, verification review, and audit context.
- Admin changes should deploy quickly without mobile app-store review.
- Putting dispatcher operations into Xcode would slow operational iteration and make support work worse.

Consequences:

- Mobile UX must be serious and role-specific.
- Admin web must become a real dispatcher console, not a generic dashboard.
- Backend workflow rules must stay consistent across both surfaces.

Revisit if:

- Admin work becomes mostly field/mobile based.
- A future operations model requires native admin capabilities.

## Decision 2: Keep Expo/React Native For Now

Decision:

- Keep Expo/React Native for the mobile app during closed-beta stabilization.
- Do not rebuild everything in pure Xcode/SwiftUI yet.

Rationale:

- The current app already exists.
- One codebase can serve Android and iOS while workflow/product proof is still pending.
- The immediate blocker is not the mobile framework; it is create-job and full workflow proof.
- Rebuilding in native iOS now would delay Android, beta proof, and backend hardening.

Consequences:

- The Expo app must be made native-feeling and trustworthy through UX/product discipline.
- Native-only work should be deferred unless a real platform requirement appears.
- EAS/app-store build work remains explicitly approval-gated.

Revisit if:

- Native OS capabilities become a blocker.
- App-store polish or performance cannot meet the product bar in Expo.
- Workflow proof succeeds and a platform-specific rewrite becomes strategically justified.

## Decision 3: Make The API The Workflow Backbone

Decision:

- Fastify API is the canonical patient/nurse workflow backbone.
- Mobile clients should not write directly to core workflow tables.
- Admin may use protected server-side services during closed beta, but lifecycle drift must be reduced before broader beta.

Rationale:

- Care request state transitions require role checks, audit, notifications, and guarded writes.
- API-mediated writes are easier to log, test, and support.
- Direct client writes increase the chance of bypassing business rules.

Consequences:

- Create/apply/assign/cancel/complete behavior needs tests.
- Request IDs and safe logs are part of the product’s support surface.
- Admin route duplication is acceptable only while guarded and tested.

Revisit if:

- Admin transitions are consolidated into canonical API endpoints.
- A shared service package or database RPC becomes the better source of truth.

## Decision 4: Keep Supabase For Closed Beta

Decision:

- Continue using Supabase for auth, Postgres, RLS, and private verification storage.

Rationale:

- Supabase is already wired into API, mobile, and admin.
- Auth, database, and private storage are central to the current build.
- Migration would distract from proving the workflow.

Consequences:

- The data contract must be verified against live schema.
- RLS-backed user flows must be reverified after create-job is fixed.
- Service role credentials remain server-only.

Revisit if:

- Supabase constraints block necessary workflow, audit, storage, or compliance requirements.
- Operational scale or compliance reviews require a different architecture.

## Decision 5: Keep Current VM/Cloudflare Infrastructure While Stabilizing

Decision:

- Keep the current VM, systemd services, Cloudflare Tunnel, and Cloudflare Access setup while closed beta is stabilized.

Rationale:

- The current infrastructure is already running.
- API health and admin Cloudflare Access behavior were verified before VM access was blocked.
- Infrastructure migration now would increase risk while the core workflow remains unproven.

Consequences:

- VM deploy, restart, log, and rollback discipline must be documented.
- NurseBridge must remain isolated from Pathfinder.
- Docs-only sync requires no service restart.

Revisit if:

- Deploy reliability becomes a bottleneck.
- Team workflow demands managed deployment.
- Monitoring, security, or compliance needs exceed the VM setup.

## Decision 6: Closed Beta Before Payments Or Public Marketplace

Decision:

- Do not build payments, public marketplace mechanics, partner dashboards, ratings/reviews, claims, insurance workflows, or broad launch features yet.

Rationale:

- Trust workflow proof comes first.
- Payments and marketplace growth add legal, operational, and support complexity.
- NurseBridge must first prove that a patient can request care, a verified nurse can apply, an admin can assign, and the outcome can be tracked.

Consequences:

- Product scope stays centered on care request workflow.
- Beta is tiny and manually supervised.
- Public/compliance marketing claims remain prohibited until reviewed and real.

Revisit if:

- Closed-beta evidence proves the core trust loop.
- Legal/operations readiness supports broader workflows.
- Payments become necessary for a specific approved beta scope.

## Decision 7: Evidence Before Readiness Claims

Decision:

- Do not mark beta readiness items complete without evidence.
- Do not claim HIPAA, SOC 2, insurance, background-check, or license-verification readiness until formal processes exist and are reviewed.

Rationale:

- Trust is the core product.
- Unsupported claims create operational and legal risk.
- Evidence keeps the build honest.

Consequences:

- `docs/release/beta-evidence-log.md` is the readiness proof surface.
- Real-device workflows, push delivery, verification upload, restore drill, access rules, and legal/consent items remain blockers until proven.

Revisit if:

- Formal legal/compliance review changes allowed product claims.
- New evidence closes specific beta readiness gaps.

## Decision 8: Prove Create-Job Before Broad Visual Redesign

Decision:

- Prove real-device create-job and the workflow before broad visual redesign.

Rationale:

- A polished UI on an unproven workflow would be cosmetic progress.
- The redesign should be grounded in actual patient, nurse, and admin flows.
- Existing diagnostics and the backend payload fix are in place; the next step is real-device evidence capture.

Consequences:

- Product design work can define direction/specs, but implementation should prioritize create-job proof and workflow proof.
- The experience spec becomes the guide after the blocker is fixed.

Revisit if:

- UI changes are directly needed to capture the create-job failure or unblock workflow proof.

## Decision 9: Canonical App Identity Is NurseBridges

Decision:

- Use `nursebridges` as the Expo slug and URL scheme.
- Use `com.nursebridges.mobile` as the iOS bundle identifier and Android package.
- Keep the visible product language as NurseBridge/NurseBridges until owner finalizes public brand copy.
- Do not rename the local Xcode target/module unless the native tooling requires it.

Rationale:

- The owner created the Apple/app-store side as `nursebridges`.
- The public API domain is already `https://api.nursebridges.com`.
- Bundle/package identity drift blocks signing, TestFlight, Android release setup, and support documentation.

Consequences:

- All build readiness docs and app config must use `com.nursebridges.mobile`.
- Signed iOS install requires Xcode access to team `HKQJ75SQVF` and a matching provisioning profile for `com.nursebridges.mobile`.
- Any future public brand rename needs a deliberate release/versioning decision instead of casual search-and-replace.

Revisit if:

- The owner changes the final App Store / Play Store identity before beta distribution.
- Apple or Google package constraints require a different identifier.

## Current Next Move

```text
sync staged docs when VM access returns
        -> resolve Apple signing for com.nursebridges.mobile or recover Android access
        -> trigger one real-device patient create-request
        -> inspect request-specific logs if needed
        -> patch exact root cause if a failure remains
        -> regression test any code fix
        -> pnpm verify
        -> prove closed-beta workflow
        -> recheck Android before wider beta unless explicitly deferred
```
