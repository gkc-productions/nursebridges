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
    fail(`${doc} is missing legal/consent readiness snippet: ${snippet}`);
  }
}

const legalDoc = "docs/legal/beta-legal-consent-checklist.md";
const templatesDoc = "docs/release/beta-evidence-templates.md";
const readinessDoc = "docs/release/beta-readiness.md";
const goNoGoDoc = "docs/release/closed-beta-go-no-go.md";
const matrixDoc = "docs/release/beta-verification-matrix.md";
const mobileBuildDoc = "docs/ops/mobile-beta-build-readiness.md";
const trustGuard = "scripts/ops/check-trust-language.mjs";

const legal = read(legalDoc);
const templates = read(templatesDoc);
const readiness = read(readinessDoc);
const goNoGo = read(goNoGoDoc);
const matrix = read(matrixDoc);
const mobileBuild = read(mobileBuildDoc);
const trust = read(trustGuard);

for (const snippet of [
  "This checklist defines what NurseBridge needs before inviting outside closed-beta testers.",
  "It is not legal advice and is not a substitute for attorney review.",
  "## Required Review Owners",
  "Privacy policy | Legal/privacy owner",
  "Terms of service | Legal/privacy owner",
  "Verification document consent | Legal/privacy owner + operator",
  "Data retention expectations | Legal/privacy owner + operator",
  "Support and data request path | Support contact + legal/privacy owner",
  "Product copy claims | Product owner + legal/privacy owner",
  "## Required Beta Documents",
  "### Privacy Policy",
  "### Terms Of Service",
  "### Verification Document Consent",
  "### Data Retention Expectations",
  "### Support And Escalation",
  "NurseBridge beta is not an emergency service.",
  "If this is urgent or life-threatening, call local emergency services now.",
  "## Product Copy Guardrails",
  "## In-App Consent Touchpoints",
  "Privacy policy is not finalized.",
  "Terms of service are not finalized.",
  "Verification document consent is not finalized.",
  "Data retention expectations are not finalized.",
  "Support/data request path is not finalized."
]) {
  requireSnippet(legalDoc, legal, snippet);
}

for (const snippet of [
  "## Legal And Consent Evidence",
  "Legal/privacy owner:",
  "Privacy policy path/link:",
  "Terms path/link:",
  "Verification consent path/link:",
  "Data retention note/path:",
  "Support/data request process path:",
  "Emergency language present: yes/no",
  "In-app consent touchpoints reviewed: yes/no",
  "Product copy avoids unsupported claims: yes/no",
  "Attorney/formal reviewer involved: yes/no/not required for closed beta",
  "Accepted limitations:",
  "Result: Pass/Fail"
]) {
  requireSnippet(templatesDoc, templates, snippet);
}

for (const snippet of [
  "Privacy policy is not finalized.",
  "Terms of service are not finalized.",
  "Consent language for nurse verification documents is not finalized.",
  "Confirm data retention expectations for verification documents.",
  "Confirm support/escalation process for user data requests.",
  "Do not claim HIPAA, SOC 2, or other production compliance until formally reviewed and approved.",
  "Legal/privacy/terms not finalized."
]) {
  requireSnippet(readinessDoc, readiness, snippet);
}

for (const snippet of [
  "Legal/privacy/terms/verification consent are not finalized.",
  "Privacy, terms, and verification-document consent are owner-approved for beta.",
  "The app copy claims HIPAA, insurance, clinical care, license verification, background checks, emergency support, or guaranteed caregiver availability without approved process and legal review.",
  "legal/consent evidence"
]) {
  requireSnippet(goNoGoDoc, goNoGo, snippet);
}

for (const snippet of [
  "Gate 6 | Legal/consent gate reviewed | Privacy, terms, verification consent, retention, support path, copy review | Legal/consent evidence",
  "Legal/consent evidence.",
  "Gate 6 is blocked by missing owner/access/restore/legal evidence."
]) {
  requireSnippet(matrixDoc, matrix, snippet);
}

for (const snippet of [
  "Privacy policy, beta terms, and verification-document consent language are ready for the intended tester group.",
  "Legal/privacy/consent language is missing for outside testers."
]) {
  requireSnippet(mobileBuildDoc, mobileBuild, snippet);
}

for (const snippet of [
  "hipaa-compliant",
  "soc 2 compliant",
  "background checked",
  "license verified",
  "guaranteed care",
  "insurance accepted",
  "Unsupported trust/compliance language found in product surfaces."
]) {
  requireSnippet(trustGuard, trust, snippet);
}

console.log("Legal and consent readiness verification passed.");
