# NurseBridge Experience Spec

This spec defines the product experience NurseBridge should build toward after the create-job blocker is fixed. It is intentionally practical: screens, priorities, states, and quality bars.

Use `docs/product/ui-implementation-brief.md` for the build slices, shared components, UI state rules, and QA checklist that implement this experience.

## Product Feel

NurseBridge should feel like a serious care coordination tool:

- Calm under stress.
- Operationally clear.
- Trustworthy without overclaiming.
- Fast to understand.
- Conservative with decoration.
- Built around status, next action, and records.

The app should not feel like a landing page, generic marketplace, social app, or student demo.

## Experience Architecture

```text
Patient/family mobile
        -> request help
        -> track status
        -> respond to assignment/outcome

Nurse/caregiver mobile
        -> verify identity/eligibility
        -> review open requests
        -> apply
        -> complete assigned work

Admin web console
        -> review queue
        -> verify caregivers
        -> assign
        -> resolve exceptions
        -> preserve audit trail
```

## Shared Design Rules

- One primary action per screen.
- Status appears near the top of every workflow screen.
- Every action should answer: what will happen, who will be notified, and whether it can be undone.
- Do not show unsupported compliance, licensure, insurance, or background-check claims.
- Use plain care language, not startup language.
- Avoid decorative cards, oversized hero sections, vague metrics, and marketing copy in operational views.
- Prefer compact, scannable information over fluffy empty space.
- Error messages should include a next step and a support-ready request reference when available.
- Destructive or terminal actions require explicit confirmation.

## Mobile Navigation

Use role-specific navigation after login.

Patient tabs:

```text
Home
Requests
Notifications
Account
```

Nurse tabs:

```text
Home
Open Requests
My Work
Verification
Account
```

The same user should not see both patient and nurse workflows mixed on one screen unless the product explicitly supports multi-role switching later.

## Patient Mobile

### Patient Home

Purpose:

- Tell the patient/family what is happening now.
- Offer the next most important action.

Primary content:

- Current request status, if one exists.
- Primary action: `Request care support`.
- Assigned caregiver summary only after assignment.
- Latest notification or status update.
- Support/safety link.

States:

- No active request: show request action and brief expectation setting.
- Open request: show waiting-for-review/applicants status.
- Assigned request: show assigned caregiver, time/location summary, complete/cancel options if eligible.
- Completed request: show final status and record.
- Cancelled request: show final status and reason if available.

Quality bar:

- A stressed family member should know within five seconds whether help has been requested, assigned, completed, or cancelled.

### Create Care Request

Purpose:

- Capture enough structured detail for safe dispatch without becoming a medical chart.

Fields for closed beta:

- Request title or support type.
- Short description.
- Date/time or requested window.
- Location/address.
- Patient/family contact context.
- Mobility/support notes.
- Optional hourly rate only if current beta operation uses it.

Rules:

- Do not let the client choose `patient_user_id`.
- Use clear field labels.
- Mark required fields plainly.
- Validate before submit and show field-level errors.
- On API failure, show safe message plus copied issue reference.

Quality bar:

- A patient can submit a valid request without knowing internal terms like job, application, or assignment.

### Patient Request Detail

Purpose:

- Make request state and available actions obvious.

Primary content:

- Status badge.
- Request summary.
- Timeline of status changes.
- Assigned caregiver summary when assigned.
- Eligible actions: cancel or complete.
- Notifications related to the request.

Action rules:

- `Cancel request` appears only when cancellation is allowed.
- `Mark complete` appears only when completion is allowed.
- Terminal statuses should not show active action buttons.

Quality bar:

- The patient should never wonder whether the request is still active.

## Nurse Mobile

### Nurse Home

Purpose:

- Show whether the nurse/caregiver can work and what needs attention.

Primary content:

- Verification status.
- Assigned work summary.
- Pending applications.
- Primary action based on state:
  - `Continue verification`
  - `Review open requests`
  - `View assigned request`

Quality bar:

- An unverified nurse understands why they cannot apply yet and what to do next.

### Verification

Purpose:

- Let nurses upload required documents and understand review status.

Primary content:

- Verification status: not started, pending, approved, rejected.
- Required document list.
- Upload action.
- Review notes or rejection reason if available.
- Consent language before upload.

Rules:

- Do not expose private storage paths.
- Do not promise license validation or background checks unless that operation exists.
- Document upload errors should preserve request references.

Quality bar:

- A nurse can complete the beta document upload flow from a real device.

### Open Requests

Purpose:

- Let approved nurses evaluate eligible requests.

Primary content:

