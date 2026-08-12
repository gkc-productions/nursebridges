# RN Appointment Companion Scenario Deep Dive

Date: 2026-08-12

Status: pre-approval tabletop analysis; not permission to launch, change production, collect new health information, take payment, or represent NurseBridge as a licensed provider

Companion document: [RN Appointment Companion Decision Review](./rn-appointment-companion-decision-review.md)

## Executive Conclusion

The proposed RN Medical Appointment Companion can solve a real problem, but the current four-state `job` workflow is only a technical prototype. It is not yet a safe care-coordination service.

The defensible first product remains narrow:

> A managed, private-pay RN appointment companion service for planned adult outpatient visits in the Atlanta metro, with family visibility only when the patient authorizes it.

This review strengthens that recommendation with five conclusions:

1. **The patient, requester, payer, responsible party, emergency contact, and update recipient are separate roles.** One person may hold several roles, but paying does not grant access to health information or authority to make decisions.
2. **The RN is not merely a ride companion.** The paid value is preparation, structured observation, communication support, source-attributed instructions, teach-back, safe handoff, and a useful post-visit report within a tightly bounded scope.
3. **NurseBridge must operate the service, not just match strangers.** Intake, serviceability, quoting, credentials, assignment, visit planning, supervision, escalation, documentation, complaints, and quality review are part of the product.
4. **Georgia licensing and clinical governance are launch gates.** Georgia posted final adoption of updated Private Home Care Provider rules on July 14, 2026. Those rules expressly address medical-appointment accompaniment, service agreements, service plans, staffing, background checks, health screening, records, incidents, complaints, training, supervision, and quality improvement.
5. **Full owner consent can authorize staged product development, but cannot substitute for legal, clinical, insurance, employment, and privacy decisions.** Engineering may safely build low-risk foundations while professional gates remain unresolved; real-person paid service may not begin on owner consent alone.

## What Was Tested

This was a risk-based tabletop exercise, not a claim that every possible real-world event can be predicted. One hundred eight scenarios were traced across:

- identity, authority, capacity, and consent;
- intake, scope, scheduling, and cancellation;
- home/apartment access, transportation, mobility, and facility access;
- RN credentialing, staffing, matching, and worker safety;
- routine, delayed, changed, and unexpectedly complex appointments;
- clinical boundaries, emergencies, incidents, abuse, and mandatory reporting;
- visit documentation, family communication, privacy, and record correction;
- pricing, authorization, overtime, refunds, payout, and disputes;
- device, network, security, data, and business-continuity failures;
- quality management, complaints, accessibility, equity, fraud, and scale.

Each scenario asks four questions:

1. What should the patient and family experience?
2. What may or must the RN do?
3. What must the operator be able to see and control?
4. What evidence must exist afterward?

Gate labels used below:

- **Design:** resolve before approving the target domain/data contract.
- **Simulation:** resolve before staff run realistic simulated visits.
- **Real visit:** resolve before any real patient appointment, paid or unpaid.
- **Paid beta:** resolve before charging or compensating for a beta visit.
- **Scale:** may be manual during a tiny controlled beta but must exist before expansion.

## Current Product Versus Required Service

The current product supports a basic software loop:

```text
request -> nurse application -> admin assignment -> complete/cancel
```

The repository inspection confirms material gaps:

- scheduling is a free-form text field;
- patients can enter an hourly rate;
- address is one string;
- contact context and mobility notes are concatenated into `description`;
- patient and nurse can reach a one-action completion path;
- no visit plan, required checkpoint sequence, structured report, incident branch, family release, quote, payer, responsible-party authority, or correction workflow exists;
- current `open`, `assigned`, `completed`, and `cancelled` states cannot distinguish intake, serviceability, quoting, matching, visit execution, documentation, and review;
- current copy still sometimes says “nurse or caregiver,” while the proposed first clinical service is RN-only.

That means a successful technical smoke test does not demonstrate safe service readiness.

## Scenario Matrix

### A. Identity, authority, capacity, and consent

| ID | Scenario | Required safe result | Gate |
| --- | --- | --- | --- |
| A01 | Adult patient requests and pays for their own visit. | Verify account/contact, obtain current service and sharing consent, show quote, and allow revocation without destroying historical evidence. | Design |
| A02 | Adult child requests and pays for a capable parent. | Parent remains the care recipient and decision-maker; child gets only the access the parent authorizes. | Design |
| A03 | Adult child pays but patient refuses the service. | Stop intake or visit; do not let the payer override a capable patient's refusal; record cancellation without disclosing clinical detail. | Real visit |
| A04 | Patient wants the RN present but does not want the payer to receive a report. | Deliver service to the patient and restrict payer visibility to permitted billing information. | Design |
| A05 | Patient authorizes milestone messages but not the clinical summary. | Send only consented milestones; keep report and follow-up details unavailable to that recipient. | Design |
| A06 | Patient revokes family access during the appointment. | Apply revocation prospectively, stop new disclosures, preserve the consent/revocation audit, and notify operations without announcing private reasons. | Real visit |
| A07 | Two family members give conflicting instructions. | Follow the capable patient's direction or verified legal authority; place the visit on supervisor review if authority is unclear. | Real visit |
| A08 | Requester claims power of attorney or guardianship. | Verify relevant authority and scope before treating that person as a decision-maker; do not accept a relationship label as proof. | Real visit |
| A09 | Patient has fluctuating cognition but can express a choice at the visit. | Use a defined capacity/authority escalation protocol; RN does not independently adjudicate legal capacity through an app toggle. | Real visit |
| A10 | Patient becomes unable to communicate during the visit. | Escalate clinically, use verified representative information where applicable, and let facility/emergency professionals manage care decisions. | Real visit |
| A11 | Patient and health-care agent disagree while patient is capable. | Respect the patient's current choice unless qualified professionals determine another legal rule applies; document and escalate, not debate. | Real visit |
| A12 | The patient dies or is admitted and cannot complete ordinary consent/release steps. | Activate critical-incident and legal-review workflow; restrict notifications and records; do not auto-send a normal family summary. | Real visit |

