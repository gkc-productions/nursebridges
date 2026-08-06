#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function has(relativePath, snippet) {
  return read(relativePath).includes(snippet);
}

function line(label, value) {
  console.log(`${label.padEnd(22)} ${value}`);
}

const packageGuard = "scripts/ops/verify-vm-stage-package.mjs";
const statusDoc = "docs/release/current-build-status.md";
const goNoGoDoc = "docs/release/closed-beta-go-no-go.md";
const pendingVmDoc = "docs/release/pending-vm-verification.md";

const packageGuardText = read(packageGuard);
const stagedArray = packageGuardText.match(/const stagedFiles = \[([\s\S]*?)\];/);
const stagedFileCount = stagedArray ? (stagedArray[1].match(/^\s+"[^"]+",?/gm) ?? []).length : 0;

console.log("NurseBridges Build Status");
console.log("========================");
line("Product track", "closed beta first, not public launch");
line("Beta decision", has(goNoGoDoc, "Status: No-go for outside testers.") ? "NO-GO for outside testers" : "needs review");
line("Staged package", stagedFileCount > 0 ? `${stagedFileCount} files` : "needs review");
line("VM root proof", has(pendingVmDoc, "pnpm run build") ? "pending for latest staged package" : "needs review");
console.log("");

console.log("What is built");
console.log("-------------");
line("Patient app", "separate NurseBridges patient experience with onboarding and guided requests");
line("Care app", "separate NurseBridges Care product planned; implementation pending");
line("Admin", "web dispatcher foundation with assignment/terminal/verification coverage");
line("API", "Fastify workflow backbone with create-request fix deployed");
line("Shared workflow", "API/admin/mobile share lifecycle predicates and error categories");
line("Safety guards", "privacy, logs, mobile secrets, trust language, isolation, beta gates");
line("Atomicity plan", "assignment and terminal RPC drafts prepared; Supabase apply not approved yet");
console.log("");

console.log("Current blockers");
console.log("----------------");
line("iPhone workflow", "patient create -> nurse apply -> admin assign -> nurse complete proven");
line("Android", has(statusDoc, "no connected/authorized Android device") ? "adb installed, no authorized device visible" : "needs preflight");
line("iPhone", "signing, installed build, and TestFlight download path proven");
line("Patient release", "0.1.0 (3) uploaded; processing and TestFlight device proof pending");
line("Cancellation proof", "real-device cancellation path still needs evidence");
line("VM latest package", "needs root verify/build rerun when VM access is available");
console.log("");

console.log("Next commands");
console.log("-------------");
console.log("Local package/readiness:");
console.log("  node scripts/ops/verify-vm-stage-package.mjs");
console.log("  node scripts/ops/check-beta-gates.mjs");
console.log("");
console.log("Android phone path:");
console.log("  adb devices -l");
console.log("  cd apps/mobile && pnpm run android:install-preflight");
console.log("");
console.log("iPhone path:");
console.log("  cd apps/mobile && pnpm run ios:install-preflight");
console.log("");
console.log("Next Patient release step:");
console.log("  wait for NurseBridges 0.1.0 (3) to finish App Store Connect processing");
console.log("  install from TestFlight and verify onboarding, sign-in, and early access");
