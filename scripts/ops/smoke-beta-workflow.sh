#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-https://api.nursebridges.com}"
PATIENT_TOKEN="${PATIENT_TOKEN:-}"
NURSE_TOKEN="${NURSE_TOKEN:-}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
ALLOW_PRODUCTION_SMOKE="${ALLOW_PRODUCTION_SMOKE:-0}"
PREFLIGHT_ONLY=0

case "${1:-}" in
  "")
    ;;
  "--preflight")
    PREFLIGHT_ONLY=1
    ;;
  "-h"|"--help")
    cat <<'USAGE'
Usage:
  scripts/ops/smoke-beta-workflow.sh [--preflight]

Environment:
  PATIENT_TOKEN=...
  NURSE_TOKEN=...
  ADMIN_TOKEN=...
  API_BASE_URL=https://api.nursebridges.com
  ALLOW_PRODUCTION_SMOKE=1

The default mode creates and mutates real care requests. The --preflight mode is
non-mutating and checks API reachability plus patient/nurse/admin token roles.
USAGE
    exit 0
    ;;
  *)
    echo "Unknown argument: ${1}" >&2
    echo "Run with --help for usage." >&2
    exit 2
    ;;
esac

API_BASE_URL="${API_BASE_URL%/}"

require_command() {
  local name="$1"
  if ! command -v "${name}" >/dev/null 2>&1; then
    echo "Missing required command: ${name}" >&2
    exit 2
  fi
}

require_command curl
require_command node
require_command awk
require_command mktemp

if [[ -z "${PATIENT_TOKEN}" || -z "${NURSE_TOKEN}" || -z "${ADMIN_TOKEN}" ]]; then
  cat >&2 <<'USAGE'
Missing required tokens.

Set these environment variables with short-lived beta/staging access tokens:

  PATIENT_TOKEN=...
  NURSE_TOKEN=...
  ADMIN_TOKEN=...

Optional:

  API_BASE_URL=https://api.nursebridges.com
  ALLOW_PRODUCTION_SMOKE=1

This script creates and mutates one real care request. Run it only against staging
or with explicit approval for a controlled production beta smoke test.

For a non-mutating readiness check, provide tokens and run:

  scripts/ops/smoke-beta-workflow.sh --preflight
USAGE
  exit 2
fi

if [[ "${API_BASE_URL}" == "https://api.nursebridges.com" && "${ALLOW_PRODUCTION_SMOKE}" != "1" && "${PREFLIGHT_ONLY}" != "1" ]]; then
  cat >&2 <<'USAGE'
Refusing to run a mutating smoke test against production.

Use a staging/local API_BASE_URL, or set this only after explicit approval for a
controlled production beta smoke test:

  ALLOW_PRODUCTION_SMOKE=1
USAGE
  exit 3
fi

api_request_public() {
  local method="$1"
  local path="$2"
  local tmp_body tmp_headers status request_id

  tmp_body="$(mktemp)"
  tmp_headers="$(mktemp)"

  status="$(
    curl -sS \
      -D "${tmp_headers}" \
      -o "${tmp_body}" \
      -w "%{http_code}" \
      -X "${method}" \
      "${API_BASE_URL}${path}"
  )"

  request_id="$(awk 'tolower($1) == "x-request-id:" {print $2}' "${tmp_headers}" | tr -d '\r' | tail -1)"

  if [[ "${status}" -lt 200 || "${status}" -ge 300 ]]; then
    echo "Request failed: ${method} ${path} -> ${status} requestId=${request_id:-unknown}" >&2
    cat "${tmp_body}" >&2
    echo >&2
    rm -f "${tmp_body}" "${tmp_headers}"
    exit 1
  fi

  echo "Request ok: ${method} ${path} -> ${status} requestId=${request_id:-unknown}" >&2
  cat "${tmp_body}"
  rm -f "${tmp_body}" "${tmp_headers}"
}

json_field() {
  local json="$1"
  local path="$2"
  JSON_INPUT="${json}" FIELD_PATH="${path}" node <<'NODE'
const input = JSON.parse(process.env.JSON_INPUT || "{}");
const path = String(process.env.FIELD_PATH || "").split(".");
let value = input;
for (const key of path) {
  value = value?.[key];
}
if (value === undefined || value === null || value === "") {
  process.exit(1);
}
process.stdout.write(String(value));
NODE
}

