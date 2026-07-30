#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MOBILE_DIR="${MOBILE_DIR:-${ROOT_DIR}/apps/mobile}"

detect_lan_ip() {
  local iface

  iface="$(route -n get default 2>/dev/null | awk '/interface:/ { print $2; exit }' || true)"
  if [[ -n "${iface}" ]]; then
    ipconfig getifaddr "${iface}" 2>/dev/null && return 0
  fi

  ipconfig getifaddr en0 2>/dev/null && return 0
  ipconfig getifaddr en1 2>/dev/null && return 0

  ifconfig 2>/dev/null \
    | awk '/inet / && $2 !~ /^127\./ && $2 !~ /^169\.254\./ { print $2; exit }'
}

LAN_IP="${LAN_IP:-$(detect_lan_ip || true)}"
if [[ -n "${EXPO_URL:-}" ]]; then
  RESOLVED_EXPO_URL="${EXPO_URL}"
elif [[ -n "${LAN_IP}" ]]; then
  RESOLVED_EXPO_URL="exp://${LAN_IP}:8081"
else
  RESOLVED_EXPO_URL="exp://192.168.1.114:8081"
fi

if ! command -v xcrun >/dev/null 2>&1; then
  echo "Xcode command-line tools are required for iPhone device checks." >&2
  exit 1
fi

if [[ ! -d "${MOBILE_DIR}" ]]; then
  echo "Mobile app directory not found: ${MOBILE_DIR}" >&2
  exit 1
fi

DEVICE_ID="${IPHONE_DEVICE:-}"
if [[ -z "${DEVICE_ID}" ]]; then
  DEVICE_ID="$(
    xcrun devicectl list devices \
      | awk '/iPhone/ && /connected/ { for (i = 1; i <= NF; i++) if ($i ~ /^[A-F0-9-]{36}$/) { print $i; exit } }'
  )"
fi

if [[ -z "${DEVICE_ID}" ]]; then
  echo "No connected iPhone found. Connect the iPhone, unlock it, and trust this Mac." >&2
  xcrun devicectl list devices || true
  exit 1
fi

echo "Connected iPhone: ${DEVICE_ID}"

if ! xcrun devicectl device info apps --device "${DEVICE_ID}" | grep -Eq 'host\.exp\.Exponent|Expo Go'; then
  cat >&2 <<EOF
Expo Go is not installed on the connected iPhone.

Install Expo Go from the App Store, then rerun this script.
After Expo starts, open this URL from Expo Go or scan the QR code:
${RESOLVED_EXPO_URL}
EOF
  exit 2
fi

echo "Expo Go is installed."
echo "Starting NurseBridge mobile app from: ${MOBILE_DIR}"
if [[ -z "${LAN_IP}" && -z "${EXPO_URL:-}" ]]; then
  echo "Could not detect LAN IP; using last known Expo URL. Set EXPO_URL=exp://YOUR_MAC_IP:8081 if needed."
fi
echo "Expected Expo URL: ${RESOLVED_EXPO_URL}"
echo "To open Expo Go directly after Metro starts, run this in another terminal:"
echo "xcrun devicectl device process launch --device ${DEVICE_ID} host.exp.Exponent --payload-url ${RESOLVED_EXPO_URL}"
echo "Use a patient beta account and submit one non-sensitive test request."
echo

cd "${MOBILE_DIR}"
pnpm exec expo start --lan --clear
