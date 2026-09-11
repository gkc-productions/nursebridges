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
    fail(`${doc} is missing workflow-atomicity snippet: ${snippet}`);
  }
}

function forbidSnippet(doc, text, snippet) {
  if (text.includes(snippet)) {
    fail(`${doc} contains stale workflow-atomicity language: ${snippet}`);
  }
}

const assignmentPlanDoc = "docs/ops/assignment-rpc-rollout-plan.md";
const terminalPlanDoc = "docs/ops/terminal-job-rpc-rollout-plan.md";
const goNoGoDoc = "docs/release/closed-beta-go-no-go.md";
const betaReadinessDoc = "docs/release/beta-readiness.md";
const currentStatusDoc = "docs/release/current-build-status.md";
const assignmentGuardDoc = "scripts/ops/check-assignment-rpc-contract.mjs";
const terminalGuardDoc = "scripts/ops/check-terminal-job-rpc-contract.mjs";
const assignmentSqlDoc = "docs/architecture/sql/assignment-finalize-rpc.draft.sql";
const terminalSqlDoc = "docs/architecture/sql/terminal-job-finalize-rpc.draft.sql";

const assignmentPlan = read(assignmentPlanDoc);
const terminalPlan = read(terminalPlanDoc);
const goNoGo = read(goNoGoDoc);
const betaReadiness = read(betaReadinessDoc);
const currentStatus = read(currentStatusDoc);
const assignmentGuard = read(assignmentGuardDoc);
const terminalGuard = read(terminalGuardDoc);
const assignmentSql = read(assignmentSqlDoc);
const terminalSql = read(terminalSqlDoc);

for (const snippet of [
  "one atomic database operation",
  "lock the open job",
  "set job assigned and canonical assigned nurse field",
  "write in-app notifications",
  "write admin audit evidence when actor is admin",
  "Do not apply the migration to a live Supabase project until a separate owner-approved deployment step explicitly allows",
  "node scripts/ops/check-assignment-rpc-contract.mjs --expect-rpc",
  "Keep push delivery outside the transaction; in-app notification rows are the durable status channel."
]) {
  requireSnippet(assignmentPlanDoc, assignmentPlan, snippet);
}

for (const snippet of [
  "one atomic database operation",
  "lock the job row",
  "for cancellation, reject still-applied applications",
  "set the terminal job status",
  "write durable in-app notifications",
  "write admin audit evidence when actor is admin",
  "Do not apply the migration to a live Supabase project until a separate owner-approved deployment step explicitly allows",
  "node scripts/ops/check-terminal-job-rpc-contract.mjs --expect-rpc",
  "Keep push delivery outside the transaction; in-app notification rows are the durable status channel."
]) {
  requireSnippet(terminalPlanDoc, terminalPlan, snippet);
}

forbidSnippet(terminalPlanDoc, terminalPlan, 'Confirm whether notification text should continue using "Job" internally');

for (const snippet of [
  "Guarded multi-write assignment/cancel/complete is an internal engineering-proof posture, not the preferred outside-tester beta posture.",
  "Outside beta should use approved RPC-backed assignment and terminal finalization.",
  "If the owner accepts guarded multi-write for any outside tester, the exception must be written"
]) {
  requireSnippet(goNoGoDoc, goNoGo, snippet);
}

for (const snippet of [
  "## Workflow Atomicity",
  "Review-only assignment RPC design exists.",
  "Review-only terminal job RPC design exists.",
  "Read-only RPC prerequisite checks exist for assignment and terminal actions.",
  "Committed migration creates `finalize_applied_assignment_rpc` and `finalize_terminal_job_rpc`.",
  "API/admin assignment is wired to the RPC-backed finalizer by default.",
  "API/admin cancel/complete is wired to the RPC-backed finalizer by default.",
  "Apply and expose finalizer RPCs in live Supabase only during an approved deployment window.",
  "Treat guarded multi-write workflow as internal engineering proof only unless the owner signs a written outside-tester exception."
]) {
  requireSnippet(betaReadinessDoc, betaReadiness, snippet);
}

for (const snippet of [
  "API/admin command orchestration now defaults to RPC-backed assignment and terminal finalizers locally",
  "live Supabase function apply/exposure and deployment are still required before broader beta."
]) {
  requireSnippet(currentStatusDoc, currentStatus, snippet);
}

for (const snippet of [
  "const EXPECT_RPC = process.argv.includes(\"--expect-rpc\");",
  "Missing SUPABASE_URL and Supabase API key env.",
  "This script does not call the RPC, write rows, inspect row data, print credentials, or apply schema changes.",
  "Apply/refresh the approved RPC before enabling runtime integration."
]) {
  requireSnippet(assignmentGuardDoc, assignmentGuard, snippet);
  requireSnippet(terminalGuardDoc, terminalGuard, snippet);
}

for (const snippet of [
  "create or replace function public.finalize_applied_assignment_rpc",
  "security definer",
  "set search_path = public",
  "'Care request assigned'",
  "'A care request has been assigned to you.'"
]) {
  requireSnippet(assignmentSqlDoc, assignmentSql, snippet);
}

for (const snippet of [
  "create or replace function public.finalize_terminal_job_rpc",
  "security definer",
  "set search_path = public",
  "'Care request cancelled'",
  "'Care request completed'",
  "'A care request is now ' || p_next_status || '.'"
]) {
  requireSnippet(terminalSqlDoc, terminalSql, snippet);
}

console.log("Workflow atomicity readiness verification passed.");