### B. Intake, scope, scheduling, and cancellation

| ID | Scenario | Required safe result | Gate |
| --- | --- | --- | --- |
| B01 | Routine adult primary-care visit with confirmed time. | Capture appointment time, required arrival, expected duration, timezone, meeting point, and return plan separately. | Design |
| B02 | Appointment time is not yet confirmed. | Permit a `time_not_confirmed` state and follow-up task; never invent a timestamp or assign an RN prematurely. | Design |
| B03 | Request is for today or outside supported hours. | Route to manual review or decline according to lead-time/on-call policy; do not imply immediate availability. | Simulation |
| B04 | Patient enters an emergency symptom as a “visit request.” | Interrupt with emergency language, direct to 911/appropriate urgent channel, alert operations safely, and do not create a normal marketplace job. | Real visit |
| B05 | Request includes wound care, injections, medication administration, or lifting. | Route to clinical scope review or decline; no RN accepts prohibited work through free text. | Real visit |
| B06 | Request is pediatric. | Decline during first service phase with an appropriate referral/support response; do not expose it to nurses. | Design |
| B07 | Request describes uncontrolled behavioral or violence risk. | Place on restricted safety review; do not assign until a qualified clinical/safety determination and appropriate plan exist. | Real visit |
| B08 | Patient books two overlapping visits or submits a duplicate. | Detect likely duplicates, require confirmation, and prevent two active assignments/charges for the same service. | Simulation |
| B09 | Facility reschedules after assignment. | Version the appointment, reconfirm patient/RN/transport, adjust quote/payout by policy, and preserve the original schedule in audit. | Paid beta |
| B10 | Facility cancels before the RN leaves. | Notify all parties, release assignment, apply the disclosed cancellation policy, and avoid charging unrendered service. | Paid beta |

### C. Home/apartment, transport, mobility, and facility access

| ID | Scenario | Required safe result | Gate |
| --- | --- | --- | --- |
| C01 | Patient lives in an apartment with building, unit, callbox, gate, parking, and elevator details. | Store structured location/access fields; disclose exact instructions only after assignment; avoid ordinary-note storage for door/lock codes. | Design |
| C02 | Residence has stairs and patient uses a walker. | Match only to an approved mobility plan and RN competency; no improvisational lifting or transfer. | Real visit |
| C03 | Wheelchair does not fit the planned vehicle. | Detect during intake, revise transportation, or decline; RN must not solve it with an unsafe transfer. | Real visit |
| C04 | Elevator is out or entrance is inaccessible. | Contact patient/transport/facility, escalate to operator, and reschedule or use an approved accessible alternative. | Real visit |
| C05 | RN arrives but cannot enter or contact the patient. | Use timed no-contact protocol, authorized contact sequence, welfare/emergency threshold, and privacy-safe status updates. | Real visit |
| C06 | Aggressive pet, weapon, smoke, infestation, drug activity, or unsafe person is present. | RN does not enter or may leave; activate lone-worker/safety escalation without penalizing the RN. | Real visit |
| C07 | Patient asks RN to drive in the RN's vehicle. | Decline under first-release policy and activate the prearranged transport fallback; no ad hoc exception. | Real visit |
| C08 | Patient asks RN to drive the patient's vehicle. | Treat as out of scope until legal, insurance, licensing, motor-vehicle-record, authorization, and operating policies expressly permit it. | Paid beta |
| C09 | Rideshare or family driver is late, cancels, or leaves. | RN contacts operations, remains only within safe policy, activates fallback transport, and does not abandon an unsafe patient. | Real visit |
| C10 | Facility refuses RN entry or limits visitors. | Respect facility restrictions, show patient-authorized support documentation if appropriate, notify patient/operator, and never claim hospital affiliation. | Real visit |

### D. RN credentialing, staffing, matching, and worker safety

| ID | Scenario | Required safe result | Gate |
| --- | --- | --- | --- |
| D01 | RN has an active Georgia license. | Verify through the authoritative licensing source, record verification date/result, and monitor status changes rather than trusting an upload. | Real visit |
| D02 | RN presents a multistate compact license. | Verify lawful privilege to practice where the patient is located; credential rules use patient location, not RN home address. | Real visit |
| D03 | License expires, is restricted, or discipline appears after approval. | Automatically or manually suspend eligibility and active matching; assess affected assignments and notify appropriate governance owner. | Real visit |
| D04 | Background check, health screening, TB screening, training, CPR/BLS, or competency evidence is incomplete. | RN cannot receive real assignments until the approved credential matrix is complete and current. | Real visit |
| D05 | RN is clinically licensed but lacks mobility, dementia, oncology, or post-procedure competency needed for the visit. | Match by demonstrated task competency and visit plan, not by license alone. | Real visit |
| D06 | RN is sick, exposed to a communicable disease, or fails a facility requirement. | Remove from assignment without punitive pressure, trigger replacement, and follow infection/occupational-health policy. | Real visit |
| D07 | RN cancels before the visit. | Notify the customer, search approved replacement, preserve payout/cancellation policy, and offer refund/reschedule if safe staffing fails. | Paid beta |
| D08 | RN is late or stops sending checkpoints. | Trigger escalation timer and welfare/contact workflow; patient sees calm verified status, not an unconfirmed promise. | Real visit |
| D09 | No qualified RN is available. | Mark `unable_to_staff`, tell the customer promptly, release authorization/refund by policy, and never lower credential requirements silently. | Paid beta |
| D10 | RN is harassed, assaulted, accused of theft, or solicited off-platform. | Provide immediate safety support, restricted incident handling, non-retaliation, evidence preservation, and fair investigation. | Real visit |

