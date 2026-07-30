# NurseBridge UI Implementation Brief

This brief translates the product experience spec into buildable UI work. It should guide implementation after Android create-job is fixed and the core workflow can be verified.

## Implementation Rule

Do not begin broad visual redesign before installed-device create-request proof is captured, unless a UI change directly improves workflow clarity, captures failures, or unblocks proof.

After create-request works from an installed build, continue redesign in workflow order:

```text
patient create/status
        -> nurse view/apply
        -> admin assign
        -> complete/cancel
        -> notifications/audit
        -> verification upload/review
        -> polish
```

## Product Feel In UI Terms

Use:

- White or near-white surfaces.
- Quiet neutral backgrounds.
- One restrained accent color for primary actions/status emphasis.
- Strong readable type hierarchy.
- Compact, scannable sections.
- Clear status badges.
- Plain labels.
- Direct empty states.

Avoid:

- Marketing hero layouts.
- Decorative oversized cards.
- Toy-like icons or playful language.
- Heavy beige/warm prototype palette.
- Dense gradients.
- Vague dashboard statistics.
- UI that hides request state below the fold.

## Shared Components

Build or standardize these before polishing:

- `StatusBadge`
- `RequestSummary`
- `RequestTimeline`
- `PrimaryAction`
- `SecondaryAction`
- `DangerAction`
- `ConfirmationDialog`
- `ErrorWithReference`
- `EmptyState`
- `NotificationRow`
- `VerificationStatus`
- `AuditEventRow`

State labels:

```text
Open
Assigned
Completed
Cancelled
Verification pending
Approved to apply
Needs review
```

Never rely on color alone. Pair color with label and icon/text.

## Patient Mobile Build Slice

### Patient Home

Top priority:

- Current request status.
- One primary action.
- Latest relevant update.

Layout:

```text
Header: greeting/account
Status section: current request or no active request
Primary action: Request care support
Latest update
Support/safety link
```

States:

- No active request.
- Open request.
- Assigned request.
- Completed request.
- Cancelled request.
- Loading.
- Error with reference.

Done when:

- Patient can tell current request state without opening another screen.
- Primary action is obvious.
- No terminal request shows active cancel/complete actions.

### Create Request

Top priority:

- Submit a valid care support request without internal jargon.

Fields:

- Support type/title.
- Short description.
- Requested date/time or window.
- Address/location.
- Contact context.
- Mobility/support notes.

Validation:

- Required fields marked.
- Field-level validation before submit.
- API failure shows `ErrorWithReference`.
- Request body does not include patient ownership.

Done when:

- Patient can submit a request on Android.
- Failure can be copied with request reference.
- Newly created request appears as `Open`.

### Patient Request Detail

Top priority:

- Explain what happened and what can happen next.

Sections:

- Status.
- Request details.
- Assigned caregiver if assigned.
- Timeline.
- Eligible actions.
- Notifications.

Done when:

- Cancel/complete actions only appear when allowed by lifecycle.
- Confirmation dialog explains consequences.
- Final states are clearly final.

## Nurse Mobile Build Slice

### Nurse Home

Top priority:

- Tell the nurse/caregiver whether they can work and what to do next.

Layout:

```text
Verification status
Assigned work summary
Pending applications
Primary next action
```

Done when:

- Unverified nurse sees why applying is blocked.
- Approved nurse has a clear path to open requests.
- Assigned nurse has a clear path to current work.

### Verification

Top priority:

- Upload documents and understand review status without unsupported claims.

Required UI:

- Status.
- Required/accepted document types.
- Consent language.
- Upload action.
- Review result or reason.

Done when:

- Real-device upload works.
- Private storage paths are not shown.
- Copy does not claim background check or license validation.

### Open Requests

Top priority:

- Let approved nurses evaluate and apply.

List row content:

- Support type/title.
- Requested time/window.
- General location.
- Short note.
- Status.
- Application state if already applied.

Done when:

- Apply action appears only for eligible open requests.
- Empty state is clear.
- Sensitive patient details are not overexposed pre-assignment.

### Nurse Request Detail

Top priority:

- Make application/assignment/completion state obvious.

Sections:

- Request summary.
- Timing/location.
- Support notes.
- Application state.
- Assigned state.
- Eligible action.

Done when:

- Nurse can distinguish not applied, applied, assigned, completed, and cancelled.
- Complete action appears only when assigned and eligible.

## Admin Web Build Slice

### Admin Shell

Top priority:

- Make operations fast and boring in the best way.

Navigation:

```text
Requests
Verification
Users
Audit
Ops
```

Layout:

- Left nav or top nav.
- Main queue area.
- Detail pane or detail page.
- Compact filters.

Done when:

- Admin can reach request queue and verification queue in one click.
- Admin is never shown marketing-style hero content.

### Request Queue

Top priority:

- Show what needs assignment now.

Columns:

- Status.
- Requested window.
- Patient/family.
- Support type/title.
- Location.
- Applicant count.
- Assigned caregiver.
- Last update.

Filters:

- Status.
- Needs assignment.
- Has applicants.
- Date/window.

Done when:

- Open requests with applicants are obvious.
- Assigned/completed/cancelled requests are still traceable.

### Request Detail

Top priority:

- Assign or resolve a request with confidence.

Sections:

- Request summary.
- Patient/family context.
- Applicant list.
- Assignment state.
- Status controls.
- Timeline/audit.
- Related notifications.

Actions:

- Assign approved applicant.
- Cancel eligible request.
- Complete eligible request.

Done when:

- Admin sees why an applicant can or cannot be assigned.
- Terminal actions require confirmation.
- Audit/notification evidence is visible or linked.

### Verification Queue And Detail

Top priority:

- Review caregiver verification without leaking private paths.

Queue columns:

- Caregiver.
- Status.
- Document count/type.
- Last update.
- Review action.

Detail sections:

- Profile summary.
- Document metadata.
- Review notes.
- Approve/reject controls.
- Audit outcome.

Done when:

- Admin can approve/reject with reason.
- Nurse receives understandable result.
- UI does not expose permanent private storage paths.

## Error And Empty States

Error pattern:

```text
We could not complete this action.
Please try again or share this reference with support.
Reference: mobile-...
```

Empty states:

- No active request: invite patient to request care support.
- No open requests: tell nurse there are no eligible requests right now.
- No applicants: tell admin assignment cannot happen until an approved nurse applies.
- No verification documents: tell admin no document has been submitted.

Do not use jokes, cute copy, or blame language.

## QA Checklist

For every changed UI surface:

- Text fits on small Android screens.
- Primary action is visible without guessing.
- Status is visible near top.
- Terminal states do not show invalid actions.
- Error state includes support-ready reference when available.
- Loading state does not look broken.
- Empty state tells user what is true.
- No unsupported legal/compliance claim appears.
- No private storage path appears.
- Real-device evidence is recorded where required.

## First UI Work After Create-Job Fix

1. Patient create request and request status.
2. Patient request detail with cancel/complete eligibility.
3. Nurse home and open request list.
4. Nurse apply and assigned work detail.
5. Admin request queue and request detail.
6. Admin assignment and terminal action confirmations.
7. Verification upload/review.
8. Notifications/audit visibility.
9. Visual polish pass.
