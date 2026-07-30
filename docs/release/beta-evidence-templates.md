# Beta Evidence Templates

Copy these templates into `docs/release/beta-evidence-log.md` when collecting closed-beta proof.

Do not paste secrets, bearer tokens, cookies, passwords, service keys, private medical details, private document paths, or raw uploaded document contents.

Use non-sensitive tester data unless the owner explicitly approves real beta data collection.

## Create-Request Debug Evidence

```text
Date/time:
Timezone:
Tester:
Role: patient
Device/platform:
App/build:
Environment:
API base:
Workflow: patient create care request
Safe test data used: yes/no
Copied issue reference:
Watcher command:
Log event:
Request ID:
HTTP status:
Created job ID:
Created status:
Visible in patient request list: yes/no
Root cause if failed:
Fix change:
Regression test:
Result: Pass/Fail
Follow-up issue:
```

## Workflow Smoke Evidence

```text
Date/time:
Timezone:
Runner:
Environment:
API base:
Approval reference for mutating smoke:
Script/command:
Patient account label:
Nurse account label:
Admin account label:
Created job ID:
Nurse application ID:
Assignment result:
Completion result:
Cancellation job ID:
Cancellation result:
Invalid transition checks:
Wrong-role checks:
Notification rows checked: yes/no
Audit rows checked: yes/no
Request IDs captured:
Result: Pass/Fail
Follow-up issue:
```

## Patient Real-Device Evidence

```text
Date/time:
Timezone:
Tester:
Role: patient
Device/platform:
App/build:
Environment:
API base:
Login works: yes/no
Create request works: yes/no
Created job ID:
Created status:
Request list visible: yes/no
Current request detail visible: yes/no
Cancel eligible request works: yes/no/not tested
Complete eligible request works: yes/no/not tested
In-app notification visible: yes/no/not tested
Copied issue reference if failed:
Result: Pass/Fail
Follow-up issue:
```

## Nurse Real-Device Evidence

```text
Date/time:
Timezone:
Tester:
Role: nurse
Device/platform:
App/build:
Environment:
API base:
Login works: yes/no
Verification status shown:
Approved open requests visible: yes/no
Apply action works: yes/no/not tested
Application state shown:
Assigned work visible: yes/no/not tested
Complete assigned work works: yes/no/not tested
In-app notification visible: yes/no/not tested
Copied issue reference if failed:
Result: Pass/Fail
Follow-up issue:
```

## Admin Web Evidence

```text
Date/time:
Timezone:
Tester:
Role: admin
Browser:
Environment:
Admin URL:
Cloudflare Access behavior:
Admin login/session works: yes/no
Queue loads: yes/no
Job detail loads: yes/no
Applicant list visible: yes/no
Assignment works: yes/no/not tested
Cancel action works: yes/no/not tested
Complete action works: yes/no/not tested
Verification document metadata visible: yes/no/not tested
Audit evidence visible: yes/no/not tested
Request IDs captured:
Result: Pass/Fail
Follow-up issue:
```

## Notification Evidence

```text
Date/time:
Timezone:
Tester/runner:
Environment:
Workflow event:
Role receiving notification:
Notification type:
Notification title/body safe summary:
In-app notification visible: yes/no
Read/unread state works: yes/no/not tested
Push delivery tested: yes/no
Push platform:
Expo push result:
Request ID/job ID:
Result: Pass/Fail
Follow-up issue:
```

## Nurse Verification Upload Evidence

```text
Date/time:
Timezone:
Tester:
Role: nurse
Device/platform:
App/build:
Environment:
Document type:
Non-sensitive test file used: yes/no
Signed upload URL received: yes/no
Upload completed: yes/no
Metadata save completed: yes/no
Private bucket confirmed: yes/no/not tested
Admin can view metadata: yes/no/not tested
Admin can approve/reject: yes/no/not tested
Copied issue reference if failed:
Result: Pass/Fail
Follow-up issue:
```

## Workflow Boundary Evidence

```text
Date/time:
Timezone:
Reviewer:
Environment:
Canonical assignment field verified: yes/no
Canonical assignment field:
Accepted application treated as supporting evidence: yes/no
Assignment RPC prerequisite check:
Assignment RPC strict exposure check:
Assignment API/admin finalizer integration: pass/fail/not applied
Terminal RPC prerequisite check:
Terminal RPC strict exposure check:
Terminal API/admin finalizer integration: pass/fail/not applied
Admin/API assignment boundary converged: yes/no
Admin/API terminal boundary converged: yes/no
Guarded multi-write outside-tester exception accepted: yes/no
Exception owner:
Exception expiry/follow-up:
Verification commands:
Result: Pass/Fail
Follow-up issue:
```

## Beta Access Rules Evidence

```text
Date/time:
Timezone:
Reviewer:
Environment:
Cloudflare Access policy reviewed: yes/no
Admin tester list reviewed: yes/no
Patient tester access reviewed: yes/no
Nurse tester access reviewed: yes/no
Unauthorized admin access blocked: yes/no/not tested
Invite process:
Revocation process:
Secrets owner:
Rotation procedure reviewed: yes/no
Runtime env owner:
Emergency revocation path:
No secrets copied into evidence: yes/no
Result: Pass/Fail
Follow-up issue:
```

## Monitoring Owner Evidence

```text
Date/time:
Timezone:
Decision owner:
Monitoring owner:
Support contact:
Beta window:
Expected response time:
Log sources watched:
Incident intake path:
Stop conditions acknowledged: yes/no
Escalation path:
Result: Pass/Fail
Follow-up issue:
```

## Legal And Consent Evidence

```text
Date/time:
Timezone:
Decision owner:
Reviewer:
Legal/privacy owner:
Privacy policy reviewed: yes/no
Privacy policy path/link:
Terms reviewed: yes/no
Terms path/link:
Verification document consent reviewed: yes/no
Verification consent path/link:
Data retention expectation documented: yes/no
Data retention note/path:
Support/data request path documented: yes/no
Support/data request process path:
Emergency language present: yes/no
In-app consent touchpoints reviewed: yes/no
Product copy avoids unsupported claims: yes/no
Attorney/formal reviewer involved: yes/no/not required for closed beta
Accepted limitations:
Result: Pass/Fail
Follow-up issue:
```

## Restore Drill Evidence

```text
Date/time:
Timezone:
Runner:
Source environment:
Target non-production environment:
Backup artifact:
Restore command/process:
Schema restored: yes/no
Non-sensitive seed data restored: yes/no/not applicable
Verification query/result:
Rollback/cleanup completed: yes/no
Result: Pass/Fail
Follow-up issue:
```

## Go/No-Go Decision Evidence

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
Result:
```