assert_application_status() {
  local json="$1"
  local job_id="$2"
  local expected_status="$3"
  JSON_INPUT="${json}" JOB_ID="${job_id}" EXPECTED_STATUS="${expected_status}" node <<'NODE'
const input = JSON.parse(process.env.JSON_INPUT || "{}");
const jobId = process.env.JOB_ID;
const expectedStatus = process.env.EXPECTED_STATUS;
const application = (input.applications || []).find((row) => row.job_id === jobId);
if (!application) {
  console.error(`Missing application for job ${jobId}`);
  process.exit(1);
}
if (application.status !== expectedStatus) {
  console.error(`Expected application ${jobId} to be ${expectedStatus}, got ${application.status}`);
  process.exit(1);
}
NODE
}

api_request() {
  local token="$1"
  local method="$2"
  local path="$3"
  local body="${4:-}"
  local tmp_body tmp_headers status request_id

  tmp_body="$(mktemp)"
  tmp_headers="$(mktemp)"

  if [[ -n "${body}" ]]; then
    status="$(
      curl -sS \
        -D "${tmp_headers}" \
        -o "${tmp_body}" \
        -w "%{http_code}" \
        -X "${method}" \
        -H "Authorization: Bearer ${token}" \
        -H "Content-Type: application/json" \
        --data "${body}" \
        "${API_BASE_URL}${path}"
    )"
  else
    status="$(
      curl -sS \
        -D "${tmp_headers}" \
        -o "${tmp_body}" \
        -w "%{http_code}" \
        -X "${method}" \
        -H "Authorization: Bearer ${token}" \
        "${API_BASE_URL}${path}"
    )"
  fi

  request_id="$(awk 'tolower($1) == "x-request-id:" {print $2}' "${tmp_headers}" | tr -d '\r' | tail -1)"

  if [[ "${status}" -lt 200 || "${status}" -ge 300 ]]; then
    echo "Request failed: ${method} ${path} -> ${status} requestId=${request_id:-unknown}" >&2
    cat "${tmp_body}" >&2
    echo >&2
    rm -f "${tmp_body}" "${tmp_headers}"
    exit 1
  fi

  echo "Request ok: ${method} ${path} -> ${status} requestId=${request_id:-unknown}" >&2
  cat "${tmp_body}"
  rm -f "${tmp_body}" "${tmp_headers}"
}

api_request_expect_status() {
  local token="$1"
  local method="$2"
  local path="$3"
  local expected_status="$4"
  local body="${5:-}"
  local tmp_body tmp_headers status request_id

  tmp_body="$(mktemp)"
  tmp_headers="$(mktemp)"

  if [[ -n "${body}" ]]; then
    status="$(
      curl -sS \
        -D "${tmp_headers}" \
        -o "${tmp_body}" \
        -w "%{http_code}" \
        -X "${method}" \
        -H "Authorization: Bearer ${token}" \
        -H "Content-Type: application/json" \
        --data "${body}" \
        "${API_BASE_URL}${path}"
    )"
  else
    status="$(
      curl -sS \
        -D "${tmp_headers}" \
        -o "${tmp_body}" \
        -w "%{http_code}" \
        -X "${method}" \
        -H "Authorization: Bearer ${token}" \
        "${API_BASE_URL}${path}"
    )"
  fi

  request_id="$(awk 'tolower($1) == "x-request-id:" {print $2}' "${tmp_headers}" | tr -d '\r' | tail -1)"

  if [[ "${status}" != "${expected_status}" ]]; then
    echo "Expected ${method} ${path} -> ${expected_status}, got ${status} requestId=${request_id:-unknown}" >&2
    cat "${tmp_body}" >&2
    echo >&2
    rm -f "${tmp_body}" "${tmp_headers}"
    exit 1
  fi

  echo "Expected response observed: ${method} ${path} -> ${status} requestId=${request_id:-unknown}" >&2
  cat "${tmp_body}"
  rm -f "${tmp_body}" "${tmp_headers}"
}

