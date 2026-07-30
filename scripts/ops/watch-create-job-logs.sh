#!/usr/bin/env bash
set -euo pipefail

SINCE="${1:-15 minutes ago}"
REQUEST_ID="${2:-}"

LOG_PATTERN='create_job_failed|request_validation_failed|"method":"POST","path":"/jobs"'

if [[ -n "${REQUEST_ID}" ]]; then
  journalctl -u nursebridge-api.service --since "${SINCE}" --no-pager \
    | grep -E "${LOG_PATTERN}" \
    | grep -F "${REQUEST_ID}" \
    | tail -120
else
  journalctl -u nursebridge-api.service --since "${SINCE}" --no-pager \
    | grep -E "${LOG_PATTERN}" \
    | tail -120
fi
