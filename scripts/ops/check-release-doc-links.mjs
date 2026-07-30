#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const stagedPackageCount = 131;

const requiredLinks = {
  "docs/release/beta-readiness.md": [
    "docs/release/beta-verification-matrix.md",
    "docs/release/beta-evidence-templates.md",
    "docs/release/closed-beta-go-no-go.md"
  ],
  "docs/release/beta-verification-matrix.md": [
    "docs/release/closed-beta-go-no-go.md",
    "docs/release/beta-evidence-templates.md",
    "docs/release/beta-evidence-log.md"
  ],
  "docs/release/beta-evidence-log.md": [
    "docs/release/beta-verification-matrix.md",
    "docs/release/beta-evidence-templates.md"
  ],
  "docs/release/closed-beta-go-no-go.md": [
    "Status: No-go for outside testers.",
    "docs/release/beta-evidence-log.md",
    "docs/release/beta-verification-matrix.md",
    "docs/release/beta-evidence-templates.md",
    "docs/release/pending-vm-verification.md"
  ],
  "docs/release/closed-beta-operator-runbook.md": [
    "docs/release/beta-verification-matrix.md",
    "docs/release/beta-evidence-templates.md"
  ],
  "docs/release/current-build-status.md": [
    "docs/release/pending-vm-verification.md",
    "docs/release/closed-beta-go-no-go.md",
    "docs/release/beta-evidence-templates.md",
    "scripts/ops/check-trust-language.mjs"
  ],
  "docs/release/production-build-plan.md": [
    "docs/release/beta-verification-matrix.md",
    "docs/release/closed-beta-go-no-go.md"
  ],
  "docs/release/implementation-backlog.md": [
    "docs/release/beta-verification-matrix.md",
    "docs/release/closed-beta-go-no-go.md"
  ]
};

const templateHeadings = [
  "## Create-Request Debug Evidence",
  "## Workflow Smoke Evidence",
  "## Patient Real-Device Evidence",
  "## Nurse Real-Device Evidence",
  "## Admin Web Evidence",
  "## Notification Evidence",
  "## Nurse Verification Upload Evidence",
  "## Workflow Boundary Evidence",
  "## Beta Access Rules Evidence",
  "## Monitoring Owner Evidence",
  "## Legal And Consent Evidence",
  "## Restore Drill Evidence",
  "## Go/No-Go Decision Evidence"
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

for (const [doc, requiredSnippets] of Object.entries(requiredLinks)) {
  const text = read(doc);

  for (const snippet of requiredSnippets) {
    if (!text.includes(snippet)) {
      fail(`${doc} is missing required release-doc reference: ${snippet}`);
    }
  }
}

const templates = read("docs/release/beta-evidence-templates.md");
for (const heading of templateHeadings) {
  if (!templates.includes(heading)) {
    fail(`docs/release/beta-evidence-templates.md is missing template heading: ${heading}`);
  }
}

const verificationMatrix = read("docs/release/beta-verification-matrix.md");
for (const snippet of [
  "Gate 5: workflow boundary and atomicity approved",
  "Gate 7: tiny controlled beta",
  "Assignment source of truth verified",
  "RPC-backed assignment/terminal finalizers approved or explicitly excepted",
  "Admin/API lifecycle boundary converged",
  "Workflow boundary evidence",
  "Gate 5 is blocked by missing workflow boundary/atomicity evidence or written owner exception.",
  "Gate 7 is blocked until gates 1 through 6 are proven or explicitly accepted with documented limitations."
]) {
  if (!verificationMatrix.includes(snippet)) {
    fail(`docs/release/beta-verification-matrix.md is missing workflow-boundary gate snippet: ${snippet}`);
  }
}

for (const snippet of [
  "Canonical assignment field verified: yes/no",
  "Assignment RPC prerequisite check:",
  "Assignment RPC strict exposure check:",
  "Terminal RPC prerequisite check:",
  "Terminal RPC strict exposure check:",
  "Admin/API assignment boundary converged: yes/no",
  "Admin/API terminal boundary converged: yes/no",
  "Guarded multi-write outside-tester exception accepted: yes/no"
]) {
  if (!templates.includes(snippet)) {
    fail(`docs/release/beta-evidence-templates.md is missing workflow-boundary evidence field: ${snippet}`);
  }
}

const pendingVerification = read("docs/release/pending-vm-verification.md");
for (const command of [
  "node scripts/ops/verify-nursebridges-identity.mjs",
  "node scripts/ops/verify-vm-stage-package.mjs",
  "pnpm verify",
  "pnpm run build"
]) {
  if (!pendingVerification.includes(command)) {
    fail(`docs/release/pending-vm-verification.md is missing resume command: ${command}`);
  }
}

const countPattern = new RegExp(`${stagedPackageCount}-(file|staged)|${stagedPackageCount} staged`);
for (const doc of [
  "docs/release/vm-sync-handoff.md",
  "docs/release/engineering-state-snapshot.md",
  "docs/release/current-build-status.md",
  "docs/release/beta-evidence-log.md",
    "docs/release/pending-vm-verification.md",
    "docs/release/closed-beta-go-no-go.md"
]) {
  if (!countPattern.test(read(doc))) {
    fail(`${doc} does not mention the current ${stagedPackageCount}-file staged package`);
  }
}

const staleCountPattern = /\b(7[0-9]|8[0-9]|9[0-9]|10[0-9]|11[0-9]|12[0-9]|130)-(file|staged)|\b(7[0-9]|8[0-9]|9[0-9]|10[0-9]|11[0-9]|12[0-9]|130) staged/;
for (const doc of [
  "docs/release/vm-sync-handoff.md",
  "docs/release/engineering-state-snapshot.md",
  "docs/release/current-build-status.md",
  "docs/release/pending-vm-verification.md",
  "docs/release/closed-beta-go-no-go.md"
]) {
  const text = read(doc)
    .replaceAll("77 staged files", "")
    .replaceAll("77-file staged-package guard", "");
  if (staleCountPattern.test(text)) {
    fail(`${doc} contains a stale staged package count`);
  }
}

console.log("Release doc link verification passed.");
