# iOS Internal Build Readiness Review

Date: 2026-07-17

This began as a configuration review. Later on 2026-07-17, Codex generated the local native iOS project and ran local Xcode builds. No EAS build, TestFlight submission, App Store upload, or Cloudflare/Supabase change was run.

## Decision

Do not continue the Expo Go/LAN proof path.

The next serious iPhone proof path is an installed build:

```text
review config
        -> get owner approval
        -> create internal iOS/TestFlight build
        -> install on owner iPhone
        -> prove patient create-request
        -> record API/log evidence
```

## Current Mobile App Identity

From `apps/mobile/app.config.ts`:

- App name: `NurseBridge`
- Slug: `nursebridges`
- Scheme: `nursebridges`
- Version: `0.1.0`
- iOS bundle identifier: `com.nursebridges.mobile`
- Android package: `com.nursebridges.mobile`
- EAS project id fallback: `76f2fa6d-f34e-43b3-b9f0-67b7d2c5a8b1`

## Current Runtime Environment

The app config uses Expo public variables:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_ENV_LOCAL_BASE`
- `EXPO_PUBLIC_ENV_TUNNEL_BASE`
- `EXPO_PUBLIC_EAS_PROJECT_ID`

Current intended API base for real-device proof:

```text
https://api.nursebridges.com
```

The mobile app now falls back away from stored `localhost` API URLs on physical iPhone and Android devices.

## Current EAS Profiles

From `apps/mobile/eas.json`:

```text
development:
  developmentClient: true
  distribution: internal

ios-internal:
  distribution: internal
  ios simulator: false

ios-testflight:
  distribution: store
  ios simulator: false

android-preview:
  distribution: internal
  android buildType: apk

preview:
  distribution: internal
  android buildType: apk

production:
  ios simulator: false
  android buildType: app-bundle