- Request cards/list rows with support type, general location, date/time, status, and key notes.
- Filter/sort only if needed for closed beta.
- Empty state explaining no available requests.

Rules:

- Only show apply action for `open` requests.
- Do not show sensitive patient details beyond what is needed before assignment.

Quality bar:

- A nurse can decide whether to apply without guessing what the request is.

### Nurse Request Detail

Purpose:

- Explain the request and available nurse action.

Primary content:

- Request summary.
- Timing/location.
- Patient support notes appropriate for pre-assignment.
- Application status.
- Assigned state if selected.
- Complete action when assigned and eligible.

Quality bar:

- The nurse understands whether they have applied, are assigned, or can complete the work.

## Admin Web Console

Admin is an operations surface, not a marketing dashboard.

### Global Layout

Primary navigation:

```text
Requests
Verification
Users
Notifications/Audit
Settings or Ops
```

Layout rules:

- Dense but readable.
- Tables and split-pane detail views are preferred for queues.
- Filters should be practical: status, date/time, applicant count, verification status.
- Avoid large decorative cards and hero sections.

### Request Queue

Purpose:

- Help dispatcher decide what needs action now.

Columns:

- Status.
- Requested time/window.
- Patient/family.
- Support type/title.
- General location.
- Applicant count.
- Assigned nurse/caregiver.
- Last update.

Actions:

- Open detail.
- Filter by `open`, `assigned`, `completed`, `cancelled`.
- Highlight requests needing assignment.

Quality bar:

- Dispatcher can identify unassigned requests with applicants in one glance.

### Request Detail

Purpose:

- Assign or resolve a request with enough context and audit visibility.

Sections:

- Request summary.
- Patient/family context.
- Applicant list.
- Assignment state.
- Status controls.
- Notification/audit history.

Actions:

- Assign selected approved applicant.
- Cancel eligible request.
- Complete eligible request.
- View related notifications/audit.

Rules:

- Assignment should clearly show why an applicant is or is not eligible.
- Terminal actions require confirmation.
- Every action should write audit evidence.

Quality bar:

- Dispatcher can explain why a request ended in its current state.

### Verification Queue

Purpose:

- Review nurse/caregiver verification submissions.

Columns:

- Nurse/caregiver.
- Verification status.
- Submitted documents count/type.
- Last update.
- Review action.

Detail sections:

- Profile summary.
- Document metadata.
- Signed document access if supported.
- Approve/reject controls.
- Review notes.

Rules:

- Do not expose permanent private storage paths.
- Rejection should notify the nurse with an understandable reason.
- Approval/rejection must be audit logged.

Quality bar:

- Admin can approve or reject with a recorded reason and no private path leakage.

## Copy And Tone

Use:

- `Request care support`
- `Open request`
- `Assigned`
- `Completed`
- `Cancelled`
- `Verification pending`
- `Approved to apply`
- `Needs review`

Avoid:

- `Book a gig`
- `Hire now`
- `Provider marketplace`
- `HIPAA-compliant`
- `Licensed verified` unless actually verified by process
- `Background checked` unless actually completed by process

Error pattern:

```text
We could not submit this request.
Please check the highlighted fields and try again.
Reference: mobile-...
```

## Accessibility And Usability

- Text must remain readable on small Android devices.
- Action buttons must not shift layout when labels change.
- Status color must not be the only status signal.
- Confirmation dialogs must explain consequences in plain language.
- Loading and empty states must preserve the user’s sense of where they are.

## Implementation Sequence

Do not start broad visual redesign before create-job is fixed. After the blocker is fixed:

1. Patient home and create-request flow.
2. Patient request detail/status actions.
3. Nurse home and verification status.
4. Nurse open requests and application flow.
5. Admin request queue/detail assignment flow.
6. Admin verification queue/detail.
7. Notifications and audit visibility.
8. Final visual polish pass.

## Acceptance Criteria

Mobile patient:

- Patient can create, view, cancel, and complete eligible requests on a real device.
- Patient can understand current status without developer explanation.
- Failed create request includes a support-ready reference.

Mobile nurse:

- Nurse can understand verification status.
- Approved nurse can view and apply to open requests.
- Assigned nurse can complete assigned work.
- Unverified nurse understands why applying is blocked.

Admin:

- Dispatcher can see open requests needing assignment.
- Dispatcher can inspect applicants and assign an approved applicant.
- Admin can cancel/complete eligible requests with audit trail.
- Admin can approve/reject verification submissions with audit trail.

Evidence:

- Each accepted workflow has a matching entry in `docs/release/beta-evidence-log.md`.
