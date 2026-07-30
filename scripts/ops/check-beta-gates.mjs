#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const stagedPackageCount = 131;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requireSnippet(doc, text, snippet) {
  if (!text.includes(snippet)) {
    fail(`${doc} is missing required beta gate proof: ${snippet}`);
  }
}

const goNoGoDoc = "docs/release/closed-beta-go-no-go.md";
const betaReadinessDoc = "docs/release/beta-readiness.md";
const verificationMatrixDoc = "docs/release/beta-verification-matrix.md";
const pendingVmDoc = "docs/release/pending-vm-verification.md";
const currentStatusDoc = "docs/release/current-build-status.md";

const goNoGo = read(goNoGoDoc);
const betaReadiness = read(betaReadinessDoc);
const verificationMatrix = read(verificationMatrixDoc);
const pendingVm = read(pendingVmDoc);
const currentStatus = read(currentStatusDoc);

for (const snippet of [
  "Status: No-go for outside testers.",
  "## Non-Negotiable Go Gates",
  "## Automatic No-Go Conditions",
  "## Stop Conditions During Beta",
  `${stagedPackageCount}-file`
]) {
  requireSnippet(goNoGoDoc, goNoGo, snippet);
}

for (const snippet of [
  "## Known Beta Blockers",
  "Real-device patient create-job",
  "Full patient -> nurse -> admin assignment workflow",
  "Legal/privacy/terms"
]) {
  requireSnippet(betaReadinessDoc, betaReadiness, snippet);
}

for (const snippet of [
  "## Current Blockers",
  "Gate 1 is blocked",
  "Gate 5 is blocked",
  "Gate 7 is blocked"
]) {
  requireSnippet(verificationMatrixDoc, verificationMatrix, snippet);
}

for (const command of [
  "node scripts/ops/verify-nursebridges-identity.mjs",
  "node scripts/ops/verify-vm-stage-package.mjs",
  "pnpm verify",
  "pnpm run build"
]) {
  requireSnippet(pendingVmDoc, pendingVm, command);
}

const noGoSurface = `${goNoGo}\n${currentStatus}`.toLowerCase();
if (!noGoSurface.includes("no-go") || !noGoSurface.includes("outside testers")) {
  fail("release docs must keep the current no-go status visible for outside testers");
}

console.log("Beta gate verification passed.");