### E. Visit execution and clinical boundary

| ID | Scenario | Required safe result | Gate |
| --- | --- | --- | --- |
| E01 | Normal appointment proceeds as planned. | RN confirms identity/consent, follows plan, records checkpoints, supports questions/teach-back, completes handoff and report. | Simulation |
| E02 | Patient asks RN, “What do you think I have?” | RN does not diagnose; redirects question to treating clinician and records source-attributed information only. | Simulation |
| E03 | Patient asks RN which treatment to choose. | RN supports clarification and patient questions without substituting an independent treatment recommendation. | Simulation |
| E04 | Provider communicates a medication change. | RN records exactly what treating team communicated, identifies source, supports teach-back, and does not independently alter or reconcile treatment. | Real visit |
| E05 | Medication list conflicts with the after-visit summary. | RN flags discrepancy to treating team before departure when possible and records unresolved discrepancy for urgent follow-up; no silent “fix.” | Real visit |
| E06 | Patient forgot documents, medications, identification, or referral. | Use pre-visit checklist and facility contact; record delay/reschedule outcome without taking custody of unnecessary originals. | Simulation |
| E07 | Appointment starts two hours late. | Show elapsed/included time, obtain preauthorized overtime or operator decision, protect RN pay, and do not abandon the patient unsafely. | Paid beta |
| E08 | Visit changes from routine consultation to an invasive procedure. | Pause and scope-check; facility obtains clinical consent; RN stays only if visit plan, competency, time, and responsible-adult rules permit. | Real visit |
| E09 | Sedation requires a responsible adult after discharge. | Confirm in advance whether RN legally/facility-wise qualifies and what aftercare is required; otherwise decline or arrange an approved responsible adult. | Real visit |
| E10 | Facility wants the RN to perform a clinical task. | RN follows employer scope/plan and applicable law, declines unapproved work, and escalates to supervisor. | Real visit |
| E11 | Patient falls in the home, parking area, or facility. | Activate immediate safety/emergency response, notify facility/911/supervisor as appropriate, and create an incident—not normal completion. | Real visit |
| E12 | Patient chooses to leave against clinical advice. | Facility handles its clinical process; RN supports safe communication, not coercion, and escalates transportation/handoff risks. | Real visit |
| E13 | Patient is unexpectedly admitted to the hospital. | Transition to incident/exception handoff, define when RN service ends, notify authorized parties, and reconcile time/records separately. | Real visit |
| E14 | Treating provider will not answer questions or provide written instructions. | Document that limitation, help patient identify the facility follow-up channel, and do not invent an interpretation. | Simulation |
| E15 | Patient asks RN to photograph, audio-record, or video-record the visit. | Default to no recording; follow facility policy and separately reviewed consent only if a future release supports it. | Design |
| E16 | RN discovers a follow-up task after report submission. | Add a signed, timestamped addendum; never erase or silently rewrite the original clinical record. | Real visit |

### F. Emergencies, incidents, safeguarding, and mandatory reporting

| ID | Scenario | Required safe result | Gate |
| --- | --- | --- | --- |
| F01 | Chest pain, stroke signs, severe breathing difficulty, or other emergency appears before departure. | Call 911/facility emergency response, provide appropriate nursing response within training, notify supervisor, and stop normal workflow. | Real visit |
| F02 | Emergency occurs in transit. | Driver follows emergency protocol; RN activates 911 and supervisor; app opens a critical incident and preserves timeline. | Real visit |
| F03 | Patient expresses suicidal or homicidal intent. | Use approved crisis/immediate-danger protocol and qualified escalation; do not manage through routine chat or family notification alone. | Real visit |
| F04 | RN suspects elder/disabled-adult abuse, neglect, exploitation, or self-neglect. | Protect immediate safety and follow Georgia mandated-reporting protocol; disclosure to suspected abuser is not automatic. | Real visit |
| F05 | Family member controlling payment appears to be exploiting the patient. | Separate payer access, restrict details, escalate safeguarding concern, and follow mandatory-reporting/legal process. | Real visit |
| F06 | Patient reports sexual abuse or domestic violence with alleged perpetrator nearby. | Prioritize safe communication and emergency/reporting protocol; do not confront alleged perpetrator or expose the report in family messaging. | Real visit |
| F07 | RN makes a medication, documentation, identity, or handoff error. | Immediate clinical mitigation, supervisor notification, incident record, disclosure process as advised, and quality/corrective action. | Real visit |
| F08 | RN violates scope, falsifies a checkpoint, or submits a false report. | Suspend access/assignment, preserve audit evidence, investigate, meet reporting duties, and protect patient continuity. | Real visit |
| F09 | Patient or family alleges misconduct but RN disputes it. | Separate safety action from final finding; restrict access, preserve evidence, provide fair review, and avoid retaliatory account actions. | Real visit |
| F10 | Data or message is sent to the wrong family recipient. | Stop further disclosure, preserve incident evidence, assess breach duties, notify privacy owner, and follow approved response plan. | Real visit |

### G. Documentation, family communication, privacy, and records

