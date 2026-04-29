# Systemd Environment Files

Production service environment variables should be explicit in systemd and stored outside the repo.

## Runtime Files

Use these host-local files:

- `/etc/nursebridge/api.env`
- `/etc/nursebridge/admin.env`

Do not commit real runtime env files.

## Repo Examples

Templates are provided in:

- `ops/systemd/api.env.example`
- `ops/systemd/admin.env.example`

Copy them on the production host and fill in real values without printing secrets in shell history, logs, tickets, or chat.

## Permissions

Runtime env files should be owned by root and readable only by root:

```sh
sudo install -d -o root -g root -m 700 /etc/nursebridge
sudo chown root:root /etc/nursebridge/api.env /etc/nursebridge/admin.env
sudo chmod 600 /etc/nursebridge/api.env /etc/nursebridge/admin.env
```

## Systemd Units

The services should include:

```ini
EnvironmentFile=/etc/nursebridge/api.env
```

for `nursebridge-api.service`, and:

```ini
EnvironmentFile=/etc/nursebridge/admin.env
```

for `nursebridge-admin.service`.

Keep non-secret defaults such as `PATH` in the unit. Put app runtime values such as `PORT`, Supabase URL/key values, and server-only keys in the env files.

## API Variables

`/etc/nursebridge/api.env`:

- `NODE_ENV=production`
- `PORT=3000`
- `CORS_ORIGIN=https://admin.nursebridges.com`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET` optional; leave unset to use JWKS

## Admin Variables

`/etc/nursebridge/admin.env`:

- `NODE_ENV=production`
- `PORT=3001`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Apply Changes

After editing unit files:

```sh
sudo systemctl daemon-reload
sudo systemctl restart nursebridge-api.service
sudo systemctl restart nursebridge-admin.service
```

Verify:

```sh
systemctl status nursebridge-api.service
systemctl status nursebridge-admin.service
curl -i http://127.0.0.1:3000/health
curl -i https://api.nursebridges.com/health
curl -i https://admin.nursebridges.com
```

## Secret Handling

Never print or commit:

- Supabase service role key
- Database URL or database password
- JWT secret
- Cloudflare tunnel token
- Bearer tokens, refresh tokens, signed upload URLs

When debugging, capture only variable names, service names, timestamps, status codes, and request IDs.
