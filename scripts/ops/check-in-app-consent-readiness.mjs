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
    fail(`${doc} is missing in-app consent readiness snippet: ${snippet}`);
  }
}

const mobileAppDoc = "apps/mobile/App.tsx";
const adminPageDoc = "apps/admin/app/page.tsx";
const legalDoc = "docs/legal/beta-legal-consent-checklist.md";
const legalGuardDoc = "scripts/ops/check-legal-consent-readiness.mjs";
const trustGuardDoc = "scripts/ops/check-trust-language.mjs";

const mobileApp = read(mobileAppDoc);
const adminPage = read(adminPageDoc);
const legal = read(legalDoc);
const legalGuard = read(legalGuardDoc);
const trustGuard = read(trustGuardDoc);

for (const snippet of [
  "Beta access and support",
  "NurseBridge is a closed beta care coordination tool. It is not an emergency service.",
  "For app issues, copy the issue details when an error appears and send them to the beta operator.",
  "For urgent medical or safety needs, use local emergency services or the patient's normal care contact.",
  "Submit only the details needed for closed-beta review, assignment, and follow-up.",
  "This is not an",
  "emergency service or a full medical chart.",
  "Upload requested documents for admin review after you are comfortable sharing them for beta",
  "Approval is not automatic",
  "this beta does not claim background-check or",
  "license-verification completion.",
  "Support snapshot"
]) {
  requireSnippet(mobileAppDoc, mobileApp, snippet);
}

for (const snippet of [
  "Closed beta console",
  "Review submitted metadata without exposing private storage paths.",
  "Approval records beta eligibility",
  "it does not claim background-check or license-verification completion.",
  "Recent admin events"
]) {
  requireSnippet(adminPageDoc, adminPage, snippet);
}

for (const snippet of [
  "## In-App Consent Touchpoints",
  "Account creation or beta onboarding.",
  "Patient create-request screen.",
  "Nurse verification upload screen.",
  "Admin verification review screen.",
  "Support/contact screen.",
  "Do not enter unnecessary sensitive medical details unless requested by the beta process.",
  "Upload is for beta review.",
  "Approval is not automatic.",
  "Unsupported verification claims are not being made."
]) {
  requireSnippet(legalDoc, legal, snippet);
}

for (const snippet of [
  "In-app consent touchpoints reviewed: yes/no",
  "Emergency language present: yes/no"
]) {
  requireSnippet(legalGuardDoc, legalGuard, snippet);
}

for (const snippet of [
  "apps/mobile/App.tsx",
  "apps/admin/app/page.tsx",
  "Unsupported trust/compliance language found in product surfaces."
]) {
  requireSnippet(trustGuardDoc, trustGuard, snippet);
}

console.log("In-app consent readiness verification passed.");
