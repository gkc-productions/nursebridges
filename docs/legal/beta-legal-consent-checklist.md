# Beta Legal And Consent Checklist

This checklist defines what NurseBridge needs before inviting outside closed-beta testers. It is not legal advice and is not a substitute for attorney review.

## Principle

NurseBridge must not imply more trust, compliance, verification, insurance, or clinical coverage than the operation can actually support.

Before outside testers, the product should have clear beta language for:

- What NurseBridge does.
- What NurseBridge does not do.
- What information is collected.
- Who can see that information.
- What verification documents are used for.
- How users can get support.
- What to do in urgent or emergency situations.

## Required Review Owners

Assign named owners before outside beta:

| Area | Owner Needed | Evidence |
| --- | --- | --- |
| Privacy policy | Legal/privacy owner | Reviewed beta policy path/link |
| Terms of service | Legal/privacy owner | Reviewed beta terms path/link |
| Verification document consent | Legal/privacy owner + operator | Reviewed consent path/link |
| Data retention expectations | Legal/privacy owner + operator | Retention note/path |
| Support and data request path | Support contact + legal/privacy owner | Support process path |
| Product copy claims | Product owner + legal/privacy owner | Copy review note |

## Required Beta Documents

### Privacy Policy

Must answer:

- What account information is collected?
- What care request information is collected?
- What nurse/caregiver verification information is collected?
- What device/push notification information is collected?
- What operational logs are collected?
- Who can access patient/family request information?
- Who can access nurse/caregiver verification information?
- How support/debugging data such as request IDs is used?
- How users can ask questions or request help with their data?

Must not claim:

- HIPAA compliance unless formally reviewed and true.
- Insurance handling.
- Clinical care delivery by NurseBridge.
- Background checks or license verification unless formally performed.

### Terms Of Service

Must answer:

- Closed beta status.
- User eligibility.
- No emergency use.
- No guarantee of caregiver availability.
- User responsibility for accurate information.
- Admin/operator oversight.
- Account suspension/removal expectations.
- Limitation of unsupported services such as payments, insurance claims, and emergency care.

Must not claim:

- Public marketplace availability.
- Guaranteed job fulfillment.
- Verified licensure unless the operation truly verifies it.
- Full compliance posture that has not been reviewed.

### Verification Document Consent

Must answer:

- What documents may be uploaded.
- Why documents are requested.
- Who can review document metadata and files.
- That private storage is used.
- That upload does not automatically mean approval.
- What approval/rejection means during closed beta.
- How a nurse/caregiver can ask about uploaded documents.

Must not claim:

- Background check completion unless a background-check process exists.
- License validation unless the licensure verification process exists.
- Employment relationship unless reviewed and intended.

### Data Retention Expectations

Must answer:

- How long beta care requests are expected to be retained.
- How long verification document metadata/files are expected to be retained.
- Whether deletion/removal requests are supported during beta.
- Who reviews removal requests.
- Whether logs are retained separately from user-facing records.

For beta, if retention is not finalized, say it is not finalized and do not invite outside testers until it is.

### Support And Escalation

Must answer:

- How testers contact support.
- Expected response window during monitored beta.
- What request reference or screen details users should share.
- What information users must not send, such as passwords or tokens.
- Emergency disclaimer.

Required emergency language:

```text
NurseBridge beta is not an emergency service.
If this is urgent or life-threatening, call local emergency services now.
```

## Product Copy Guardrails

Allowed beta language:

- `closed beta`
- `care support request`
- `admin reviewed`
- `verification pending`
- `approved to apply`
- `private verification upload`
- `request status`
- `support reference`

Use cautiously:

- `verified nurse`
- `qualified caregiver`
- `trusted`
- `safe`

Only use those cautiously worded claims when the actual review process is clear in nearby language.

Do not use yet:

- `HIPAA-compliant`
- `SOC 2 compliant`
- `insured`
- `background checked`
- `license verified`
- `guaranteed care`
- `emergency care`
- `hospital approved`
- `insurance accepted`
- `claims processing`

## In-App Consent Touchpoints

Before outside beta, confirm these screens have appropriate language:

- Account creation or beta onboarding.
- Patient create-request screen.
- Nurse verification upload screen.
- Admin verification review screen.
- Support/contact screen.

Patient create-request language should make clear:

- The request is reviewed/handled during beta.
- The app is not for emergencies.
- Do not enter unnecessary sensitive medical details unless requested by the beta process.

Nurse verification upload language should make clear:

- Upload is for beta review.
- Approval is not automatic.
- Unsupported verification claims are not being made.
- Do not expose private storage paths.

## Evidence Required Before Marking Complete

Record in `docs/release/beta-evidence-log.md`:

- Privacy policy review.
- Terms review.
- Verification consent review.
- Retention expectation review.
- Support/data request process review.
- Product copy review.

## Current Status

As of this staged local pass:

- Privacy policy is not finalized.
- Terms of service are not finalized.
- Verification document consent is not finalized.
- Data retention expectations are not finalized.
- Support/data request path is not finalized.
- Product copy must continue avoiding unsupported compliance, insurance, background-check, and license-verification claims.
