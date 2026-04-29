# Production Observability

This baseline uses structured application logs, request IDs, service status checks, and simple health probes. Do not capture secrets, bearer tokens, passwords, service keys, cookies, or private document paths when debugging.

## Check Services

```sh
systemctl status nursebridge-api.service
systemctl status nursebridge-admin.service
systemctl status cloudflared
```

## View Logs

```sh
journalctl -u nursebridge-api.service -f
journalctl -u nursebridge-admin.service -f
journalctl -u cloudflared -f
```

API request logs include:

- `requestId`
- `method`
- `path`
- `statusCode`
- `durationMs`

Use `requestId` to correlate client failures with server logs.

## Test Health

```sh
curl https://api.nursebridges.com/health
curl https://admin.nursebridges.com
```

`/health` is intentionally fast and does not query the database. It returns service name, `ok`, and timestamp.

## Debugging Capture Checklist

When reporting or investigating an issue, capture:

- Timestamp with timezone
- `requestId` from the `x-request-id` response header or error body
- Endpoint path and HTTP method
- Status code
- User role involved, such as patient, nurse, or admin
- Short symptom description

Do not capture:

- Authorization headers or cookies
- Access, refresh, push, or signed upload tokens
- Passwords
- Supabase service keys or anon keys
- Private document storage paths unless the exact path is required and access is restricted
