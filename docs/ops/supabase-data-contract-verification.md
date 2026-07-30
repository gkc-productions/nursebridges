# Supabase Data Contract Verification

This runbook verifies `docs/architecture/data-contract.md` against the live Supabase project. It is inspection-only unless a separate task explicitly approves schema, RLS, storage, or secret changes.

## Scope

Verify:

- Core table existence.
- Column names and nullability.
- Job ownership field.
- Create-job insert expectations.
- Application and job status values.
- Assignment representation.
- RLS enablement and policy shape.
- Private verification storage expectations.

Do not change:

- Supabase schema.
- RLS policies.
- Storage bucket settings.
- Runtime env files.
- Secrets.
- Cloudflare settings.

## Safety Rules

- Do not paste service role keys or database passwords into docs.
- Do not export private user data.
- Do not inspect raw medical details unless absolutely required and access-restricted.
- Use non-sensitive counts and metadata.
- Verify against production only during an approved monitoring window.
- If a query reveals private data, stop and adjust the query to return metadata only.

## Backup And Restore Drill

Closed beta is not recovery-ready until a restore drill has been completed and recorded.

Restore drill rules:

- Use a non-production Supabase project as the restore target.
- Use non-sensitive seed data only.
- Do not restore production private user data into an unmanaged project.
- Verify schema restore, expected beta tables, and at least one safe count/query result.
- Clean up or roll back the target project after the drill if it is not retained.
- Record the result with `## Restore Drill Evidence` in `docs/release/beta-evidence-log.md`.
- If `pg_dump` is unavailable, keep the restore drill blocked instead of claiming recovery readiness.

## Preferred Access

Use whichever approved access method is available on the VM:

- Supabase MCP `execute_sql`.
- Supabase CLI discovered with `supabase --help`.
- `psql` using approved server-side credentials.
- Existing project scripts if present.

Do not guess Supabase CLI commands. Check:

```sh
supabase --help
supabase db --help
```

## Core Table Inventory

Expected beta tables:

```text
profiles
nurse_profiles
jobs
applications
notifications
push_tokens
nurse_verification_documents
admin_audit_logs
```

Inspection SQL:

```sql
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles',
    'nurse_profiles',
    'jobs',
    'applications',
    'notifications',
    'push_tokens',
    'nurse_verification_documents',
    'admin_audit_logs'
  )
order by table_name;
```

Expected:

- All expected tables exist, or missing tables are documented as out-of-scope with current code paths adjusted accordingly.

## Column Contract Inspection

Inspection SQL:

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'profiles',
    'nurse_profiles',
    'jobs',
    'applications',
    'notifications',
    'push_tokens',
    'nurse_verification_documents',
    'admin_audit_logs'
  )
order by table_name, ordinal_position;
```

Confirm:

- `jobs.patient_user_id` exists or current API insert target is updated in the contract.
- `jobs.status` exists.
- `applications.job_id` exists.
- `applications.status` exists.
- nurse/caregiver ownership field exists on `applications`.
- verification document ownership field exists.
- notification recipient field exists.

## Create-Job Insert Contract

Confirm live non-null constraints for `jobs`:

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'jobs'
order by ordinal_position;
```

Compare against API behavior:

- API sets `patient_user_id` from authenticated patient.
- API sets `status` to `open`.
- Optional blank `description`, `address`, `start_time`, and `hourly_rate` normalize to `null`.
- Mobile does not choose patient ownership.

If Android create-job logs show `create_job_failed`, use the Supabase error code/message to identify the exact column, constraint, or RLS issue before changing code.

## Status Value Inspection

Use metadata-safe distinct status queries:

```sql
select status, count(*)
from jobs
group by status
order by status;
```

```sql
select status, count(*)
from applications
group by status
order by status;
```

Expected beta values:

```text
jobs: open, assigned, completed, cancelled
applications: applied, accepted, rejected, withdrawn
```

If production contains extra values:

- Document them in `docs/architecture/data-contract.md`.
- Confirm code handles or migrates them before broader beta.

## Assignment Representation

Inspect assignment-related columns:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'jobs'
  and (
    column_name ilike '%assign%'
    or column_name ilike '%nurse%'
    or column_name ilike '%caregiver%'
  )
order by column_name;
```

Confirm that production assignment can be represented by:

- canonical field: `jobs.assigned_nurse_user_id`
- supporting evidence: exactly one accepted application for the assigned nurse/caregiver
- compatibility-only reads that may still derive assignment from accepted applications until RPC-backed API/admin rollout is complete

Before broader beta:

- Reverify `jobs.assigned_nurse_user_id` exists in live Supabase.
- Treat accepted application state as supporting evidence, not a second production source of truth.
- Treat any accepted-application-only read path as compatibility-only until it is reconciled.
- Update `docs/architecture/data-contract.md`.

## RLS Enablement

Inspection SQL:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles',
    'nurse_profiles',
    'jobs',
    'applications',
    'notifications',
    'push_tokens',
    'nurse_verification_documents',
    'admin_audit_logs'
  )
order by tablename;
```

Expected:

- RLS enabled on exposed tables used by clients.
- Any exception is documented and justified.

## RLS Policy Inventory

Inspection SQL:

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles',
    'nurse_profiles',
    'jobs',
    'applications',
    'notifications',
    'push_tokens',
    'nurse_verification_documents',
    'admin_audit_logs'
  )
order by tablename, policyname;
```

Review for:

- Ownership predicates, not only `TO authenticated`.
- UPDATE policies with both `USING` and `WITH CHECK` where users can update rows.
- No reliance on user-editable metadata for authorization.
- No broad policies that let patients view other patients' private jobs.
- No direct client write path that bypasses API validation.

## Storage Verification

Confirm verification bucket metadata without exposing private file paths:

```sql
select id, name, public
from storage.buckets
where name = 'nurse-verification';
```

Expected:

- Bucket exists.
- `public` is false.

Do not list object paths into shared docs unless required and access-restricted.

## Function And View Safety Check

If functions or views are involved in job assignment, verification, or RLS work, inspect them before changing behavior.

Views:

```sql
select schemaname, viewname, definition
from pg_views
where schemaname = 'public';
```

Functions:

```sql
select n.nspname as schema,
       p.proname as function_name,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private', 'auth', 'storage')
order by n.nspname, p.proname;
```

Watch for:

- Views that bypass RLS.
- `SECURITY DEFINER` functions exposed in `public`.
- Functions callable by unintended roles.

Do not add `SECURITY DEFINER` just to bypass an RLS failure.

## Evidence To Record

Record in `docs/release/beta-evidence-log.md`:

```text
Date/time:
Timezone:
Verifier:
Environment:
Access method:
Tables checked:
Jobs ownership field:
Create-job constraints checked:
Job status values:
Application status values:
Assignment representation:
RLS enabled:
Policy review result:
Storage bucket private:
Contract updates needed:
Follow-up issue:
```

## Completion Criteria

This verification is complete when:

- Live schema has been inspected.
- `docs/architecture/data-contract.md` matches production or lists the known differences.
- Android create-job root cause is not blocked by unknown schema shape.
- RLS-backed patient, nurse, and admin flows have a verification plan or evidence.
- No schema changes were made without separate approval.