| ID | Scenario | Required safe result | Gate |
| --- | --- | --- | --- |
| G01 | RN records provider instructions and patient questions. | Structured report identifies source, time, unresolved items, teach-back, and author; it is not marketed as a substitute medical record. | Design |
| G02 | Family wants live updates throughout the visit. | Patient chooses recipient and categories; use neutral milestones by default and avoid diagnosis/medication text in push notifications. | Design |
| G03 | Patient wants different information sent to two relatives. | Authorization is recipient- and category-specific; one “share with family” boolean is insufficient. | Design |
| G04 | Payer requests the full report after the patient denied access. | Provide only permitted billing/service information; do not condition service or refund on health-information disclosure. | Paid beta |
| G05 | RN needs to correct a typo versus a material clinical statement. | Typo correction and clinical addendum have distinct, attributable version history; original remains recoverable. | Real visit |
| G06 | Patient disputes what the report says. | Allow a patient statement/dispute and supervised correction review; do not let either side overwrite the other silently. | Real visit |
| G07 | Patient requests a copy, amendment, restriction, deletion, or account closure. | Route through approved records/privacy workflow and applicable retention/legal-hold rules; do not promise deletion that law forbids. | Paid beta |
| G08 | Support staff need to troubleshoot a failed report. | Use role-limited support access, correlation IDs, redacted logs, access audit, and no routine exposure of clinical narrative. | Simulation |
| G09 | Replaced RN previously viewed exact address and plan. | Terminate access promptly, record access history, and give the replacement access only after formal assignment. | Real visit |
| G10 | A subpoena, regulator, law enforcement request, or family demand arrives. | Centralize legal review and disclosure logging; staff must not export records informally. | Paid beta |

### H. Pricing, authorization, time, payout, and disputes

| ID | Scenario | Required safe result | Gate |
| --- | --- | --- | --- |
| H01 | Patient attempts to choose the RN's hourly rate. | Remove rate bidding; NurseBridge quotes a standardized package and separately guarantees RN compensation. | Design |
| H02 | Customer accepts a three-hour package. | Show exactly what time is included: prep, travel, onsite, return/handoff, report, and which expenses may be additional. | Paid beta |
| H03 | Appointment ends early. | Apply the disclosed package/actual-service policy consistently and ensure it complies with the reviewed service agreement. | Paid beta |
| H04 | Appointment exceeds included time and payer is reachable. | Present fixed increments and updated authorized cap; RN continues only under safety and labor policy. | Paid beta |
| H05 | Appointment exceeds time and payer cannot be reached. | Use a preauthorized ceiling plus operator/safe-handoff rule; never make patient safety depend on an in-app purchase prompt. | Paid beta |
| H06 | Patient cancels after RN begins travel or arrives. | Charge only what reviewed law/agreement permits; clearly distinguish travel/staff charge from unrendered service. | Paid beta |
| H07 | NurseBridge cancels or cannot staff. | Full release/refund plus timely notice; apply a clear RN cancellation payout and replacement policy. | Paid beta |
| H08 | Parking, toll, rideshare, or facility fees arise. | Disclose policy before authorization, require receipts where appropriate, cap surprise expenses, and never let RN collect cash. | Paid beta |
| H09 | Customer disputes quality or files a chargeback. | Preserve service/checkpoint/report evidence, pause contested payout only under fair policy, and run complaint—not automatic blame. | Paid beta |
| H10 | Customer tips, offers gifts, or asks to pay RN directly. | Apply boundary/gift policy; prohibit cash/off-platform rate negotiation and record reportable solicitation. | Paid beta |

### I. Technology, security, and continuity

| ID | Scenario | Required safe result | Gate |
| --- | --- | --- | --- |
| I01 | RN has no cellular service inside a facility. | Offline-safe encrypted draft/checkpoints queue locally, show unsynced state, and sync idempotently without duplicates. | Real visit |
| I02 | RN phone battery dies or device is lost. | Use phone escalation fallback, remote session revocation, minimal on-device data, and recovery without fabricating timestamps. | Real visit |
| I03 | Patient device is unavailable. | Service can proceed through verified manual operations and consent evidence; care safety cannot depend on patient app uptime. | Real visit |
| I04 | API, Supabase, Cloudflare, or push notifications are down. | Operator has downtime roster/contact/visit-plan access appropriate to policy, manual event capture, and later reconciliation. | Real visit |
| I05 | User taps submit, assign, charge, or complete twice. | Idempotency and transactional guards prevent duplicate requests, assignments, authorizations, notifications, and terminal events. | Simulation |
| I06 | Device clock or timezone is wrong. | Preserve client observation time plus authoritative server time and flag discrepancies; do not trust device time as sole evidence. | Simulation |
| I07 | Two admins assign different RNs concurrently. | One transactional active-assignment constraint wins; loser receives a clear conflict and no PHI is released incorrectly. | Simulation |
| I08 | Account is taken over or nurse shares credentials. | Strong authentication, session/device visibility, rapid revocation, least privilege, suspicious-access monitoring, and incident workflow. | Real visit |
| I09 | Malicious file, free text, or link is uploaded. | Validate type/size, scan/quarantine where applicable, escape output, and avoid broad clinical-document uploads in first beta. | Simulation |
| I10 | Backup restore loses or duplicates events. | Tested restore, immutable IDs, reconciliation checks, retention controls, and no direct test restore using unmanaged production data. | Paid beta |

### J. Accessibility, quality, fraud, and scale

| ID | Scenario | Required safe result | Gate |
| --- | --- | --- | --- |
| J01 | Patient is blind, low-vision, deaf/hard-of-hearing, has limited dexterity, or cognitive limitations. | Accessible app and alternate assisted intake; facility remains responsible for qualified aids/interpreters where law applies. | Real visit |
| J02 | Patient has limited English proficiency. | Capture language need, arrange qualified language assistance through appropriate channel, and do not treat an unqualified RN/family member as default interpreter. | Real visit |
| J03 | Patient uses a service animal. | Capture practical need without discrimination; follow facility policy/law and clarify RN is not responsible for animal care. | Real visit |
| J04 | Fake patient, stolen card, or identity mismatch is suspected. | Hold assignment/disclosure, verify identity/payment through privacy-minimized fraud controls, and avoid accusatory clinical messaging. | Paid beta |
| J05 | Fake or altered RN credential is uploaded. | Authoritative-source verification controls eligibility; uploads alone never create “verified” status. | Real visit |
| J06 | Nurse and customer attempt to move future visits off-platform. | Enforce contract/boundary policy proportionately while preserving emergency/support access and avoiding unsafe lockout during an active visit. | Paid beta |
| J07 | Patient gives a low rating based on protected characteristics or RN reports discrimination. | Use structured quality/complaint review, not unmoderated star ratings as staffing truth. | Paid beta |
| J08 | A complaint reveals a recurring process defect. | Quality program trends complaints/incidents, assigns corrective action, verifies effectiveness, and can pause a service category. | Paid beta |
| J09 | Demand exceeds staffing or supervisor capacity. | Stop accepting beyond serviceable capacity, communicate honestly, and maintain safe ratios/response coverage. | Scale |
| J10 | NurseBridge expands geography, pediatrics, procedures, transport, insurance billing, or automated matching. | Treat each as a new regulated product decision with separate legal/clinical/insurance/data review, not a feature flag. | Scale |

