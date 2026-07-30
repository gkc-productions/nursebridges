# NurseBridge Deployment Runbook

This runbook defines the closed-beta deployment discipline for the current NurseBridge VM setup. It assumes the active deployment target is `/home/nurseapp/nursebridge` on `nursebridge-vm`.

## Scope

Current infrastructure:

```text
Ubuntu VM
systemd nursebridge-api.service
systemd nursebridge-admin.service
cloudflared
https://api.nursebridges.com
https://admin.nursebridges.com
Supabase hosted backend
```

This runbook does not cover:

- Cloudflare configuration changes.
- Supabase schema changes.
- Secrets or runtime env changes.
- EAS/app-store builds.
- Pathfinder infrastructure.

Those require separate scoped approval.

## Deployment Rules

- Do not deploy broad changes while installed-device create-request proof remains missing unless the change directly supports the create-request proof path, workflow safety, or staged docs sync.
- Run focused tests for touched packages.
- Run full `pnpm verify` before production-track deploys.
- Restart only services affected by code changes.
- Docs-only sync does not require service restart.
- Do not run production smoke tests unless explicitly approved.
- Do not modify `/etc/nursebridge/*.env` without separate approval.
- Do not touch Pathfinder paths, services, env files, or tunnels.

## Pre-Deploy Checklist

Before deploying code:

1. Confirm scope:
   - API
   - admin
   - mobile source only
   - docs only
   - scripts only
2. Confirm whether production data or live users can be affected.
3. Confirm rollback approach.
4. Run focused tests.
5. Run:

```sh
cd /home/nurseapp/nursebridge
pnpm verify
```

6. Confirm no unrelated dirty changes are being deployed.
7. Confirm no secrets are present in logs, diffs, docs, or command output.

## Docs-Only Sync

Docs-only changes can be copied without restarting services.

Follow `docs/release/vm-sync-handoff.md`.

After copying:

```sh
cd /home/nurseapp/nursebridge
rg "Production Build Plan|NurseBridge Implementation Backlog|Beta Verification Matrix|Closed Beta Operations Playbook|ADR 0001" docs
git status --short
```

Expected:

- Docs are present.
- No service restart.
- No runtime files changed.

## API Deploy

Use when `services/api` code changes.

Build:

```sh
cd /home/nurseapp/nursebridge
pnpm --filter @nursebridge/api build
```

Restart:

```sh
sudo systemctl restart nursebridge-api.service
```

Verify service:

```sh
systemctl status nursebridge-api.service
curl -fsS http://127.0.0.1:3000/health
curl -fsS https://api.nursebridges.com/health
```

Check logs:

```sh
journalctl -u nursebridge-api.service --since "10 minutes ago"
```

Expected:

- Service is active.
- Local health returns OK.
- Public health returns OK.
- No new startup errors.
- Request logs include request IDs.

## Admin Deploy

Use when `apps/admin` code changes.

Build:

```sh
cd /home/nurseapp/nursebridge
pnpm --filter @nursebridge/admin build
```

Restart:

```sh
sudo systemctl restart nursebridge-admin.service
```

Verify service:

```sh
systemctl status nursebridge-admin.service
curl -I https://admin.nursebridges.com
```

Expected:

- Service is active.
- Public admin route reaches Cloudflare Access or expected protected response.
- No new startup errors.

Check logs:

```sh
journalctl -u nursebridge-admin.service --since "10 minutes ago"
```

## Cloudflare Tunnel Check

Use for reachability verification only. Do not edit Cloudflare settings without separate approval.

```sh
systemctl status cloudflared
journalctl -u cloudflared --since "10 minutes ago"
curl -fsS https://api.nursebridges.com/health
curl -I https://admin.nursebridges.com
```

Expected:

- `cloudflared` is active.
- API public health works.
- Admin route reaches the protected app path or expected Cloudflare Access response.

## Rollback Guidance

Before any code deploy, know the previous good state.

Minimum rollback options:

- Revert the specific code change and redeploy affected service.
- Restore previous built artifact if available.
- Restart service if failure is transient and no code/data changed.

Do not use destructive commands such as `git reset --hard` unless explicitly approved and the rollback scope is clear.

Rollback verification is the same as deploy verification:

- affected service active
- health checks pass
- logs clean
- public route behavior expected

## Post-Deploy Evidence

Record deployment evidence in `docs/release/beta-evidence-log.md` or the relevant issue/handoff note:

```text
Date/time:
Timezone:
Deployer:
Scope:
Commit/change:
Tests:
Build command:
Restarted service:
Local health:
Public health:
Log check:
Rollback plan:
Result:
Follow-up:
```

## Stop Conditions

Stop deployment and investigate if:

- `pnpm verify` fails.
- A service fails to restart.
- Local or public health fails.
- Logs show missing env/secrets.
- Logs expose secrets or private details.
- Admin route no longer reaches Cloudflare Access/protected app.
- API returns non-JSON errors for known API failure paths.
- Create-job diagnostics disappear while Android create-job is still being debugged.

## Current Priority

The next deploy-relevant production unlock remains:

```text
capture Android create-job failure
        -> patch exact root cause
        -> focused tests
        -> pnpm verify
        -> API build/restart if needed
        -> local and public health checks
```
