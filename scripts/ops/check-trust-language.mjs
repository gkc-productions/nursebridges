#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const productSurfaceFiles = [
  "apps/mobile/App.tsx",
  "apps/mobile/src/screens/ApiTestScreen.tsx",
  "apps/mobile/src/screens/EnvironmentScreen.tsx",
  "apps/mobile/src/screens/LoginScreen.tsx",
  "apps/mobile/src/screens/TokenScreen.tsx",
  "apps/admin/app/page.tsx"
];

const forbiddenClaims = [
  "hipaa-compliant",
  "hipaa compliant",
  "soc 2 compliant",
  "insured",
  "background checked",
  "license verified",
  "guaranteed care",
  "hospital approved",
  "insurance accepted",
  "claims processing"
];

const sensitiveTerms = [
  "hipaa",
  "soc 2",
  "insurance",
  "background-check",
  "background check",
  "license-verification",
  "license verification",
  "emergency care",
  "emergency service",
  "guaranteed"
];

const allowedContexts = [
  "do not claim",
  "does not claim",
  "must not claim",
  "not an emergency service",
  "local emergency services",
  "unsupported",
  "unless formally",
  "unless reviewed",
  "unless approved"
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function lineAllowed(line) {
  const normalized = line.toLowerCase();
  return allowedContexts.some((context) => normalized.includes(context));
}

const findings = [];

for (const file of productSurfaceFiles) {
  const absolutePath = path.join(root, file);
  if (!fs.existsSync(absolutePath)) {
    fail(`Trust-language guard expected product surface file to exist: ${file}`);
  }

  const lines = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/);

  lines.forEach((line, index) => {
    const normalized = line.toLowerCase();
    const hasForbiddenClaim = forbiddenClaims.some((claim) => normalized.includes(claim));
    const hasSensitiveTerm = sensitiveTerms.some((term) => normalized.includes(term));

    if ((hasForbiddenClaim || hasSensitiveTerm) && !lineAllowed(line)) {
      findings.push(`${file}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (findings.length > 0) {
  fail(
    [
      "Unsupported trust/compliance language found in product surfaces.",
      "Use closed-beta, admin-reviewed, private upload, not-emergency, or explicit does-not-claim language instead.",
      ...findings
    ].join("\n")
  );
}

console.log("Trust-language verification passed.");
