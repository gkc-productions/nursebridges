# RN Appointment Companion Decision Review

Date: 2026-08-12

Status: proposed; owner, legal, clinical, insurance, and operating-model approval required before implementation

## Purpose

This document reconciles the external Product Decision Memo with the current NurseBridge repository, the proven patient-to-nurse workflow, and Georgia-first regulatory research. It is a decision packet, not permission to launch, change the production schema, collect additional health information, take payment, or represent NurseBridge as a licensed clinical provider.

If approved, this direction supersedes the broad marketplace assumptions in the current `jobs` and `applications` experience. Existing production behavior remains a technical prototype until the service model and operating prerequisites below are satisfied.

## Executive Recommendation

NurseBridge should not launch as an open marketplace or an “Uber for nurses.” The proposed first service is:

> RN Medical Appointment Companion for Georgia family caregivers coordinating planned outpatient appointments for older or medically vulnerable adults.

The controlled first service should use:

- Atlanta-metro coverage;
- private-pay patients or family caregivers;
- RN-only delivery;
- patient-, family-, facility-, or vetted-third-party-arranged transportation;
- manual intake, scope review, quoting, matching, and assignment;
- structured visit checkpoints;
- consent-controlled family updates;
- mandatory post-visit documentation;
- no nurse-owned patient transport;
- no medication administration or skilled treatment;
- no emergency, pediatric, high-acuity, or complex-lifting cases;
- no public marketplace, patient bidding, automatic matching, or hospital-affiliation claims.

The safest planning assumption is that Georgia Private Home Care Provider requirements may apply. Qualified Georgia counsel and the Georgia Department of Community Health must determine the actual licensing path before paid service.

## Why This Changes the Existing Product

The current system proves a software state transition:

```text
patient creates request
    -> approved nurse applies
    -> admin assigns
    -> nurse or patient presses complete
    -> patient/admin sees completed
```

That is not yet a complete care service. The proposed product must prove:

```text
appropriate request
    -> informed consent
    -> serviceability and risk review
    -> transparent quote
    -> qualified RN match
    -> pre-visit plan
    -> observable visit checkpoints
    -> safe escalation and handoff
    -> accurate structured report
    -> authorized patient/family delivery
    -> quality and incident review
```

## Current-System Conflicts

### 1. Open marketplace versus managed service

Current behavior exposes open requests to every approved nurse and allows nurses to apply. The recommended service is a managed clinical operation. During beta, admins should invite or match qualified nurses to a limited request preview rather than expose a broad opportunity feed.

Decision recommendation:

- retain manual assignment;
- replace open browsing with eligibility-filtered invitations or a tightly limited opportunity list;
- disclose only minimum-necessary information before assignment;
- do not allow direct nurse-patient rate negotiation.

### 2. Patient-selected hourly rate

Current patient intake includes an optional `hourly_rate`. That conflicts with a standardized care package and guaranteed nurse payout.

Decision recommendation:

- remove rate entry from patient UI;
- keep the database column temporarily for compatibility, but stop accepting it from new patient requests after the new contract is introduced;
- add a quote model later through a reviewed schema migration;
- show the nurse a guaranteed payout and the customer a total authorized price.

### 3. Free-form appointment scheduling

Current patient intake accepts a typed date/time string.

Decision recommendation:

- use native calendar and time controls;
- separately capture appointment time, required arrival time, expected duration, and timezone;
- support a “time not confirmed” state without inventing a timestamp;
- validate that planned appointments are in the future and inside supported operating hours.

### 4. One description field is carrying multiple concepts

Current payload construction folds contact context and mobility notes into `description`. This prevents reliable matching, privacy separation, safety review, reporting, and analytics.

Decision recommendation:

- stop encoding structured care fields inside free text;
- introduce separate intake, access, mobility, transportation, consent, and responsible-party records;
- keep pre-match summaries distinct from assigned-nurse details.

### 5. Single-button completion

Current nurse and patient surfaces can complete an assigned job through one terminal action.

Decision recommendation:

