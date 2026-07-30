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
    fail(`${doc} is missing beta operations readiness snippet: ${snippet}`);
  }
}

const playbookDoc = "docs/ops/closed-beta-ops-playbook.md";
const readinessDoc = "docs/release/beta-readiness.md";
const goNoGoDoc = "docs/release/closed-beta-go-no-go.md";
const templatesDoc = "docs/release/beta-evidence-templates.md";
const legalDoc = "docs/legal/beta-legal-consent-checklist.md";

const playbook = read(playbookDoc);
const readiness = read(readinessDoc);
const goNoGo = read(goNoGoDoc);
const templates = read(templatesDoc);
const legal = read(legalDoc);

for (const snippet of [
  "## Required Roles",
  "Beta owner",
  "Admin/operator",
  "Engineering responder",
  "Support contact",
  "Legal/privacy owner",
  "## Monitoring Window",
  "Do not run live care request tests when nobody is watching.",
  "## Severity Levels",
  "SEV-1: Safety, Privacy, Or Access Risk",
  "SEV-2: Core Workflow Blocked",
  "## Incident Intake",
  "Request ID/reference if available.",
  "Do not collect:",
  "Bearer tokens.",
  "Service role keys.",
  "## Support Response Pattern",
  "NurseBridge beta is not an emergency service.",
  "## Stop Conditions",
  "Resume only after:",
  "Beta owner approves continuation.",
  "Monitoring owner and response expectations are not yet assigned.",
  "Installed-device create-request proof remains the active blocker after the deployed backend fix."
]) {
  requireSnippet(playbookDoc, playbook, snippet);
}

for (const snippet of [
  "Define who monitors logs during beta and expected response times.",
  "Confirm beta tester access rules before inviting external users.",
  "Legal/privacy/terms not finalized.",
  "Test restore into a non-production Supabase project not completed."
]) {
  requireSnippet(readinessDoc, readiness, snippet);
}

for (const snippet of [
  "Beta access rules and support/monitoring ownership are named.",
  "There is no named person watching logs/support during the beta window.",
  "Named monitoring owner:",
  "Support window:",
  "Stop conditions acknowledged: yes/no"
]) {
  requireSnippet(goNoGoDoc, goNoGo, snippet);
}

for (const snippet of [
  "## Monitoring Owner Evidence",
  "Monitoring owner:",
  "Support contact:",
  "Beta window:",
  "Expected response time:",
  "Log sources watched:",
  "Incident intake path:",
  "Stop conditions acknowledged: yes/no",
  "Escalation path:"
]) {
  requireSnippet(templatesDoc, templates, snippet);
}

for (const snippet of [
  "## Required Review Owners",
  "Support And Escalation",
  "What information users must not send, such as passwords or tokens.",
  "NurseBridge beta is not an emergency service.",
  "Support/data request path is not finalized."
]) {
  requireSnippet(legalDoc, legal, snippet);
}

console.log("Beta operations readiness verification passed.");
