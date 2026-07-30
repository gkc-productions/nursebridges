#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function fail(message) {
  console.error(message);
  process.exit(1);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requireSnippet(doc, text, snippet) {
  if (!text.includes(snippet)) {
    fail(`${doc} is missing access/secrets readiness snippet: ${snippet}`);
  }
}

const readinessDoc = "docs/release/beta-readiness.md";
const templatesDoc = "docs/release/beta-evidence-templates.md";
const playbookDoc = "docs/ops/closed-beta-ops-playbook.md";
const deploymentDoc = "docs/ops/deployment-runbook.md";
const goNoGoDoc = "docs/release/closed-beta-go-no-go.md";
const matrixDoc = "docs/release/beta-verification-matrix.md";
const mobileBuildDoc = "docs/ops/mobile-beta-build-readiness.md";

const readiness = read(readinessDoc);
const templates = read(templatesDoc);
const playbook = read(playbookDoc);
const deployment = read(deploymentDoc);
const goNoGo = read(goNoGoDoc);
const matrix = read(matrixDoc);
const mobileBuild = read(mobileBuildDoc);

for (const snippet of [
  "Confirm operational secret owner and rotation procedure before broader beta.",
  "Confirm beta tester access rules before inviting external users.",
  "Service role keys are isolated to server-side API/admin code.",
  "Mobile code does not reference service role keys or database passwords.",
  "Runtime env file permissions documented as `root:root` and `chmod 600`."
]) {
  requireSnippet(readinessDoc, readiness, snippet);
}

for (const snippet of [
  "## Beta Access Rules Evidence",
  "Cloudflare Access policy reviewed: yes/no",
  "Admin tester list reviewed: yes/no",
  "Patient tester access reviewed: yes/no",
  "Nurse tester access reviewed: yes/no",
  "Unauthorized admin access blocked: yes/no/not tested",
  "Invite process:",
  "Revocation process:",
  "Secrets owner:",
  "Rotation procedure reviewed: yes/no",
  "Runtime env owner:",
  "Emergency revocation path:",
  "No secrets copied into evidence: yes/no"
]) {
  requireSnippet(templatesDoc, templates, snippet);
}

for (const snippet of [
  "Tester identities and roles are known.",
  "Beta access rules.",
  "Service role key, token, private document path, or secret is exposed.",
  "Do not collect:",
  "Bearer tokens.",
  "Service role keys."
]) {
  requireSnippet(playbookDoc, playbook, snippet);
}

for (const snippet of [
  "This runbook does not cover:",
  "Secrets or runtime env changes.",
  "Those require separate scoped approval.",
  "Do not modify `/etc/nursebridge/*.env` without separate approval.",
  "Confirm no secrets are present in logs, diffs, docs, or command output.",
  "Logs show missing env/secrets.",
  "Logs expose secrets or private details."
]) {
  requireSnippet(deploymentDoc, deployment, snippet);
}

for (const snippet of [
  "Beta access rules and support/monitoring ownership are named.",
  "Mobile app requires service-role keys, database passwords, or server-only secrets.",
  "Users can see or mutate another user's protected records.",
  "a privacy or access-control issue is suspected",
  "Cloudflare, VM, Supabase, or app auth becomes unstable during active care coordination.",
  "beta access rules evidence"
]) {
  requireSnippet(goNoGoDoc, goNoGo, snippet);
}

for (const snippet of [
  "Gate 6 | Beta access rules confirmed | Cloudflare/admin/tester access rule evidence | Beta access rules evidence",
  "Beta access rules evidence.",
  "Gate 6 is blocked by missing owner/access/restore/legal evidence."
]) {
  requireSnippet(matrixDoc, matrix, snippet);
}

for (const snippet of [
  "Mobile app does not contain service-role keys, database passwords, runtime server secrets, or private storage credentials.",
  "Get explicit owner approval before EAS, TestFlight, app-store-connected steps, or credential changes.",
  "The beta support owner is not defined."
]) {
  requireSnippet(mobileBuildDoc, mobileBuild, snippet);
}

console.log("Access and secrets readiness verification passed.");
