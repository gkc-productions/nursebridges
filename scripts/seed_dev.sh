#!/usr/bin/env bash
set -euo pipefail

if [[ -f /home/nurseapp/nursebridge/services/api/.env ]]; then
  set -a
  source /home/nurseapp/nursebridge/services/api/.env
  set +a
fi

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_ANON_KEY:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

SUPABASE_REST="$SUPABASE_URL/rest/v1"

ADMIN_EMAIL=${ADMIN_EMAIL:-"admin@example.com"}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-"TestPass123!"}
PATIENT_EMAIL=${PATIENT_EMAIL:-"patient@example.com"}
PATIENT_PASSWORD=${PATIENT_PASSWORD:-"TestPass123!"}
NURSE_EMAIL=${NURSE_EMAIL:-"nurse@example.com"}
NURSE_PASSWORD=${NURSE_PASSWORD:-"TestPass123!"}

create_user() {
  local email="$1"
  local password="$2"
  curl -s "$SUPABASE_URL/auth/v1/admin/users" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\",\"email_confirm\":true}" \
    | node -p "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); d.id || d.user?.id || ''"
}

get_user_id_by_email() {
  local email="$1"
  curl -s "$SUPABASE_URL/auth/v1/admin/users?email=$email" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    | node -p "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); (d.users && d.users[0] && d.users[0].id) || ''"
}

upsert_profile_role() {
  local user_id="$1"
  local role="$2"
  curl -s "$SUPABASE_REST/profiles" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates" \
    -d "[{\"id\":\"$user_id\",\"role\":\"$role\"}]" >/dev/null
}

upsert_nurse_profile() {
  local nurse_id="$1"
  curl -s "$SUPABASE_REST/nurse_profiles" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates" \
    -d "[{\"nurse_id\":\"$nurse_id\",\"license_number\":\"RN-12345\",\"verification_status\":\"approved\",\"verified_at\":\"$(date -u +%FT%TZ)\",\"is_active\":true}]" >/dev/null
}

insert_job() {
  local patient_id="$1"
  curl -s "$SUPABASE_REST/jobs" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"patient_user_id\":\"$patient_id\",\"title\":\"Overnight Care\",\"description\":\"12-hour shift\",\"address\":\"123 Main St\",\"start_time\":\"$(date -u +%FT%TZ)\",\"hourly_rate\":45,\"status\":\"open\"}" \
    | node -p "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); d.id || ''"
}

insert_application() {
  local job_id="$1"
  local nurse_id="$2"
  curl -s "$SUPABASE_REST/applications" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"job_id\":\"$job_id\",\"nurse_user_id\":\"$nurse_id\",\"status\":\"applied\"}" >/dev/null
}

ADMIN_ID=$(get_user_id_by_email "$ADMIN_EMAIL")
if [[ -z "$ADMIN_ID" ]]; then
  ADMIN_ID=$(create_user "$ADMIN_EMAIL" "$ADMIN_PASSWORD")
fi

PATIENT_ID=$(get_user_id_by_email "$PATIENT_EMAIL")
if [[ -z "$PATIENT_ID" ]]; then
  PATIENT_ID=$(create_user "$PATIENT_EMAIL" "$PATIENT_PASSWORD")
fi

NURSE_ID=$(get_user_id_by_email "$NURSE_EMAIL")
if [[ -z "$NURSE_ID" ]]; then
  NURSE_ID=$(create_user "$NURSE_EMAIL" "$NURSE_PASSWORD")
fi

upsert_profile_role "$ADMIN_ID" "admin"
upsert_profile_role "$PATIENT_ID" "patient"
upsert_profile_role "$NURSE_ID" "nurse"
upsert_nurse_profile "$NURSE_ID"

JOB_ID=$(insert_job "$PATIENT_ID")
if [[ -n "$JOB_ID" ]]; then
  insert_application "$JOB_ID" "$NURSE_ID"
fi

echo "Seed complete"
