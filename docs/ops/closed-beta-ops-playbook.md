# Closed Beta Operations Playbook

This playbook defines how NurseBridge should be operated during the controlled closed beta. It is not a public-launch support plan and not a compliance certification.

## Operating Principle

During closed beta, every care request is manually supervised. The product is not ready to behave like an unsupervised marketplace.

Operational priorities:

1. Protect users.
2. Preserve accurate request state.
3. Avoid unsupported claims.
4. Capture evidence.
5. Fix root causes, not symptoms.

## Required Roles

Before inviting outside testers, assign named people for these roles:

| Role | Responsibility |
| --- | --- |
| Beta owner | Final go/no-go for tester activity. |
| Admin/operator | Watches requests, verifies nurses, assigns, cancels/completes when needed. |
| Engineering responder | Investigates API/mobile/admin failures using request IDs and safe logs. |
| Support contact | Receives tester reports and communicates next steps. |
| Legal/privacy owner | Owns privacy, terms, consent, and data request language. |

One person may hold more than one role during closed beta, but each role must have a named owner.

## Monitoring Window

Closed beta should only run during an agreed monitoring window.

Required before a monitored test:

- Admin/operator is available.
- Engineering responder is available.
- Support contact is available.
- Tester identities and roles are known.
- Test scope is known.
- Rollback/stop condition is clear.
- Legal/consent expectations are ready for the tester group.

Do not run live care request tests when nobody is watching.

## Severity Levels

### SEV-1: Safety, Privacy, Or Access Risk

Examples:

- User sees another user's private request or verification information.
- Service role key, token, private document path, or secret is exposed.
- Wrong patient/nurse/admin authorization succeeds.
- Care request state becomes dangerously misleading.
- User reports urgent care/safety concern through the app.

Expected response:

- Stop active beta testing.
- Preserve evidence without collecting secrets.
- Notify beta owner immediately.
- Engineering responder investigates.
- Do not resume until cause and mitigation are documented.

### SEV-2: Core Workflow Blocked

Examples:

- Patient cannot create request.
- Nurse cannot apply when eligible.
- Admin cannot assign.
- Completion/cancellation fails.
- Notifications or audit records are missing for a tested workflow.

Expected response:

- Pause the affected workflow.
- Capture request ID, role, timestamp, endpoint/screen, and status.
- Use safe logs and tests to identify root cause.
- Patch and verify before retrying the workflow.

### SEV-3: Degraded Experience

Examples:

- Confusing status text.
- Non-critical UI issue.
- Delayed notification while status remains visible.
- Recoverable upload or display issue.

Expected response:

- Record issue.
- Continue only if user trust and workflow state are not compromised.
- Prioritize before expanding beta.

### SEV-4: Product Feedback

Examples:

- Copy improvement.
- Layout preference.
- Missing convenience feature.
- Future feature request.

Expected response:

- Record feedback.
- Do not interrupt active workflow proof.
- Prioritize after closed-beta evidence is collected.

## Incident Intake

For any issue, collect:

- Date/time and timezone.
- Reporter/tester.
- Role: patient, nurse, admin, support.
- Device/browser.
- App/build if mobile.
- Environment.
- Screen or endpoint.
- Request ID/reference if available.
- Job/application/notification ID if safe and relevant.
- Expected result.
- Actual result.
- Severity.
- Immediate action taken.
- Follow-up owner.

Do not collect:

- Passwords.
- Bearer tokens.
- Refresh tokens.
- Cookies.
- Service role keys.
- Raw medical detail.
- Private document paths unless absolutely required and access-restricted.

## Support Response Pattern

Use plain, calm language:

```text
Thanks. We received the issue.
Please do not retry more than once unless we ask.
We are checking the request reference now.
We will update you when the status is confirmed.
```

If the issue involves care urgency:

```text
NurseBridge beta is not an emergency service.
If this is urgent or life-threatening, call local emergency services now.
```

Do not promise:

- Clinical advice.
- Guaranteed caregiver availability.
- Insurance coverage.
- HIPAA readiness.
- Background-check or license-verification completion unless formally reviewed and real.

## Engineering Triage Flow

For API/mobile/admin failures:

1. Capture safe issue details.
2. Find request ID/reference.
3. Check API/admin logs using `docs/ops/observability.md`.
4. Identify whether issue is:
   - validation
   - auth/role
   - RLS
   - schema/constraint
   - lifecycle rule
   - notification/audit
   - UI state
5. Patch exact root cause.
6. Add/update regression test.
7. Run focused checks.
8. Run `pnpm verify`.
9. Record evidence.

For Android create-job specifically, use `docs/release/closed-beta-operator-runbook.md`.
For VM deploys, restarts, health checks, and rollback discipline, use `docs/ops/deployment-runbook.md`.

## Stop Conditions

Pause beta activity if:

- Any SEV-1 occurs.
- Create-job or assignment fails after a patch.
- Wrong-role access succeeds.
- Private document metadata or path leaks to an unauthorized user.
- Logs expose secrets or private care details.
- Admin cannot accurately determine request state.
- Tester support cannot be monitored.

Resume only after:

- Cause is documented.
- Fix or mitigation is applied.
- Verification evidence exists.
- Beta owner approves continuation.

## Evidence Requirements

Record operational evidence in `docs/release/beta-evidence-log.md`.

Required entries before outside testers:

- Beta access rules.
- Monitoring owner and window.
- Support contact and escalation path.
- Restore drill.
- Legal/consent readiness.

Use `docs/legal/beta-legal-consent-checklist.md` to confirm the required privacy, terms, verification consent, retention, support, and copy-review items.

Required entries during workflow proof:

- Create-job debug evidence.
- Workflow smoke evidence.
- Patient real-device evidence.
- Nurse real-device evidence.
- Admin web evidence.
- Notification evidence.
- Verification upload evidence.

## Beta Go/No-Go Questions

Before each controlled beta session:

1. Is create-job currently verified?
2. Is the admin/operator available?
3. Is an engineering responder available?
4. Is support contact available?
5. Are tester roles/accounts known?
6. Is the test scope narrow and approved?
7. Are privacy/terms/verification consent expectations ready for these testers?
8. Is there a stop condition?
9. Is evidence logging ready?

If any answer is no, do not run the session.

## Current Status

As of this local-only staged pass:

- Closed beta is not ready.
- Installed-device create-request proof remains the active blocker after the deployed backend fix.
- Monitoring owner and response expectations are not yet assigned.
- Restore drill evidence is missing.
- Legal/privacy/terms/verification consent are not finalized.
- Real-device patient/nurse/admin workflow evidence is missing.