echo "Checking API health at ${API_BASE_URL}..."
api_request_public GET "/health" >/dev/null

echo "Checking token roles..."
patient_me="$(api_request "${PATIENT_TOKEN}" GET "/me")"
nurse_me="$(api_request "${NURSE_TOKEN}" GET "/me")"
admin_me="$(api_request "${ADMIN_TOKEN}" GET "/me")"

patient_role="$(json_field "${patient_me}" "role")"
nurse_role="$(json_field "${nurse_me}" "role")"
admin_role="$(json_field "${admin_me}" "role")"
nurse_user_id="$(json_field "${nurse_me}" "userId")"

if [[ "${patient_role}" != "patient" || "${nurse_role}" != "nurse" || "${admin_role}" != "admin" ]]; then
  echo "Expected patient/nurse/admin tokens, got: ${patient_role}/${nurse_role}/${admin_role}" >&2
  exit 1
fi

if [[ "${PREFLIGHT_ONLY}" == "1" ]]; then
  cat <<USAGE
Smoke preflight passed.

API base: ${API_BASE_URL}
Roles: ${patient_role}/${nurse_role}/${admin_role}

No care requests were created or mutated. The full smoke still requires an
approved nurse token and explicit approval before production use.
USAGE
  exit 0
fi

stamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
build_create_body() {
  local title="$1"
  TITLE="${title}" node <<'NODE'
process.stdout.write(JSON.stringify({
  title: process.env.TITLE,
  description: "Automated beta smoke request. Safe to cancel after verification.",
  start_time: "",
  logistics: {
    residence_type: "house",
    street_address: "100 Smoke Test Way",
    city: "Atlanta",
    state: "GA",
    postal_code: "30303",
    stairs: "none",
    mobility_aids: ["none"],
    transportation_mode: "not_arranged",
    return_plan: "not_arranged"
  }
}));
NODE
}

create_body="$(build_create_body "Beta smoke completion request ${stamp}")"

echo "Creating patient care request..."
create_response="$(api_request "${PATIENT_TOKEN}" POST "/jobs" "${create_body}")"
job_id="$(json_field "${create_response}" "job.id")"
echo "Created job ${job_id}"

echo "Submitting nurse application..."
apply_body="$(NOTE="Automated beta smoke application." node -e 'process.stdout.write(JSON.stringify({note: process.env.NOTE}))')"
api_request "${NURSE_TOKEN}" POST "/jobs/${job_id}/apply" "${apply_body}" >/dev/null

echo "Verifying open job cannot be completed before assignment..."
api_request_expect_status "${NURSE_TOKEN}" PATCH "/jobs/${job_id}/complete" "400" >/dev/null

echo "Assigning nurse as admin..."
assign_body="$(JOB_ID="${job_id}" NURSE_ID="${nurse_user_id}" node <<'NODE'
process.stdout.write(JSON.stringify({
  jobId: process.env.JOB_ID,
  nurseUserId: process.env.NURSE_ID
}));
NODE
)"
api_request "${ADMIN_TOKEN}" POST "/admin/jobs/assign" "${assign_body}" >/dev/null

echo "Verifying assigned care cannot be completed before visit documentation..."
api_request_expect_status "${NURSE_TOKEN}" PATCH "/jobs/${job_id}/complete" "400" >/dev/null

echo "Creating and verifying the in-person arrival PIN..."
arrival_response="$(api_request "${PATIENT_TOKEN}" POST "/jobs/${job_id}/arrival-pin")"
arrival_pin="$(json_field "${arrival_response}" "pin")"
arrival_body="$(ARRIVAL_PIN="${arrival_pin}" node <<'NODE'
process.stdout.write(JSON.stringify({ pin: process.env.ARRIVAL_PIN }));
NODE
)"
api_request "${NURSE_TOKEN}" POST "/jobs/${job_id}/arrival-pin/verify" "${arrival_body}" >/dev/null

echo "Recording the ordered visit checkpoints through patient handoff..."
visit_event_body() {
  local event_type="$1"
  EVENT_TYPE="${event_type}" node <<'NODE'
process.stdout.write(JSON.stringify({
  event_type: process.env.EVENT_TYPE,
  note: "Automated beta smoke checkpoint. No patient information recorded."
}));
NODE
}

