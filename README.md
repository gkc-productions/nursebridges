# NurseBridge Monorepo

## Requirements
- Node.js 20+
- Expo CLI (install globally if needed)

## Setup
```bash
cd /home/nurseapp/nursebridge
npm install
```

## Run dev (admin + mobile)
```bash
./scripts/run_dev.sh
```

## Run admin only
```bash
cd /home/nurseapp/nursebridge/apps/admin
npm run dev
```

## Run mobile only
```bash
cd /home/nurseapp/nursebridge/apps/mobile
npm run dev
```

## Lint
```bash
./scripts/lint.sh
```

## VM setup
```bash
./scripts/setup_vm.sh
./scripts/setup_ufw.sh
```

## Cloudflare Tunnel (admin)
```bash
./scripts/setup_cloudflare_tunnel.sh
```
