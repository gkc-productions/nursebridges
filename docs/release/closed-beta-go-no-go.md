# Closed Beta Go/No-Go Packet

This packet is the owner/operator decision page for moving NurseBridges from engineering build to tiny controlled closed beta.

It does not certify HIPAA, insurance, clinical, licensing, background-check, SOC 2, or public marketplace readiness. It only decides whether a small supervised beta can run with known limitations.

## Current Decision

Status: No-go for outside testers.

Reason:

- Real-device create, apply, assign, complete, and in-app notification proof exists for the original combined engineering build, but not yet for the redesigned separate Patient and Care releases.
- The cancellation path is still missing.
- Legal/privacy/terms/verification consent are not finalized.
- Real-device verification-document upload proof is still missing.
- Backup/restore evidence is missing.
- Beta access, revocation, and secret-owner evidence are not finalized.
- The patient early-access migration/API route is deployed and publicly verified. The redesigned Patient build `0.1.0 (3)` is uploaded and processing, but its TestFlight install and device verification are not complete.

The historical 131-file VM verification package remains documented in `docs/release/pending-vm-verification.md`; it is not evidence for the newer Patient redesign by itself.

## Who Can Approve

The owner has final say.

Engineering can recommend go/no-go only after evidence exists in `docs/release/beta-evidence-log.md`.

Exceptions must be explicit and written down. An exception must include:

- what is being accepted;
- why it is acceptable for closed beta;
- who approved it;
- what follow-up closes the gap;
- when the exception expires.

## Non-Negotiable Go Gates

These must pass before inviting outside testers:

1. Installed-device patient create-request succeeds against `https://api.nursebridges.com`.
2. Created request appears in patient request list as `open`.
3. Approved nurse sees the open request and can apply.
4. Admin sees the applicant and assigns safely.
5. Assigned nurse or patient completes the request.
6. Cancellation path is proven and rejects pending applications.
7. Wrong-role and invalid terminal transitions return clean errors.
8. Admin can review assignment/terminal audit evidence.
9. In-app notification evidence exists for the workflow.
10. Beta access rules and support/monitoring ownership are named.
11. Restore drill evidence is recorded for a non-production Supabase restore.
12. Privacy, terms, and verification-document consent are owner-approved for beta.

## Conditional Gates

These can be accepted as written limitations only if the owner explicitly approves:

- iPhone-first beta before Android recheck.
- In-app notifications before Expo push delivery is proven.
- Manual verification review before any formal license/background-check process exists.

Guarded multi-write assignment/cancel/complete is an internal engineering-proof posture, not the preferred outside-tester beta posture. Outside beta should use approved RPC-backed assignment and terminal finalization. If the owner accepts guarded multi-write for any outside tester, the exception must be written, tester count must stay tiny, operator monitoring must be active, and rollback/incident stop conditions must be acknowledged.

## Automatic No-Go Conditions

Do not invite outside testers if any of these are true:

- Real-device create-request fails or is unproven.
- Admin assignment cannot be performed by a controlled admin account.
- Users can see or mutate another user's protected records.
- Mobile app requires service-role keys, database passwords, or server-only secrets.
- Verification documents are publicly readable.
- API logs expose bearer tokens, cookies, passwords, service keys, raw private medical details, or uploaded document contents.
- The app copy claims HIPAA, insurance, clinical care, license verification, background checks, emergency support, or guaranteed caregiver availability without approved process and legal review.
- There is no named person watching logs/support during the beta window.

## Stop Conditions During Beta

Pause the beta immediately if:

- a privacy or access-control issue is suspected;
- a patient request is lost, duplicated, or assigned incorrectly;
- cancellation/completion status becomes inconsistent across patient, nurse, admin, applications, notifications, or audit;
- verification files are exposed outside expected private storage paths;
- testers report emergency or urgent-care use expectations;
- Cloudflare, VM, Supabase, or app auth becomes unstable during active care coordination.

Record the incident in `docs/release/beta-evidence-log.md` or the owner-designated incident log before resuming.

## Evidence Required For Go

Use `docs/release/beta-verification-matrix.md` for evidence format. At minimum, the evidence log must include:
Use `docs/release/beta-evidence-templates.md` for copy-ready evidence blocks.

- create-job debug evidence;
- workflow smoke evidence;
- patient real-device evidence;
- nurse real-device evidence;
- admin web evidence;
- notification evidence;
- nurse verification upload evidence;
- beta access rules evidence;
- monitoring owner evidence;
- restore drill evidence;
- legal/consent evidence.

## Next Best Action

Install and verify NurseBridges `0.1.0 (3)` from TestFlight after processing completes. After Patient validation, build the separate NurseBridges Care release and prove cancellation, verification upload, and remaining operational gates.

## Decision Template

```text
Date/time:
Timezone:
Decision owner:
Decision: Go / No-go / Go with exceptions
Beta scope:
Tester count:
Platforms:
Evidence reviewed:
Accepted exceptions:
Named monitoring owner:
Support window:
Stop conditions acknowledged: yes/no
Follow-up date:
```