## Tabletop Findings

The 108 scenarios classified by their earliest unresolved gate are:

| Earliest gate | Scenario count | Meaning |
| --- | ---: | --- |
| Design | 13 | Resolve before the target domain and authorization contract is approved. |
| Simulation | 12 | Resolve before realistic staff simulations are treated as evidence. |
| Real visit | 58 | Resolve before any real patient appointment, even if unpaid. |
| Paid beta | 23 | Resolve before charging a customer or operating compensated beta visits. |
| Scale | 2 | May be manual in a tiny beta but must be formalized before expansion. |

These counts do not mean the current system “passes” the other scenarios. They identify the earliest point at which each missing control becomes mandatory. The existing technical workflow is not evidence that the real-visit or paid-beta gates are satisfied.

### The happy path is the minority of the product

The current app primarily represents E01: a normal appointment that ends normally. The operational burden is concentrated in the exceptions—authority disputes, delays, transport failures, changing acuity, no-shows, unsafe homes, facility restrictions, medication discrepancies, emergencies, reporting, overtime, and disclosures.

A safe system must make the exception path first-class. It cannot hide exceptions in free text or ask an admin to repair status manually after the fact.

### The platform needs six people/authority concepts, not one patient account

Required concepts:

1. **Care recipient:** the adult receiving the service.
2. **Requester/customer:** the person arranging the service.
3. **Payer:** the person/payment account responsible for charges.
4. **Responsible party or legal representative:** verified authority and its scope.
5. **Emergency contact:** used only under the approved circumstances.
6. **Update recipient:** authorized for specific milestone or summary categories.

The same human may occupy several roles. The data model must not assume that they do.

### “RN companion” must be defined as a protocol, not a title

The RN's value should be visible in required work products:

- pre-visit readiness check;
- reviewed visit plan and task boundary;
- patient-prepared question list;
- arrival, patient-met, facility-arrival, appointment, return, and handoff checkpoints;
- source-attributed instructions from treating staff;
- medication discrepancy flag, never an independent change;
- teach-back status;
- unresolved issues and follow-up ownership;
- safe handoff evidence;
- signed report and, where necessary, addendum or incident report.

The RN must not be paid merely to remain nearby and press Complete.

### Apartment and residence details must be structured and privacy-tiered

The patient intake needs more than `address`:

- start-location type;
- street address, building, unit, and facility name;
- callbox/gate method without storing durable secret codes in ordinary notes;
- stairs, elevator, accessible entrance, loading zone, and parking;
- mobility device dimensions/type when relevant;
- transfer and lifting boundary;
- pets, smoking, weapons, infection, or other safety screening;
- who will answer and who may be contacted if no one responds;
- transport provider, pickup window, return plan, backup, and responsible handoff person.

Before assignment, the RN sees only the general area and serviceability summary. Exact access details are released only to the actively assigned RN.

### Facility entry is not guaranteed

Patients can generally designate visitors/support persons subject to consent and clinically necessary or reasonable facility restrictions. NurseBridge must still:

- confirm the facility's visitor/support-person policy when material;
- provide a patient-signed companion authorization, not a hospital credential;
- never claim privileges, employment, endorsement, or guaranteed access;
- have a remote-support or reschedule outcome when entry is denied;
- distinguish support-person status from legal decision-making authority.

### The privacy posture must be determined, not assumed

HIPAA applies only if NurseBridge is a covered entity or business associate under the facts. A consumer health app can still face FTC Act and Health Breach Notification Rule duties even when HIPAA does not apply. The design should therefore use HIPAA-grade data minimization and security without publicly claiming HIPAA compliance before counsel confirms status and controls.

Required decisions include:

- legal role under HIPAA and state law;
- whether any provider relationship makes NurseBridge a business associate;
- approved vendors and business-associate agreements where required;
- FTC Health Breach Notification Rule applicability;
- Georgia and other applicable breach duties;
- five-year-or-longer record retention if PHCP rules apply;
- deletion, amendment, access, legal hold, and regulator-request handling;
- privacy-safe push, email, SMS, logs, analytics, and support tools.

### Accessibility is core serviceability

The target users include older adults and people with mobility, vision, hearing, speech, dexterity, cognitive, and language needs. Accessibility cannot be a final polish pass.

The product target should be WCAG 2.2 AA-informed web/mobile behavior plus real assistive-technology testing. Intake must also identify the facility-provided qualified interpreter or auxiliary aid needed. A NurseBridge RN or family member should not become the default medical interpreter merely because they are present.

### Workforce cost includes more than appointment minutes

Pricing must cover all compensable/operational work:

- intake and plan review;
- travel rules and mileage/parking policy;
- patient/facility waiting time;
- onsite visit time;
- return and handoff;
- documentation and corrections;
- mandatory training and competency;
- supervisor/on-call time;
- credentialing, health screening, payroll, workers' compensation, insurance, support, and quality review;
- overtime, cancellations, refunds, and incident reserve.

