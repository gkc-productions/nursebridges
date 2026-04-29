# Cloudflare Access Protection for Admin

## Why protect admin.nursebridges.com

`admin.nursebridges.com` exposes the NurseBridge admin interface. Even though the app has its own login, the hostname should also be protected at the network edge so unauthenticated public traffic cannot reach the Admin app directly.

Cloudflare Access adds an identity-aware gate before the request is proxied to the VM. This reduces exposure of admin routes, login pages, framework assets, and any future admin-only endpoints.

## Cloudflare Zero Trust setup

1. Open the Cloudflare dashboard.
2. Go to **Zero Trust**.
3. Go to **Access** -> **Applications**.
4. Select **Add application**.
5. Choose **Self-hosted**.
6. Configure the application:
   - Application name: `NurseBridge Admin`
   - Domain: `admin.nursebridges.com`
7. Create an access policy:
   - Policy name: `Allow admin owner`
   - Action: `Allow`
   - Include rule: `Emails`
   - Value: your authorized admin email address
8. Save the application.

Optional but recommended: require MFA for the identity provider account used by the allowed email address. If your Cloudflare plan and identity provider support it, enforce MFA in the Access policy or at the identity provider level.

## Verification

1. Open an incognito or private browser window.
2. Visit `https://admin.nursebridges.com`.
3. Confirm Cloudflare Access shows a login or verification screen before the NurseBridge Admin app loads.
4. Sign in with the authorized email address.
5. Confirm Cloudflare Access passes through to the NurseBridge Admin app login.
6. Confirm an unauthorized email address is denied before reaching the Admin app.

## Rollback

1. Open the Cloudflare dashboard.
2. Go to **Zero Trust** -> **Access** -> **Applications**.
3. Select the `NurseBridge Admin` self-hosted application.
4. Disable or delete the application.
5. Visit `https://admin.nursebridges.com` in an incognito browser window.
6. Confirm the site no longer shows the Cloudflare Access login screen and reaches the Admin app directly.