```

## Readiness Findings

- The `development` profile is internal, but creates a development-client style build. That may be useful for engineering, but it is not the same experience as a clean beta/TestFlight app.
- The `ios-internal` profile now targets physical iOS devices with internal distribution.
- The `ios-testflight` profile now targets iOS store distribution for the TestFlight lane.
- The generic `preview` profile no longer declares an iOS simulator build.
- A native iOS project now exists at `apps/mobile/ios`.
- Local Xcode compile for `NurseBridge.xcworkspace` succeeds for iPhone OS with signing disabled.
- A paired physical iPhone is visible to Xcode: `kossivi’s iPhone`, iPhone 16 Pro Max, device id `00008140-001904160C0B001C`.
- A valid local Apple Development certificate exists for `Kossivi Gbleguede`.
- Signed device builds require the active Apple Developer Program team `HKQJ75SQVF` and a matching development provisioning profile for `com.nursebridges.mobile`.
- App icon and splash assets now exist at `apps/mobile/assets/icon.png` and `apps/mobile/assets/splash.png`; the iOS asset catalog icon has been replaced from the blank generated icon.
- TestFlight access is not confirmed in this review.
- Push notification delivery is not proven and should not block in-app status proof unless push is part of the beta promise.

## Local Xcode Build Evidence

```text
Date/time: 2026-07-17
Runner: Codex
Xcode: 27.0, build 27A5218g
iOS SDK: 27.0
Workspace: apps/mobile/ios/NurseBridge.xcworkspace
Scheme: NurseBridge
Command class: xcodebuild Debug iphoneos, generic iOS destination, CODE_SIGNING_ALLOWED=NO
Result: BUILD SUCCEEDED
Artifact: /private/tmp/nursebridge-xcodebuild/Build/Products/Debug-iphoneos/NurseBridge.app
```

## Local Release Build Evidence

```text
Date/time: 2026-07-17 23:55
Runner: Codex
Xcode: 27.0, build 27A5218g
iOS SDK: 27.0
Workspace: apps/mobile/ios/NurseBridge.xcworkspace
Scheme: NurseBridge
Command class: xcodebuild Release iphoneos, generic iOS destination, CODE_SIGNING_ALLOWED=NO
Result: BUILD SUCCEEDED
Artifact: /private/tmp/nursebridge-xcodebuild-release/Build/Products/Release-iphoneos/NurseBridge.app
Notes: Release build includes production-style JS bundling and iOS app validation with signing disabled.
```

## Release Metadata Evidence

```text
Date/time: 2026-07-17
Runner: Codex
App version: 0.1.0
Build number: 1
Bundle id: com.nursebridges.mobile
Export options: ios/ExportOptions.development.plist and ios/ExportOptions.testflight.plist
Privacy copy: Face ID usage string customized for NurseBridge local app access.
Export compliance: ITSAppUsesNonExemptEncryption is false for this app config because NurseBridge is not adding custom/non-exempt encryption beyond platform/network defaults.
Verification: pnpm run ios:release-check passed; plist lint passed; mobile typecheck/tests passed.
Result: pass
```

## Native Project Fixes Applied

- Generated `apps/mobile/ios` with `expo prebuild --platform ios --no-install`.
- Installed CocoaPods dependencies.
- Forced all pod targets to iOS deployment target `15.1` for Xcode 27 compatibility.
- Quoted Expo/React Native generated script paths that failed because the local folder name contains a space: `Nurse Bridge`.
- Added `apps/mobile/scripts/repair-ios-native-project.mjs` and `pnpm run ios:repair` so these native fixes can be re-applied after prebuild or Pod regeneration.

## App Identity Asset Evidence

```text
Date/time: 2026-07-17
Runner: Codex
Icon: apps/mobile/assets/icon.png, 1024x1024
Splash: apps/mobile/assets/splash.png, 1242x2688
Native iOS icon: apps/mobile/ios/NurseBridge/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png, 1024x1024
Expo config: app.config.ts resolves icon, iOS icon, splash, and Android adaptive icon.
Result: pass
```

## Signing Blocker Evidence

```text
Date/time: 2026-07-17
Runner: Codex
Command class: xcodebuild Debug physical iPhone destination, automatic signing, allowProvisioningUpdates
Team attempted: R2N3CHKSBB
Bundle id: com.nursebridges.mobile
Result: BUILD FAILED
Blocking errors:
- No Account for Team "R2N3CHKSBB".
- No iOS App Development provisioning profile for "com.nursebridges.mobile".
```

## Owner Apple Sign-In Checklist

Codex opened:

- Xcode workspace: `apps/mobile/ios/NurseBridge.xcworkspace`
- Apple Developer identifiers: `https://developer.apple.com/account/resources/identifiers/list`
- App Store Connect apps: `https://appstoreconnect.apple.com/apps`

Owner action needed:

1. In Xcode, open `Xcode` -> `Settings...` -> `Accounts`.
2. Sign in with the Apple Developer Apple ID.
3. Confirm team `HKQJ75SQVF` appears and is valid.
4. In Apple Developer, confirm bundle id `com.nursebridges.mobile` exists or create it.
5. In App Store Connect, confirm/create the NurseBridge app record using bundle id `com.nursebridges.mobile`.
6. Tell Codex when complete so the signed local iPhone build can be retried.

## Required Owner Approval Before Any Build

Before running EAS or any app-store-connected action, capture explicit approval for:

- Platform: iOS
- Distribution target: internal install or TestFlight
- Build profile name
- API URL: `https://api.nursebridges.com`
- Supabase project
- Signing/credential behavior
- Whether remote credentials may be created or changed
- Known unresolved risks

Use `docs/ops/mobile-beta-build-readiness.md` for the approval template.

## Recommended Next Config Step

Do not add more build profiles yet. The next useful step is to resolve Apple signing/provisioning:

- Sign into the Apple Developer account in Xcode.
- Confirm team `HKQJ75SQVF` is available for NurseBridge.
- Confirm `com.nursebridges.mobile` is the final beta bundle identifier.
- Let Xcode or EAS create/download the matching development and distribution profiles only after explicit approval for that credential behavior.

## Real-Device Proof Criteria

The installed iPhone proof is complete only when:

- Patient can sign in on the installed build.
- Patient can create one non-sensitive test care request.
- Created request appears in the patient job/request list.
- Created request has `open` status.
- API logs show the matching `POST /jobs` event.
- Evidence is recorded in `docs/release/beta-evidence-log.md`.

Closed beta remains blocked until the broader patient -> nurse -> admin -> outcome workflow is proven.