Hourly RNs generally remain eligible for overtime; registered-nurse status alone does not make an hourly employee exempt. Travel between worksites during the workday can be compensable. Employment counsel/payroll must approve the actual model.

## Pricing Deep Dive

### Patient-selected pricing is not recommended

Letting a vulnerable patient choose a rate creates four problems:

- no connection to the RN's required compensation or competence;
- inequitable access to qualified nurses;
- pressure to underprice safety, travel, documentation, and supervision;
- uncontrolled negotiation that makes NurseBridge look like a gig board rather than a managed service.

NurseBridge should own price and payout separately.

### Market signals, not an approved price

Current signals reviewed on 2026-08-12 include:

- Atlanta RN median wage of about **$48.31/hour** before employer burden and operating cost;
- public independent advocate examples around **$125–$150/hour**, sometimes plus travel;
- a 2026 cost-of-care survey showing a Georgia private-duty RN market signal around **$98/hour** and **$135/visit** for a different category of service.

These are not apples-to-apples quotes and do not establish NurseBridge's price. They show that a customer-facing rate near ordinary companion-care pricing is unlikely to fund a reliable RN-managed service.

### Required unit-economics formula

```text
Customer package price
  = direct RN compensation for all defined work
  + payroll/contractor burden approved by counsel
  + travel/mileage/parking reserve
  + clinical supervision and operator time
  + credentialing/training/health-screening allocation
  + insurance, technology, payment, support, and quality allocation
  + cancellation/incident/refund reserve
  + sustainable operating margin
```

### Recommended price-discovery structure

Do not publish a final number yet. Test willingness to pay with a reviewed quote range and real cost sheet.

Provisional package architecture:

```text
RN Appointment Companion — Standard
  one pre-visit preparation call
  reviewed visit plan
  up to three hours of defined visit coverage
  structured report and one authorized summary
  fixed additional 30-minute increments
  disclosed travel zone and parking/toll policy
  preauthorized maximum for unavoidable facility delay
```

The exact definition of “three hours” must say whether travel, preparation, return, handoff, and report time are inside or outside the customer window. RN compensation must cover every hour the law and operating model treat as work even if the customer sees a fixed package.

### Overtime and delay policy

Healthcare appointments are unpredictable. The safe design is:

- customer sees included window and incremental price before purchase;
- customer preauthorizes a maximum extension amount;
- app warns operator/RN before the included time ends;
- operator tries to contact payer/requester;
- patient safety and safe handoff govern whether RN may leave;
- RN is always paid according to employment agreement, even if customer authorization later fails;
- disputed overage is handled after safe handoff, not at bedside.

## Missing Product Capabilities

### Patient and family product

Required before a real visit:

- role-aware onboarding: self, arranging for another adult, payer, representative;
- native calendar and time picker, timezone, arrival time, expected duration, and unconfirmed state;
- structured residence, apartment, access, mobility, equipment, transport, communication, and handoff fields;
- emergency and out-of-scope interruption;
- quote, authorization, cancellation, and overage terms;
- versioned service and sharing consent;
- named update recipients with category-level permission;
- nurse identity/credential summary after assignment;
- live but privacy-minimized milestones;
- patient-safe report, follow-up checklist, acknowledgement, dispute, complaint, and correction request;
- accessibility and assisted-intake path.

### Nurse product

Required before a real visit:

- authoritative credential status, competency matrix, training expiry, health screening, and eligibility;
- availability and travel-zone controls;
- minimum-necessary opportunity preview and guaranteed payout;
- full plan only after formal assignment;
- visit-plan acknowledgement and pre-visit readiness checklist;
- structured checkpoint workflow with offline state;
- quick access to supervisor, 911 guidance, safety exit, and incident path;
- source-attributed instruction and follow-up capture;
- teach-back, safe-handoff, and unresolved-issue requirements;
- signed report, correction/addendum, and attestation;
- time, travel, cancellation, and payout record;
- no one-tap completion before required evidence exists.

### Admin and clinical operations

Required before a paid beta:

- intake/serviceability queue with due times and scope checklist;
- verified authority/consent view separated from clinical notes;
- quote and authorization workbench;
- credential/competency/expiry workbench;
- eligibility-filtered matching and transactional assignment/replacement;
- live visit exception board, not an implied monitoring guarantee;
- supervisor/on-call escalation and response clock;
- incident/safeguarding restricted workspace;
- report-quality/release queue and addendum history;
- complaints, disputes, refunds, service recovery, and corrective action;
- records/access/revocation requests;
- staffing capacity, overtime, payroll/payout, and reconciliation;
- quality metrics and stop-service control.

## Missing Operating Policies and Evidence

No app can safely replace these operating artifacts:

1. Legal opinion on Georgia PHCP applicability, category, location, and launch authority.
2. Approved service description, inclusion/exclusion criteria, and advertising claims.
3. Service agreement, client rights/responsibilities, cancellation, pricing, complaint, and regulator-contact language.
4. Capacity, responsible-party, advance-directive, guardianship, and consent-verification procedure.
5. Family-sharing, revocation, minimum-necessary, record-access, correction, retention, breach, and legal-request policy.
6. RN job description, employment classification, wage/time/travel/overtime, scheduling, and cancellation-pay policy.
7. Credential matrix: Georgia privilege, Nursys monitoring, background check, references, health/TB screening, CPR/BLS, training, and task competency.
8. Clinical governance charter with named Georgia RN supervisor, consultation coverage, documentation standard, and peer/quality review.
9. Intake triage and serviceability protocol with explicit emergency, pediatric, high-acuity, behavioral, transfer, infection, and equipment exclusions.
10. Lone-worker, unsafe-home, workplace-violence, bloodborne-pathogen/exposure, PPE, respiratory illness, injury, and workers' compensation program.
11. Transportation, vehicle, rideshare, facility access, parking, delayed return, and safe-handoff policy.
12. Emergency, fall, deterioration, hospitalization, death, medication discrepancy, missing patient, and unable-to-contact protocols.
13. Georgia elder/disabled-adult abuse, neglect, exploitation, and other mandatory-reporting procedure and training.
14. Incident classification, response clocks, investigation, disclosure, external reporting, corrective action, and retention.
15. Complaint, non-retaliation, refund, chargeback, disputed report, and service-recovery policy.
16. Accessibility, effective communication, qualified interpreter, service animal, and reasonable modification process.
17. Downtime/business-continuity process with protected offline access, manual roster, reconciliation, and tested restoration.
18. Insurance evidence: professional liability, general liability, cyber/privacy, workers' compensation, hired/non-owned auto as relevant, and policy fit for the exact service.
19. Quality improvement plan with metrics, case review, trend review, competencies, patient feedback, nurse feedback, and stop thresholds.
20. Beta protocol, simulation scripts, monitoring roster, support window, emergency contacts, and signed go/no-go record.

