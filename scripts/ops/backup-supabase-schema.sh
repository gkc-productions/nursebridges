#!/usr/bin/env bash
set -euo pipefail

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is required. Install PostgreSQL client tools first." >&2
  exit 1
fi

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"
if [[ -z "${DB_URL}" ]]; then
  echo "Set SUPABASE_DB_URL or DATABASE_URL to the Supabase Postgres connection string." >&2
  exit 1
fi

OUT_DIR="${BACKUP_DIR:-backups/supabase}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="${OUT_DIR}/schema-${STAMP}.sql"

mkdir -p "${OUT_DIR}"

pg_dump "${DB_URL}" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --quote-all-identifiers \
  --file "${OUT_FILE}"

chmod 600 "${OUT_FILE}"
echo "Schema-only backup written to ${OUT_FILE}"
