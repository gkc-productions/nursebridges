# Mobile Build and Real Device Testing

This guide prepares the Expo mobile app for real device testing and basic internal distribution. Do not put server-only secrets in Expo env files.

## Current Build Configuration

- Expo config: `apps/mobile/app.config.ts`
- EAS config: `apps/mobile/eas.json`
- iOS bundle identifier: `com.nursebridge.mobile`
- Android package: `com.nursebridge.mobile`
- Internal Android profile: `preview` builds an APK
- Production Android profile: `production` builds an AAB
- Internal iOS profile: `preview` is configured for simulator builds

## Required Mobile Env Vars

Create `apps/mobile/.env` locally from `apps/mobile/.env.example`.

Required:

```sh
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_ENV_TUNNEL_BASE=https://api.nursebridges.com
```

Required for Expo push tokens and EAS builds:

```sh
EXPO_PUBLIC_EAS_PROJECT_ID=
```

`EXPO_PUBLIC_*` values are bundled into the mobile app. Never put service role keys, database URLs, JWT secrets, passwords, or private tokens in mobile env files.

## Validate Locally

From the repo root:

```sh
pnpm --filter @nursebridge/mobile typecheck
pnpm --filter @nursebridge/mobile exec expo install --check
```

From `apps/mobile`:

```sh
npx expo-doctor@latest .
```

## Real Device Test

Start the app:

```sh
cd apps/mobile
pnpm dev
```

On a physical device:

1. Install Expo Go or a development build.
2. Sign in as a nurse.
3. Confirm the API environment points to `https://api.nursebridges.com`.
4. Open the verification documents section.
5. Choose a PDF or image through the document picker.
6. Confirm upload completes.
7. Confirm the document appears in the uploaded document list.
8. Confirm the admin portal can see the uploaded document metadata.

Expected result:

- Document picker opens.
- Upload to private `nurse-verification` bucket succeeds through a signed upload URL.
- Metadata save API succeeds.
- Admin can list metadata.

## Push Notification Test

Prerequisites:

- Physical device; push registration is skipped on simulators/emulators.
- Valid `EXPO_PUBLIC_EAS_PROJECT_ID`.
- App signed in with a real nurse/patient/admin account.

Test:

1. Launch the app on a physical device.
2. Grant notification permission.
3. Sign in.
4. Trigger a notification-producing action, such as admin assigning a nurse or approving verification.
5. Confirm the device receives the Expo push notification.
6. Confirm the in-app notifications list also shows the notification.

Expected result:

- Push token is registered by `/push/register`.
- Expo push notification arrives on device.
- In-app notification row exists.

## EAS Build Setup

Install or use EAS CLI:

```sh
npx eas-cli whoami
```

If not logged in:

```sh
npx eas-cli login
```

For CI, set `EXPO_TOKEN` instead of interactive login.

If the app is not linked to an EAS project:

```sh
cd apps/mobile
npx eas-cli init
```

Then set `EXPO_PUBLIC_EAS_PROJECT_ID` in `apps/mobile/.env` to the project ID from EAS.

## Build Commands

Android internal APK:

```sh
cd apps/mobile
npx eas-cli build --platform android --profile preview
```

Android production AAB:

```sh
cd apps/mobile
npx eas-cli build --platform android --profile production
```

iOS simulator build:

```sh
cd apps/mobile
npx eas-cli build --platform ios --profile preview
```

iOS device/TestFlight builds require Apple Developer account setup and an iOS build profile with device distribution credentials.

## Current Blockers

- EAS CLI is not logged in on this host.
- `EXPO_TOKEN` is not set.
- `EXPO_PUBLIC_EAS_PROJECT_ID` is missing from the current mobile environment.
- Android and iOS cloud builds cannot start until EAS authentication and project linking are complete.
- Real device file upload test is not runnable from this environment.
- Real Expo push delivery test is not runnable from this environment.