## What Not To Build Yet

- public nurse marketplace or patient bidding;
- automated matching or algorithmic clinical suitability decisions;
- nurse-owned patient transportation;
- medical procedures or medication administration;
- pediatrics, emergencies, uncontrolled high acuity, or complex transfers;
- open patient-nurse chat without retention, consent, moderation, and emergency boundaries;
- continuous GPS or public live map;
- audio/video recording;
- AI-authored clinical summaries or treatment recommendations;
- unmoderated nurse star ratings;
- hospital/EHR integration, hospital-affiliation claims, or facility credential claims;
- insurance claims, Medicare/Medicaid billing, subscriptions, or nationwide expansion.

## Recommended Build Sequence After Owner Consent

Owner consent should authorize this order, not a single broad implementation jump.

### Wave 0 — focused trust and usability fixes

- deploy/verify the admin logo asset;
- replace typed date/time with accessible native controls;
- remove patient-entered rate from UI and request acceptance;
- split apartment/access/mobility/transport details in a non-production domain contract;
- remove patient-side one-tap completion from the target experience;
- keep all changes compatible with the current prototype until migration approval.

### Wave 1 — domain and safety foundation

- model care recipient, requester, payer, authority, emergency contact, and update recipients separately;
- define request, assignment, visit, report, incident, consent, quote, and audit state machines;
- add exhaustive transition, authorization, idempotency, concurrency, and disclosure tests;
- design migration/rollback without applying it to production.

### Wave 2 — professionally reviewed intake and agreements

- implement only after clinical/legal/privacy review of the exact fields and wording;
- structured serviceability and scope rules;
- service agreement, client rights, consent, revocation, quote, and cancellation;
- admin review before every assignment.

### Wave 3 — RN execution and operations

- credential and competency gates;
- visit plan and acknowledgement;
- offline-safe checkpoints;
- escalation, incident, mandatory-reporting, and safe-handoff paths;
- supervisor and operator workbenches.

### Wave 4 — report and continuity

- structured, source-attributed RN report;
- patient/family-safe projection;
- granular recipient release;
- follow-up checklist, acknowledgement, dispute, and addendum;
- quality review and complaint workflow.

### Wave 5 — simulation and tiny controlled beta

- conduct scripted simulations before real patients;
- require written legal/clinical/insurance/employment/privacy go/no-go;
- limit geography, hours, visit type, patient count, and RN pool;
- manually monitor every visit;
- stop on any safety, privacy, authority, assignment, documentation, or continuity failure.

## Owner Decisions Needed Before Full Build Consent

Recommended defaults are shown so the owner can approve or revise them explicitly.

1. **Customer:** adult family caregivers and capable adult patients coordinating planned outpatient care.
2. **Care recipient:** adults only; older or medically vulnerable does not automatically mean incapable.
3. **Geography:** Atlanta metro, Georgia only, using explicit service zones and operating hours.
4. **Service:** RN Medical Appointment Companion plus bounded care-navigation support.
5. **Operating model:** managed service, not open marketplace.
6. **Staffing:** small W-2/PRN RN pool unless employment counsel approves another model.
7. **Clinical governance:** named Georgia RN supervisor and after-hours/visit-window escalation coverage before real visits.
8. **Transportation:** patient/family/facility/vetted third party; no RN-owned transport in first release.
9. **Scope exclusions:** emergency, pediatric, high-acuity, skilled procedures, medication administration, complex transfer/lift, uncontrolled behavioral risk.
10. **Facility role:** authorized support person only; no hospital affiliation, privileges, or guaranteed entry.
11. **Party separation:** care recipient, requester, payer, responsible party, emergency contact, and update recipients modeled independently.
12. **Authority:** patient direction controls while capable; claimed representative authority is verified before use.
13. **Family sharing:** named recipients, granular categories, revocable; payer status never grants health access.
14. **Accessibility:** assisted intake and qualified communication-support planning are launch requirements.
15. **Pricing:** company-set fixed package, not patient-set rate or nurse negotiation.
16. **Time model:** disclose exactly what package includes; use fixed overtime increments and a preauthorized safety ceiling.
17. **RN compensation:** pay for all required work under reviewed wage/time/travel rules, including documentation and qualifying travel/wait time.
18. **Cancellation:** transparent customer/provider policies consistent with Georgia requirements and safe staffing.
19. **Credentials:** authoritative license/privilege verification plus background, health/TB, CPR/BLS, training, and task competency.
20. **Regulatory posture:** assume PHCP applicability until written Georgia review and licensing determination.
21. **Privacy posture:** determine HIPAA/BA/HBNR/state duties; build data-minimized controls before making compliance claims.
22. **Retention:** support applicable minimum retention and immutable correction history; no unconditional delete promise.
23. **Incident/safeguarding:** mandatory reporting, emergency, complaint, investigation, corrective action, and non-retaliation are operating gates.
24. **Beta size:** no more than 5–10 carefully screened adult patients and 2–5 RNs, one monitored visit at a time initially.
25. **Expansion rule:** every new service category or geography requires a separate decision review.

