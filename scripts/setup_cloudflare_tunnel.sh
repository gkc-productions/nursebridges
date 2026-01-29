#!/usr/bin/env bash
set -euo pipefail

TUNNEL_NAME="nursebridge"
HOSTNAME="admin.nursebridges.com"
LOCAL_URL="http://localhost:3000"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not installed. Run scripts/setup_vm.sh first."
  exit 1
fi

cloudflared tunnel login

if ! cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
  cloudflared tunnel create "$TUNNEL_NAME"
fi

TUNNEL_ID=$(cloudflared tunnel list | awk -v name="$TUNNEL_NAME" '$2==name {print $1}')

mkdir -p ~/.cloudflared
cat <<CONFIG > ~/.cloudflared/config.yml
tunnel: ${TUNNEL_ID}
credentials-file: /home/nurseapp/.cloudflared/${TUNNEL_ID}.json

ingress:
  - hostname: ${HOSTNAME}
    service: ${LOCAL_URL}
  - service: http_status:404
CONFIG

cloudflared tunnel route dns "$TUNNEL_NAME" "$HOSTNAME"

sudo cloudflared service install

echo "Tunnel configured: https://${HOSTNAME} -> ${LOCAL_URL}"