- remove patient-initiated service completion from the target workflow;
- require an assigned nurse to complete all required checkpoints and a structured report;
- allow the patient/family to acknowledge, dispute, or request follow-up, not clinically complete the service;
- allow admin override only for documented exceptions with an audit event;
- keep clinical escalation separate from normal completion.

### 6. Four job states are insufficient

The current `open`, `assigned`, `completed`, and `cancelled` states combine intake, matching, service execution, documentation, and review into one field.

Decision recommendation:

- retain the current enum until an approved migration exists;
- design a new request lifecycle and a separate visit execution lifecycle;
- do not expand the production enum piecemeal;
- migrate existing records through an explicit compatibility plan.

### 7. Assignment source-of-truth drift

The repository expects `jobs.assigned_nurse_user_id`, but the live production schema currently lacks that column and derives assignment from an accepted application.

Decision recommendation:

- resolve the canonical assignment model before building visit execution;
- use one transactional command/RPC for assignment;
- preserve the accepted application as evidence, not the only assignment source;
- do not add more workflow tables while the assignment contract is split.

### 8. Audit and completion evidence are incomplete

The proven production request contains an assignment audit event but no completion audit event. The admin UI fix can truthfully reconstruct current state for display, but reconstruction is not a substitute for immutable workflow evidence.

Decision recommendation:

- every state-changing command writes its audit event transactionally;
- checkpoints and report revisions are append-only or versioned;
- incident and override records cannot be silently replaced;
- audit metadata must remain privacy-minimized.

### 9. Logo absence is operational, not strategic

The admin layout references `/brand/nursebridge-mark.png`, and the asset is tracked locally under `apps/admin/public/brand`. The missing production logo should be handled as a focused static-asset deployment verification:

- inspect the live asset response;
- verify the VM release contains the `public/brand` asset;
- include `public` assets in the deploy manifest;
- rebuild/restart only the admin service;
- verify desktop and mobile headers through Cloudflare Access;
- avoid redesigning the brand component unless the asset itself fails visual review.

## Proposed Service Boundary

### Included in the first controlled service

Before the visit:

- confirm appointment, facility, department, arrival time, and meeting point;
- confirm transportation and safe-return plan;
- review mobility, equipment, communication, and access needs;
- organize patient-prepared questions and documents;
- confirm authorized patient and family contacts;
- review service limitations and escalation paths.

During the visit:

- accompany the patient as an authorized support person;
- support check-in and wayfinding;
- provide only pre-approved mobility assistance within training and service plan;
- take non-diagnostic notes;
- prompt patient-prepared questions;
- ask the treating team to clarify its own instructions;
- support teach-back;
- document instructions as communicated by the treating team;
- escalate urgent or out-of-scope needs to facility staff, 911, or the NurseBridge supervisor as appropriate.

After the visit:

- organize the written after-visit information;
- document reported follow-up steps, tests, referrals, and medication instructions with source attribution;
- confirm transportation and safe handoff;
- send only authorized family milestones or summaries;
- complete the structured report and attestation;
- file an incident or escalation record when required.

### Explicitly excluded from the first service

- emergency response beyond activation and escalation;
- diagnosis, prescribing, treatment selection, or independent interpretation;
- medication administration or alteration;
- wound care, injections, IV care, or other skilled procedures;
- audio/video recording;
- nurse-owned patient transportation;
- wheelchair/stretcher transport supplied by NurseBridge;
- complex lifting or unplanned transfers;
- pediatric care;
- uncontrolled behavioral-health or high-acuity cases;
- hospital-staff, hospital-case-manager, or treating-clinician representation;
- insurance billing, medical coding, or hospital integration;
- guarantees of outcomes, appointment access, or facility cooperation.

## Regulatory and Safety Gates

Before any paid or externally promoted clinical service, obtain written review of:

