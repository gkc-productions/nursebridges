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
    fail(`${doc} is missing restore-drill readiness snippet: ${snippet}`);
  }
}

const readinessDoc = "docs/release/beta-readiness.md";
const templatesDoc = "docs/release/beta-evidence-templates.md";
const playbookDoc = "docs/ops/closed-beta-ops-playbook.md";
const dataContractDoc = "docs/ops/supabase-data-contract-verification.md";
const goNoGoDoc = "docs/release/closed-beta-go-no-go.md";
const verificationMatrixDoc = "docs/release/beta-verification-matrix.md";

const readiness = read(readinessDoc);
const templates = read(templatesDoc);
const playbook = read(playbookDoc);
const dataContract = read(dataContractDoc);
const goNoGo = read(goNoGoDoc);
const verificationMatrix = read(verificationMatrixDoc);

for (const snippet of [
  "## Backups",
  "Backup and recovery runbook exists.",
  "Schema-only backup script exists.",
  "Supabase automatic backups are documented as the primary recovery option.",
  "Perform a test restore into a non-production Supabase project.",
  "Test restore into a non-production Supabase project not completed.",
  "Perform a Supabase restore drill in a test project using schema backup plus non-sensitive seed data."
]) {
  requireSnippet(readinessDoc, readiness, snippet);
}

for (const snippet of [
  "## Restore Drill Evidence",
  "Source environment:",
  "Target non-production environment:",
  "Backup artifact:",
  "Restore command/process:",
  "Schema restored: yes/no",
  "Non-sensitive seed data restored: yes/no/not applicable",
  "Verification query/result:",
  "Rollback/cleanup completed: yes/no",
  "Result: Pass/Fail"
]) {
  requireSnippet(templatesDoc, templates, snippet);
}

for (const snippet of [
  "Required entries before outside testers:",
  "Restore drill.",
  "Do not run live care request tests when nobody is watching."
]) {
  requireSnippet(playbookDoc, playbook, snippet);
}

for (const snippet of [
  "## Backup And Restore Drill",
  "Do not paste service role keys or database passwords into docs.",
  "Use a non-production Supabase project as the restore target.",
  "Use non-sensitive seed data only.",
  "Do not restore production private user data into an unmanaged project.",
  "Record the result with `## Restore Drill Evidence` in `docs/release/beta-evidence-log.md`.",
  "If `pg_dump` is unavailable, keep the restore drill blocked instead of claiming recovery readiness."
]) {
  requireSnippet(dataContractDoc, dataContract, snippet);
}

for (const snippet of [
  "Restore drill evidence is recorded for a non-production Supabase restore.",
  "Backup/restore evidence is missing."
]) {
  requireSnippet(goNoGoDoc, goNoGo, snippet);
}

for (const snippet of [
  "Gate 6 | Restore drill completed | Non-production restore drill result | Restore drill evidence",
  "Gate 6 is blocked by missing owner/access/restore/legal evidence."
]) {
  requireSnippet(verificationMatrixDoc, verificationMatrix, snippet);
}

console.log("Restore drill readiness verification passed.");
