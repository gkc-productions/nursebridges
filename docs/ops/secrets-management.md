# Secrets Management

This document describes where environment variables belong and what must not be exposed. Do not commit real secrets.

## Variable Inventory

### API: `services/api`

Required:

- `SUPABASE_URL` - public Supabase project URL, server runtime
- `SUPABASE_ANON_KEY` - public Supabase anon key, server runtime for user-scoped Supabase clients

Required for admin/server workflows:

- `SUPABASE_SERVICE_ROLE_KEY` - server-only Supabase service role key

Optional:

- `SUPABASE_JWT_SECRET` - server-only JWT verification fallback; leave unset to use Supabase JWKS
- `PORT` - API listen port
- `CORS_ORIGIN` - allowed CORS origin
- `NODE_ENV` - runtime environment label

### Admin: `apps/admin`

Public browser-safe:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Server-only:

- `SUPABASE_SERVICE_ROLE_KEY`

The service role key must only be used by Next.js route handlers and server-side helper modules. It must not be imported into client components.

### Mobile: `apps/mobile`

Public Expo variables:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_ENV_LOCAL_LABEL`
- `EXPO_PUBLIC_ENV_TUNNEL_LABEL`
- `EXPO_PUBLIC_ENV_LOCAL_BASE`
- `EXPO_PUBLIC_ENV_TUNNEL_BASE`

Expo public variables are bundled into the mobile app. Never place service role keys, database URLs, JWT secrets, passwords, signed URLs, or private tokens in mobile env files.

### Systemd Services

Checked units:

- `nursebridge-api.service`
- `nursebridge-admin.service`
- `cloudflared`

The checked unit files set `PORT` and `PATH`, but do not show an `EnvironmentFile` for Supabase variables. Since production services are active, confirm operationally where runtime secrets are injected and document that location outside the repo.

Do not store secrets directly in committed unit files.

## Public vs Server-Only

Public values may be exposed to browser/mobile clients:

- Supabase URL
- Supabase anon key
- Public API base URLs
- Display labels

Server-only values must never be exposed to browser/mobile clients:

- Supabase service role key
- Database connection strings and pooler URLs
- Database passwords
- JWT secrets
- Cloudflare tunnel tokens
- Push service credentials
- Signed upload tokens
- Bearer access tokens and refresh tokens

## Git Hygiene

`.gitignore` protects `.env` and `.env.*` files while allowing example files. Keep real values only in local or production secret storage.

Safe to commit:

- `.env.example`
- `services/api/.env.example`
- `apps/admin/.env.example`
- `apps/admin/.env.local.example`
- `apps/mobile/.env.example`

Never commit:

- `.env`
- `.env.local`
- `.env.production`
- Service role keys
- Database URLs with passwords
- Cloudflare tunnel tokens
- Supabase JWT secrets
- User access tokens
- Signed storage URLs

## Audit Result

- Mobile code references only Expo public variables.
- No service role key or database password references were found in mobile code.
- Admin service role usage is isolated to server helper/API route code.
- API service role usage is isolated to server runtime code.
- Risk: systemd units do not show an `EnvironmentFile`, so runtime secret injection is not self-documenting from unit files.

## Operational Checklist

When adding a new variable:

1. Decide whether it is public or server-only.
2. Add it to the correct `.env.example` file with a comment.
3. Document it in this file.
4. Confirm it is not referenced from mobile or browser client code if server-only.
5. Confirm real values are stored outside git.
6. Restart only the service that needs the new variable.
