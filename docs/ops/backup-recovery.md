# Backup and Recovery

This baseline covers practical recovery steps for Supabase database schema, application data, and private storage. Keep backup files and credentials out of git.

## Supabase Automatic Backups

Supabase projects include managed database backup features based on the project plan. Treat automatic backups as the first recovery option for production incidents.

Use the Supabase dashboard to confirm:

- Backup availability for the production project
- Retention window
- Point-in-time recovery availability
- Restore target and expected downtime

Before requesting or running a production restore, capture the incident timestamp, expected recovery point, affected tables, and business impact.

## Manual Schema Dump

Use the repo script to create a schema-only dump. It does not include table data, auth users, storage objects, service keys, or application secrets.

Required local dependency:

```sh
pg_dump --version
```

Required environment variable:

```sh
export SUPABASE_DB_URL='postgresql://...'
```

Run:

```sh
scripts/ops/backup-supabase-schema.sh
```

Optional output directory:

```sh
BACKUP_DIR=/secure/local/path scripts/ops/backup-supabase-schema.sh
```

The script writes files like:

```text
backups/supabase/schema-YYYYMMDDTHHMMSSZ.sql
```

The default backup directory is local-only operational output. Do not commit it.

## Storage Bucket Backup Considerations

The private `nurse-verification` bucket contains sensitive verification documents. Storage backup handling must preserve privacy.

For storage backups:

- Prefer Supabase-managed restore options when available.
- If exporting objects manually, write only to encrypted storage.
- Preserve bucket names and object paths for metadata consistency.
- Restrict access to operators who are allowed to handle verification documents.
- Track object counts and timestamps rather than listing sensitive paths in broad incident notes.

Never paste signed URLs, private object paths, access tokens, or document contents into tickets, chat, logs, or commits.

## Restore in a Test Project

Use a test Supabase project first. Do not test recovery directly against production.

1. Create or select a non-production Supabase project.
2. Configure local access to the test project database.
3. Restore schema:

```sh
psql "$TEST_SUPABASE_DB_URL" < backups/supabase/schema-YYYYMMDDTHHMMSSZ.sql
```

4. Apply migrations from the repo if the schema dump is older than current code.
5. Seed only non-sensitive test data.
6. Verify critical flows:

- Auth/profile lookup
- Patient job creation
- Nurse application
- Admin assignment
- Job cancel/complete
- Notifications
- Nurse verification document metadata

7. For storage recovery testing, use dummy documents only. Confirm bucket privacy and path compatibility before using any production data.

## What Must Never Be Committed

Never commit:

- `.env` files or copied environment values
- Supabase service role keys, anon keys, JWT secrets, database passwords, or pooler URLs
- Database dumps containing production data
- Auth user exports
- Storage object exports
- Private verification documents
- Signed URLs or bearer tokens
- Incident notes containing secrets or private document paths

Safe to commit:

- Schema-only scripts
- Recovery documentation
- Sanitized examples with placeholder credentials
- Migrations intended for source control
