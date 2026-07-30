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

function walk(dir) {
  const entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(relativePath));
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      files.push(relativePath);
    }
  }
  return files;
}

function requireSnippet(doc, text, snippet) {
  if (!text.includes(snippet)) {
    fail(`${doc} is missing API log hygiene snippet: ${snippet}`);
  }
}

const sourceFiles = [
  ...walk("services/api/src"),
  ...walk("apps/admin/lib"),
  ...walk("apps/admin/app/api")
];

const unsafeLogPatterns = [
  /\bconsole\.(log|info|warn|error)\([^)]*\b(req|request)\b[^)]*\)/i,
  /\bconsole\.(log|info|warn|error)\([^)]*\b(headers|authorization|cookie|jwt|token|password|storage_path)\b[^)]*\)/i,
  /\bconsole\.(log|info|warn|error)\([^)]*\b(description|address|rawBody|body)\b[^)]*\)/i,
  /\b(req|request)\.log\.(info|warn|error|debug)\([^)]*\b(headers|authorization|cookie|jwt|token|password|storage_path)\b[^)]*\)/i,
  /\b(req|request)\.log\.(info|warn|error|debug)\([^)]*\b(description|address|rawBody|body)\b[^)]*\)/i
];

for (const file of sourceFiles) {
  const text = read(file);
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const pattern of unsafeLogPatterns) {
      if (pattern.test(line)) {
        fail(`${file}:${index + 1} appears to log raw request, token, storage path, or care-detail data`);
      }
    }
  });
}

const observabilityDoc = "docs/ops/observability.md";
const betaReadinessDoc = "docs/release/beta-readiness.md";
const goNoGoDoc = "docs/release/closed-beta-go-no-go.md";
const operatorRunbookDoc = "docs/release/closed-beta-operator-runbook.md";

const observability = read(observabilityDoc);
const betaReadiness = read(betaReadinessDoc);
const goNoGo = read(goNoGoDoc);
const operatorRunbook = read(operatorRunbookDoc);

for (const snippet of [
  "Do not capture secrets, bearer tokens, passwords, service keys, cookies, or private document paths when debugging.",
  "API request logs include:",
  "`requestId`",
  "`method`",
  "`path`",
  "`statusCode`",
  "`durationMs`",
  "The active closed-beta blocker is fresh installed-device create-request proof after the deployed backend fix.",
  "approved iOS internal/TestFlight build or recovered Android install",
  "Do not capture Authorization headers, bearer tokens, refresh tokens, Supabase keys, or raw request bodies.",
  "Before inviting outside testers, reverify the live VM Fastify logger configuration redacts authorization, cookie, token-like, password-like, and private document path fields."
]) {
  requireSnippet(observabilityDoc, observability, snippet);
}

requireSnippet(betaReadinessDoc, betaReadiness, "VM API logger redaction should be reverified on `/home/nurseapp/nursebridge` before inviting outside testers.");
requireSnippet(goNoGoDoc, goNoGo, "API logs expose bearer tokens, cookies, passwords, service keys, raw private medical details, or uploaded document contents.");
requireSnippet(operatorRunbookDoc, operatorRunbook, "Do not capture tokens, cookies, service keys, raw request bodies, passwords, or private document paths.");

console.log("API log hygiene verification passed.");