- Georgia Private Home Care Provider applicability and license category;
- whether the proposed service is nursing, personal care, companion/escort, or a combination;
- RN supervision and service-plan requirements;
- worker classification and the proposed W-2/PRN model;
- professional, general, cyber, workers' compensation, and vehicle-related insurance;
- patient service agreement, consent, client rights, complaints, refunds, and incident obligations;
- health-data privacy, breach notification, retention, deletion, and family authorization;
- advertising language and prohibited affiliation/compliance claims;
- facility access and the nurse's role as an authorized companion;
- payment handling, nurse payout, overtime, cancellations, and taxes.

Authoritative starting references:

- [Georgia Private Home Care Provider rules](https://rules.sos.ga.gov/gac/111-8-65)
- [Georgia Board of Nursing practice standards](https://rules.sos.ga.gov/gac/410-10)
- [HHS guidance on sharing with people involved in care](https://www.hhs.gov/hipaa/for-professionals/faq/2087/does-hipaa-allow-a-health-care-provider-to-communicate-with-a-patients-family-friends-or-other-persons-who-are-involved-in-the-patient-care.html)
- [AHRQ discharge and teach-back guidance](https://www.ahrq.gov/patient-safety/settings/hospital/red/toolkit/redtool3.html)
- [FTC Health Breach Notification Rule guidance](https://www.ftc.gov/business-guidance/resources/health-breach-notification-rule-basics-business)

## Proposed Product Lifecycle

Use one request lifecycle for commercial/operational state and one visit lifecycle for service execution.

### Request lifecycle

```text
draft
  -> submitted
  -> intake_review
  -> clarification_needed -> intake_review
  -> declined_out_of_scope
  -> ready_to_quote
  -> quote_presented
  -> quote_authorized
  -> matching
  -> assigned
  -> visit_active
  -> documentation_pending
  -> completed
```

Terminal or exception branches:

```text
cancelled_by_customer
cancelled_by_provider
expired
unable_to_staff
incident_hold
```

### Visit execution lifecycle

```text
scheduled
  -> confirmed
  -> nurse_en_route
  -> nurse_arrived
  -> patient_met
  -> facility_arrived
  -> appointment_in_progress
  -> appointment_ended
  -> return_in_progress
  -> safe_handoff
  -> report_submitted
  -> report_released
```

Visit checkpoints should be timestamped events rather than repeatedly overwriting a single status field. A missed or out-of-order checkpoint should create an admin exception, not silently rewrite history.

### Patient-facing lifecycle

```text
Request received
  -> Reviewing details
  -> Price ready
  -> Finding your nurse
  -> Nurse assigned
  -> Visit confirmed
  -> Nurse on the way
  -> Appointment support underway
  -> Returning safely
  -> Visit summary ready
  -> Completed
```

## Target Data Model

This is a logical design only. It is not authorization to modify Supabase.

### Preserve during migration

- `profiles`
- `nurse_profiles`
- `nurse_verification_documents`
- `notifications`
- `push_tokens`
- `admin_audit_logs`
- existing `jobs` and `applications` until compatibility migration is complete

### Proposed records

#### `service_requests`

Commercial and operational request root:

- patient owner;
- responsible-party/customer reference;
- service type;
- lifecycle status;
- requested date/time and timezone;
- required arrival time;
- expected duration;
- acuity/scope classification;
- required credential;
- general service area;
- created/updated/version timestamps.

#### `request_intake`

Structured serviceability data:

- appointment category;
- facility type;
- start/end location types;
- transportation plan;
- mobility category;
- transfer requirement;
- assistive devices;
- communication/language needs;
- patient consent capacity/representative state;
- safety flags;
- customer questions and practical notes.

Do not expose this entire record to browsing nurses.

#### `service_locations`

Separate start, facility, and handoff locations:

- general area safe for matching;
- exact address available only after assignment;
- unit/building instructions;
- stairs/elevator/accessibility;
- parking/loading instructions;
- onsite contact.

Avoid collecting door or lockbox codes in the first beta. If later required, create a separate encrypted, time-limited access-secret mechanism rather than storing them in ordinary notes.

#### `care_recipients` and `authorized_contacts`

Distinguish:

- authenticated customer;
- patient receiving service;
- legally authorized representative;
- emergency contact;
- family update recipients;
- scope and expiration of each sharing authorization.

#### `consent_authorizations`

Versioned proof of:

- service agreement;
- appointment-companion authorization;
- treating-team communication permission;
- family sharing permission;
- emergency escalation acknowledgement;
- transportation acknowledgement;
- privacy/data use;
- cancellation/payment terms.

Store consent version, subject, signer, authority, timestamp, revocation, and allowed recipients/categories. Do not reduce consent to a single boolean.

#### `service_quotes`

- included duration;
- customer price;
- guaranteed nurse payout;
- overtime interval and rate;
- parking policy;
- cancellation terms version;
- authorization status and expiration;
- manual adjustments with reason and actor.

Patient and nurse amounts should be separate fields and permissions.

#### `assignments`

- request;
- assigned nurse;
- assignment status;
- credential/eligibility snapshot;
- assigned-by actor;
- accepted/declined timestamps;
- cancellation/replacement reason;
- optimistic version.

One active assignment per request should be enforced transactionally.

#### `visit_plans`

The reviewed service plan for one visit:

- approved tasks;
- prohibited or excluded tasks;
- mobility plan;
- equipment;
- meeting and transport plan;
- authorized contacts;
- escalation instructions;
- supervisor approval and version;
- nurse acknowledgement.

#### `visit_events`

Append-only checkpoints:

- event type;
- actor;
- client timestamp and authoritative server timestamp;
- optional safe location category, not continuous background tracking;
- exception flag;
- request ID/correlation ID.

Do not implement continuous GPS tracking without a separate privacy, battery, consent, and safety review.

#### `visit_reports`

Versioned nurse documentation:

- service times;
- tasks performed;
- patient questions and whether asked;
- provider instructions as reported, with source attribution;
- tests/referrals/follow-up;
- medication instructions as reported, never independent recommendations;
- teach-back result;
- documents received;
- safe handoff;
- unresolved issues;
- nurse attestation;
- submitted/reviewed/released timestamps.

Raw clinical documentation and the patient/family summary should not be the same record.

#### `visit_summaries`

Patient/family-safe release:

- approved overview;
- follow-up checklist;
- allowed recipient scope;
- release version;
- acknowledgement/dispute state.

#### `follow_up_tasks`

- task category;
- plain-language instruction;
- source;
- owner;
- due date;
- completed state;
- escalation state.

The app must not silently convert a treating-provider statement into NurseBridge medical advice.

#### `incidents`

- type and severity;
- immediate action;
- escalation recipients;
- external emergency/facility involvement;
- privacy-minimized narrative;
- status, owner, resolution, and review;
- linked immutable audit events.

Incident access should be more restrictive than ordinary request access.

## Minimum-Necessary Disclosure Model

### Before nurse assignment

A matched nurse may see:

- general area;
- appointment category;
- date/time window;
- expected duration;
- credential requirement;
- mobility category and equipment summary;
- transportation arrangement;
- high-level serviceability/risk category;
- guaranteed payout;
- required documentation/family-update indicator.

They should not see:

- full name;
- exact residence;
- phone/email;
- named family contacts;
- detailed medical context;
- uploaded documents;
- provider identity when unnecessary;
- payment data;
- access instructions.

### After assignment and consent

The assigned nurse receives only the full details needed to execute the approved visit plan. Access ends when the operational retention policy says it should, and replacement nurses should not inherit access until formally assigned.

## Screen Map

### Patient and family app

#### Home

- current request milestone;
- next required action;
- assigned RN only after assignment;
- latest authorized update;
- support and safety.

#### New request: guided intake

1. Who needs support?
2. What kind of planned appointment?
3. Calendar date, appointment time, arrival time, expected duration.
4. Facility and meeting locations.
5. Transportation arrangement.
6. Apartment/building accessibility.
7. Mobility, equipment, communication, and language.
8. Responsible party and emergency contact.
9. Family update recipients and sharing choices.
10. Review limitations, consent, and submit.

Do not show pricing until intake review confirms the request is in scope.

#### Request detail

- simplified lifecycle;
- scope and visit plan summary;
- quote acceptance when ready;
- RN assignment and confirmation;
- live milestone updates;
- authorized messages;
- cancellation/help;
- final summary, tasks, receipt, acknowledgement, and dispute/help.

The patient can acknowledge or dispute completion but does not press a clinical “complete” action.

#### Care circle

- invited/authorized contacts;
- per-recipient sharing scope;
- authorization status and expiration;
- revoke access.

### Nurse app

#### Home

- credential/eligibility state;
- next confirmed visit;
- documentation due;
- exceptions requiring action;
- supervisor/support access.

#### Matched opportunities

- minimum-necessary preview;
- guaranteed payout and included duration;
- credential and mobility requirements;
- schedule/travel fit;
- accept/decline interest without patient negotiation.

#### Pre-visit plan

- full assigned details;
- authorized contacts;
- transportation and meeting plan;
- apartment/access and mobility information;
- approved/prohibited tasks;
- patient questions/documents;
- consent state;
- nurse acknowledgement;
- call support or report out-of-scope condition.

#### Active visit

- one required checkpoint at a time;
- timer and included-duration visibility;
- safety/escalation button;
- appointment questions;
- structured treating-provider instructions;
- family-update controls constrained by consent;
- offline-safe draft behavior if connectivity fails.

#### Completion report

- required structured sections;
- missing-field validation;
- incident/escalation branch;
- attestation;
- submit for release/review;
- no completion until required handoff and report evidence exists, except audited emergency override.

#### Earnings

Defer until pricing and payout operations are legally and financially approved. During beta, show only the guaranteed payout already accepted for a visit if needed.

### Admin operations

#### Intake queue

- new, clarification, out-of-scope, and supervisor-review queues;
- owner, priority, due time, last activity, and version;
- structured risk/scope checklist;
- request more information or decline with reviewed reason.

#### Quote workbench

- service package and duration;
- customer price and nurse payout separated by role;
- manual adjustment reason;
- authorization/expiration;
- cancellation policy version.

#### Matching and assignment

- eligible RNs only;
- credential/availability/travel/experience fit;
- minimum-necessary preview history;
- guarded, transactional assignment;
- replacement and cancellation paths.

#### Live visits

- expected versus actual checkpoints;
- late/no-show/missed-checkpoint exceptions;
- overtime request;
- safety escalation;
- no continuous clinical surveillance claim.

#### Documentation and quality

- missing or flagged report queue;
- supervisor review for incidents and selected audits;
- summary-release controls;
- correction/addendum history;
- complaint, dispute, and service recovery.

#### Incidents

- restricted workbench;
- severity and response clock;
- assigned owner;
- evidence and immutable timeline;
- corrective action and closure.

## Pricing Decision Framework

Do not ship the external memo's illustrative price as a product constant. The current Atlanta RN median wage is about $48.31/hour before burden and operating cost. Price discovery must separately establish:

- target RN payout needed for reliable PRN staffing;
- employee or contractor burden;
- paid travel and documentation time;
- clinical supervision and admin minutes;
- insurance and credentialing cost;
- cancellation/no-show reserve;
- payment processing and refunds;
- customer support and incident reserve;
- sustainable margin;
- customer willingness to pay.

Recommended customer presentation:

```text
RN Appointment Companion
Included visit window: 3 hours
Additional time: fixed 30-minute increments
Parking/tolls: disclosed policy
Transportation: arranged separately
Cancellation: disclosed before authorization
Total authorized amount: shown before matching
```

Recommended nurse presentation:

```text
Guaranteed payout
Included service and documentation time
Travel stipend or zone policy
Overtime increment
Cancellation payout policy
No patient negotiation or cash collection
```

Pricing interviews and written cost modeling come before payment automation.

## Implementation Sequence

### Phase 0: owner and professional decisions

No regulated workflow implementation until the owner approves the product direction and identifies who will provide:

- Georgia healthcare regulatory review;
- clinical governance;
- insurance review;
- employment classification review;
- privacy/consent review;
- pricing and accounting validation.

Safe engineering allowed in parallel:

- fix admin static logo deployment;
- add native calendar/time UX behind the existing request contract;
- remove patient-facing rate entry while leaving schema compatibility intact;
- write domain contracts and tests without collecting additional sensitive data.

### Phase 1: stabilize the current workflow foundation

- push/deploy the pending admin assignment/timeline fix;
- resolve canonical assignment schema and transactional command path;
- make audit creation transactional with assignment and terminal transitions;
- prevent patient-side direct completion in the target adapter;
- establish new workflow types in shared code with exhaustive tests;
- create a migration and rollback plan, but do not apply it without approval.

### Phase 2: structured intake without clinical overreach

- native scheduling controls;
- service type and expected duration;
- facility, transport, access, mobility, equipment, communication, and contact fields;
- progressive disclosure;
- admin intake review and clarification;
- in-scope/out-of-scope rules;
- no new diagnoses, medications, or clinical documents until consent/privacy design is approved.

### Phase 3: quote and managed matching

- versioned quote contract;
- manual price and payout entry for controlled testing;
- patient authorization state without charging money initially;
- eligibility-filtered nurse preview;
- guarded assignment and full-detail release;
- nurse acknowledgement of visit plan.

### Phase 4: visit execution and safety

- pre-visit confirmation;
- checkpoint event model;
- missed-checkpoint and late/no-show exceptions;
- escalation and incident workflow;
- safe handoff requirement;
- offline-safe nurse drafts;
- audit and role-based access tests.

### Phase 5: reports and family continuity

- structured nurse report;
- source-attributed provider instructions;
- follow-up tasks;
- patient/family-safe summary projection;
- consent-controlled recipients;
- corrections/addenda;
- acknowledgement, dispute, complaint, and service recovery.

### Phase 6: controlled service and commercial readiness

- approved agreements and policies;
- bound insurance and operating authority;
- RN onboarding and competency evidence;
- supervisor and incident coverage;
- payment authorization, receipt, payout, refund, and reconciliation;
- simulated visits followed by a separately approved real-service pilot;
- measurable safety, quality, customer, nurse, and unit-economics outcomes.

## Decisions Required From the Owner

The following are recommended defaults. The owner should approve or revise each before application/schema work expands.

1. **Initial customer:** adult family caregivers coordinating planned outpatient care for older or medically vulnerable adults.
2. **Launch geography:** Atlanta metro, Georgia only.
3. **Service:** RN Medical Appointment Companion and Care Navigation Support.
4. **Staffing:** small RN-only, preferably W-2/PRN pool; no open gig marketplace.
5. **Transportation:** patient/family/facility/vetted third-party arranged; no nurse-owned patient transport.
6. **Clinical boundary:** no diagnosis, prescribing, medication administration, skilled treatment, complex lifting, emergencies, pediatrics, or high-acuity cases.
7. **Commercial model:** private pay, package price, guaranteed RN payout, no patient bidding.
8. **Beta operations:** every request manually reviewed and assigned; no automatic matching.
9. **Family access:** named recipients with granular, revocable authorization; no default family access.
10. **Completion authority:** assigned RN submits the report; patient/family acknowledges or disputes; admin uses audited exception handling.
11. **Regulatory posture:** assume PHCP applicability until written professional review says otherwise.
12. **Paid-launch gate:** no paid or externally promoted service until licensing, insurance, employment, consent/privacy, clinical governance, incident, and complaint requirements are resolved.

## Acceptance Criteria For This Decision Packet

Before this document becomes an accepted product blueprint:

- owner decisions 1–12 are recorded;
- contradictions with ADR 0001 and the existing product blueprint are resolved through a new ADR;
- legal/clinical/insurance questions have named owners and target dates;
- the initial service inclusion/exclusion policy is approved;
- a data-minimization and consent plan is approved before new sensitive fields are collected;
- a migration/rollback plan exists before database changes;
- an implementation milestone has explicit automated, visual, and real-device verification gates.
