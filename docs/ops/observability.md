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

## Debug Create-Job Failures

The active closed-beta blocker is fresh installed-device create-request proof after the deployed backend fix. Use the safe log watcher after reproducing a create-request attempt from an approved iOS internal/TestFlight build or recovered Android install:

```sh
scripts/ops/watch-create-job-logs.sh "15 minutes ago"
```

The watcher filters to create-job diagnostics and structured `POST /jobs` request events, so unrelated health checks should not appear.

If the mobile app shows a `Reference: mobile-...` value, filter directly to that request:

```sh
scripts/ops/watch-create-job-logs.sh "30 minutes ago" "mobile-example-request-id"
```

Relevant events:

- `request_validation_failed`: request payload failed API validation before database insert.
- `create_job_failed`: request passed validation but Supabase/database insert failed.
- `request_completed`: confirms method, path, status code, and request ID.

Expected workflow:

1. Trigger one create-request attempt from the installed mobile app.
2. Copy the `Reference: mobile-...` value from the app error if it appears.
3. Run the watcher immediately, passing that reference as the second argument when available.
4. Capture the `requestId`, event name, issue path/message, or Supabase error code/message.
5. Fix the exact validation, RLS, constraint, or schema issue shown in the log.

Do not capture Authorization headers, bearer tokens, refresh tokens, Supabase keys, or raw request bodies.

Before inviting outside testers, reverify the live VM Fastify logger configuration redacts authorization, cookie, token-like, password-like, and private document path fields. The local staged API snapshot does not include every VM bootstrap file, so VM logger redaction must be checked on `/home/nurseapp/nursebridge` during the pending root verification.

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