for event_type in \
  pre_visit_confirmed \
  en_route \
  arrived \
  patient_met \
  facility_check_in \
  appointment_started \
  appointment_ended \
  return_started \
  patient_handoff
do
  api_request "${NURSE_TOKEN}" POST "/jobs/${job_id}/visit/events" "$(visit_event_body "${event_type}")" >/dev/null
done

echo "Submitting the required privacy-minimized visit report..."
visit_report_body="$(node <<'NODE'
process.stdout.write(JSON.stringify({
  status: "submitted",
  visit_summary: "Automated beta smoke visit completed as planned.",
  provider_instructions: "None provided during this synthetic test.",
  follow_up_tasks: "None identified during this synthetic test.",
  transportation_outcome: "Synthetic safe handoff completed."
}));
NODE
)"
api_request "${NURSE_TOKEN}" PUT "/jobs/${job_id}/visit/report" "${visit_report_body}" >/dev/null

echo "Recording the final visit checkpoint..."
api_request "${NURSE_TOKEN}" POST "/jobs/${job_id}/visit/events" "$(visit_event_body "visit_completed")" >/dev/null

echo "Completing assigned job as nurse..."
api_request "${NURSE_TOKEN}" PATCH "/jobs/${job_id}/complete" >/dev/null

echo "Verifying accepted application remains accepted after completion..."
nurse_applications="$(api_request "${NURSE_TOKEN}" GET "/v1/applications")"
assert_application_status "${nurse_applications}" "${job_id}" "accepted"

echo "Verifying completed job cannot be cancelled..."
api_request_expect_status "${PATIENT_TOKEN}" PATCH "/jobs/${job_id}/cancel" "400" >/dev/null

echo "Reloading final job state..."
final_response="$(api_request "${PATIENT_TOKEN}" GET "/jobs/${job_id}")"
final_status="$(json_field "${final_response}" "job.status")"

if [[ "${final_status}" != "completed" ]]; then
  echo "Expected final status completed, got ${final_status}" >&2
  exit 1
fi

cancel_body="$(build_create_body "Beta smoke cancellation request ${stamp}")"

echo "Creating second request for cancellation checks..."
cancel_response="$(api_request "${PATIENT_TOKEN}" POST "/jobs" "${cancel_body}")"
cancel_job_id="$(json_field "${cancel_response}" "job.id")"
echo "Created cancellation job ${cancel_job_id}"

echo "Submitting nurse application to cancellation request..."
api_request "${NURSE_TOKEN}" POST "/jobs/${cancel_job_id}/apply" "${apply_body}" >/dev/null

echo "Verifying nurse cannot cancel patient request..."
api_request_expect_status "${NURSE_TOKEN}" PATCH "/jobs/${cancel_job_id}/cancel" "403" >/dev/null

echo "Cancelling second request as patient..."
api_request "${PATIENT_TOKEN}" PATCH "/jobs/${cancel_job_id}/cancel" >/dev/null

echo "Verifying cancelled request cannot be completed..."
api_request_expect_status "${NURSE_TOKEN}" PATCH "/jobs/${cancel_job_id}/complete" "400" >/dev/null

echo "Verifying nurse cannot apply to cancelled request..."
api_request_expect_status "${NURSE_TOKEN}" POST "/jobs/${cancel_job_id}/apply" "400" "${apply_body}" >/dev/null

echo "Verifying cancellation rejected pending application..."
nurse_applications="$(api_request "${NURSE_TOKEN}" GET "/v1/applications")"
assert_application_status "${nurse_applications}" "${cancel_job_id}" "rejected"

echo "Reloading cancelled job state..."
cancel_final_response="$(api_request "${PATIENT_TOKEN}" GET "/jobs/${cancel_job_id}")"
cancel_final_status="$(json_field "${cancel_final_response}" "job.status")"

if [[ "${cancel_final_status}" != "cancelled" ]]; then
  echo "Expected cancellation job status cancelled, got ${cancel_final_status}" >&2
  exit 1
fi

echo "Smoke workflow passed: completion job ${job_id} and cancellation job ${cancel_job_id} verified."