## Approval Boundary

If the owner later says “approved” or gives “full consent,” the safe interpretation should be:

- approve the 25 product defaults above or list exceptions;
- authorize staged repository implementation in Waves 0–4;
- authorize non-production migrations, tests, fixtures, simulations, and documentation;
- require a complete tracked diff and verification before each production-affecting step;
- **do not** authorize production schema changes, real-patient service, payment processing, launch claims, app-store release, external tester invitations, or deployment without the separately named gate for that action.

This prevents a broad product approval from accidentally becoming permission to provide a regulated service before the business is ready.

## Evidence-Based Launch Gates

### Gate 1 — product direction

- owner decisions recorded;
- new ADR reconciles this service with the existing marketplace blueprint;
- target domain and authorization model approved;
- “what not to build” list accepted.

### Gate 2 — professional readiness

- written Georgia licensing determination and operating authority;
- clinical governance and scope approved;
- insurance bound for exact activities;
- employment/payroll model approved;
- privacy/consent/breach/retention posture approved.

### Gate 3 — operational readiness

- named administrator, RN supervisor, support, safety, privacy, and engineering owners;
- credentials and competencies complete;
- policies 1–20 above approved and trained;
- downtime, incident, mandatory-reporting, complaint, and refund drills pass.

### Gate 4 — technical readiness

- transactional assignment and terminal workflow;
- role/row-level disclosure tests;
- offline/idempotency/concurrency tests;
- accessible patient/nurse/admin flows;
- signed device builds and real-device simulations;
- audit, backup, restore, and reconciliation proof.

### Gate 5 — real-person pilot

- separate written go/no-go;
- screened participants and narrow appointment types;
- confirmed facility/transport/consent/authority;
- one monitored visit at a time initially;
- stop conditions acknowledged;
- no expansion until safety, report quality, satisfaction, staffing, and unit economics are reviewed.

## Sources Reviewed

Authoritative sources:

- [Georgia DCH Private Home Care Program](https://dch.georgia.gov/divisionsoffices/hfrd/facilities-provider-information/private-home-care-program)
- [Georgia PHCP Rules 111-8-65](https://rules.sos.ga.gov/gac/111-8-65)
- [Georgia DCH July 2026 PHCP final-adoption document](https://dch.georgia.gov/document/document/private-home-care-providers-111-8-65-rules-final-adoption/download)
- [Georgia Board of Nursing practice standards](https://rules.sos.ga.gov/gac/410-10?preview=true&site_id=837)
- [Georgia nursing licensure and Nursys guidance](https://sos.ga.gov/page/faqs-nursing)
- [Georgia vulnerable-adult abuse and mandatory-reporting guidance](https://aging.georgia.gov/report-elder-abuse-neglect-or-exploitation/abuse-neglect-and-exploitation-vulnerable-adults-georgia)
- [Georgia Advance Directive for Health Care](https://aging.georgia.gov/sites/aging.georgia.gov/files/related_files/service/GEORGIA_ADVANCE_DIRECTIVE_FOR_HEALTH_CARE-10.pdf)
- [Georgia workers' compensation employer guidance](https://sbwc.georgia.gov/employer-information)
- [HHS family/friend sharing guidance](https://www.hhs.gov/hipaa/for-professionals/faq/2087/does-hipaa-allow-a-health-care-provider-to-communicate-with-a-patients-family-friends-or-other-persons-who-are-involved-in-the-patient-care.html)
- [HHS covered entities and business associates](https://www.hhs.gov/hipaa/for-professionals/covered-entities/index.html)
- [HHS health-app developer resources](https://www.hhs.gov/hipaa/for-professionals/special-topics/health-apps/index.html)
- [FTC Health Breach Notification Rule guidance](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0)
- [CMS hospital visitation/support-person interpretive guidance](https://www.cms.gov/manuals/Downloads/som107ap_a_hospitals.pdf)
- [ADA effective communication guidance](https://www.ada.gov/resources/effective-communication/)
- [DOJ web accessibility guidance for businesses](https://www.ada.gov/resources/web-guidance/)
- [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/)
- [AHRQ Re-Engineered Discharge toolkit](https://www.ahrq.gov/sites/default/files/wysiwyg/professionals/systems/hospital/red/toolkit/redtoolkit.pdf)
- [AHRQ patient and family engagement guide](https://www.ahrq.gov/patient-safety/patients-families/engagingfamilies/index.html)
- [OSHA home-healthcare hazards](https://www.osha.gov/home-healthcare/)
- [CDC respiratory-virus infection-control guidance](https://www.cdc.gov/project-firstline/hcp/infection-control/index.html)
- [U.S. DOL health-care hours worked](https://www.dol.gov/agencies/whd/fact-sheets/53-healthcare-hours-worked)
- [U.S. DOL overtime guidance for nurses](https://www.dol.gov/agencies/whd/fact-sheets/17n-overtime-nurses)
- [O*NET Atlanta RN wage data](https://www.onetonline.org/link/localwages/29-1141.00?zip=30350)
- [IRS standard mileage rates](https://www.irs.gov/tax-professionals/standard-mileage-rates)

Market signals, not legal authority or approved NurseBridge pricing:

- [Compass Healthcare Navigators public services and fees](https://www.compasshcn.com/)
- [Graithful public advocacy pricing](https://graithful.org/patient-advocate-services/)
- [CareScout 2026 Cost of Care survey](https://assets.carescout.com/x/8fcb50422f/282102.pdf)

All sources were reviewed on 2026-08-12. Laws, rules, guidance, wages, rates, and vendor offerings can change. Qualified reviewers must validate the controlling requirements at the time of implementation and launch.
