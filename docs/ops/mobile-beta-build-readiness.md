# Mobile Beta Build Readiness

This runbook defines what must be true before NurseBridge attempts an Android or iOS beta build.

It does not approve running EAS, app-store submission, TestFlight, Play Console release tracks, or public distribution. Those steps require explicit owner approval.

## Current Decision

Keep Expo/React Native for closed beta.

Do not rebuild the product in pure Xcode/SwiftUI right now. The serious path is to make the mobile app feel native, calm, and trustworthy while the care workflow is still being proven.

Revisit native iOS later only if one of these becomes a real blocker:

- App-store polish cannot meet the quality bar in Expo.
- Native OS integrations become central to the care workflow.
- Performance or reliability issues are traced to the cross-platform layer.
- The beta proves enough value to justify a platform-specific rewrite.

## Non-Negotiable Gates

Do not start a beta build until all of these are true:

- Patient create-job is proven on a real device after the deployed backend fix.
- Android create-job is rechecked before wider beta unless the owner explicitly approves an iPhone-first limitation.
- Patient can create, view, cancel, and complete eligible requests on a real device.
- Approved nurse can view, apply, and complete assigned work on a real device.
- Admin can assign, cancel, complete, and review verification state from the web console.
- In-app notifications are verified during the core workflow.
- Nurse verification document upload is tested on a real device.
- Mobile app does not contain service-role keys, database passwords, runtime server secrets, or private storage credentials.
- Privacy policy, beta terms, and verification-document consent language are ready for the intended tester group.
- Beta support path, monitoring owner, and stop conditions are documented.
- Owner explicitly approves the build attempt.

## App Identity Checklist

Confirm before building:

- App display name is final for beta.
- Android package name is final for beta: `com.nursebridges.mobile`.
- iOS bundle identifier is final for beta: `com.nursebridges.mobile`.
- Expo slug and URL scheme are final for beta: `nursebridges`.
- App icon is production-quality and not placeholder artwork.
- Splash/loading state is production-quality and calm.
- Version number and build number are set intentionally.
- Environment label is clear internally, but no developer-only debug labels are shown to testers.
- Store metadata, if needed, avoids unsupported compliance, insurance, license-verification, or background-check claims.

## Environment Checklist

Confirm before building:

- API base URL points to the approved NurseBridge API, `https://api.nursebridges.com`, not Pathfinder.
- Supabase URL and anon key point to the approved NurseBridge project.
- No local, staging, Pathfinder, or developer-machine URLs are present in the mobile release profile.
- Expo public environment variables are documented and match the selected beta channel.
- Push notification configuration is present if push will be tested.
- Missing push support does not hide in-app notifications or job status changes.
- Error reporting includes request references without exposing secrets or private care details.

## Build Profile Review

Before any EAS command is approved, inspect the build profile only.

Review:

- Target platform: iOS internal/TestFlight first is acceptable for the current owner-connected device test; Android must still be rechecked before wider beta unless explicitly deferred.
- Distribution mode: internal, not public.
- Release channel/profile name.
- Environment variables available to the build.
- Signing credentials plan.
- Version and build number behavior.
- Whether the build profile can mutate remote credentials or app-store state.

The review can happen without running a build.

Current iOS build profiles:

- `ios-internal`: physical-device internal iOS distribution.
- `ios-testflight`: iOS store distribution for TestFlight.

Do not use the generic `development` profile for a clean TestFlight-style beta proof unless a development-client build is intentionally selected.

## Real-Device Proof Path

Use an installed build for proof. The iPhone Expo Go/LAN path was attempted and abandoned because it was not reliable enough to prove the workflow.

Order:

1. Review the iOS build profile, app identity, and environment without running a build.
2. Get explicit owner approval before EAS, TestFlight, app-store-connected steps, or credential changes.
3. Create one internal iOS/TestFlight build only after approval.
4. Install the build on the owner iPhone.
5. Prove patient create-request and list/status on the installed iPhone build.
6. Record API log evidence and beta evidence entry.
7. Continue to API smoke and full workflow proof.
8. Recheck Android before wider beta unless the owner explicitly defers Android.

## Android Follow-Up Path

Android should still be rechecked because it was the platform where the original `400` was observed.

Order:

1. Prove patient and nurse workflows on the current installed Android app after the deployed backend fix.
3. Confirm app identity and environment.
4. Review the EAS Android build profile.
5. Get explicit owner approval.
6. Run one internal Android beta build.
7. Install on a clean device.
8. Repeat the core patient and nurse flows.
9. Record evidence.

## iOS Path

iOS can be the immediate engineering proof path because the owner has a connected iPhone. Use an internal build or TestFlight path, not Expo Go, and require explicit owner approval before any EAS or app-store-connected action.

Before iOS:

- Apple developer account and signing path are confirmed.
- Bundle identifier is final for beta.
- TestFlight or internal install path is selected.
- App icon and splash assets are present and accepted for internal beta quality.
- `pnpm run ios:repair` has been run after any Expo prebuild or CocoaPods regeneration.
- iOS push setup is confirmed if push delivery will be tested.
- iOS privacy strings are reviewed for document upload, notifications, and any device permissions.

## Pre-Build Verification

Run before requesting build approval:

```sh
pnpm verify
```

Also verify:

- Mobile typecheck passes.
- Mobile tests pass.
- Local Xcode compile passes for `apps/mobile/ios/NurseBridge.xcworkspace` with signing disabled.
- Local installed-build preflight has no blocking signing/device/profile failures:

```sh
cd apps/mobile
pnpm run ios:install-preflight
```

This preflight is read-only. It checks local source identity, Xcode availability, visible physical iPhone/iPad devices, valid code-signing identities, and provisioning profiles for `com.nursebridges.mobile`. It does not run EAS, build the app, upload to TestFlight, create credentials, or mutate Apple account state.

- No mobile source references service-role keys or database passwords.
- App config uses approved NurseBridge identifiers.
- Beta evidence log has entries for the core workflow.
- Known blockers are either fixed or explicitly accepted for the beta build.

## Build Approval Request Template

Use this before running EAS or any app-store-connected build step:

```text
Build requested:
Platform:
Distribution target:
Profile/channel:
API URL:
Supabase project:
Version/build:
Core workflow evidence:
Known unresolved risks:
Rollback plan:
Owner approval:
```

## Evidence Template

Record build-readiness evidence in `docs/release/beta-evidence-log.md`:

```text
### Mobile Beta Build Readiness

Date:
Reviewer:
Platform:
App version/build:
Build profile reviewed:
Core workflow evidence links:
Privacy/terms/consent status:
Environment checked:
Secrets checked:
Push status:
Signing/identifier status:
Known risks:
Approval:
Result:
```

## Stop Conditions

Do not build or distribute if any of these are true:

- Real-device patient create-job is not proven after the deployed backend fix.
- Android has not been rechecked before a wider beta, unless the owner explicitly accepts an iPhone-first limitation.
- The app points at Pathfinder or an unknown backend.
- Mobile contains server-only secrets.
- Legal/privacy/consent language is missing for outside testers.
- The beta support owner is not defined.
- The build profile could publish publicly or mutate app-store state unexpectedly.
- Owner approval is missing.

## Completion Criteria

This readiness lane is complete when:

- Intended platform beta build is approved, created, installed, and tested.
- Android is tested before wider beta unless the owner explicitly defers that platform.
- Patient and nurse real-device workflows pass on the beta build.
- Environment, version, and build identity are recorded.
- Any failed push, upload, or notification behavior has a logged follow-up.
- The beta evidence log contains the final build-readiness entry.
