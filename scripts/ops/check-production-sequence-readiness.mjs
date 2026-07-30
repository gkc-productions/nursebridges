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
    fail(`${doc} is missing production sequence snippet: ${snippet}`);
  }
}

function forbidSnippet(doc, text, snippet) {
  if (text.includes(snippet)) {
    fail(`${doc} contains stale production sequence wording: ${snippet}`);
  }
}

const backlogDoc = "docs/release/implementation-backlog.md";
const productionPlanDoc = "docs/release/production-build-plan.md";
const startHereDoc = "docs/release/start-here.md";
const blueprintDoc = "docs/architecture/lead-engineering-blueprint.md";
const goNoGoDoc = "docs/release/closed-beta-go-no-go.md";

const backlog = read(backlogDoc);
const productionPlan = read(productionPlanDoc);
const startHere = read(startHereDoc);
const blueprint = read(blueprintDoc);
const goNoGo = read(goNoGoDoc);

for (const snippet of [
  "## Package NB-01: Prove Real-Device Create-Request",
  "Trigger one fresh patient create-request attempt from an installed iOS/internal build or Android app.",
  "Make assignment and terminal lifecycle transitions safe enough for outside-tester beta by converging API/admin command boundaries on RPC-backed finalizer contracts.",
  "Reconcile from the VM's full API source before touching runtime route behavior.",
  "Apply and wire `finalize_applied_assignment_rpc` after explicit owner approval.",
  "Move API/admin assignment to the same RPC-backed finalizer contract.",
  "Apply and wire `finalize_terminal_job_rpc` after explicit owner approval.",
  "Move API/admin cancel/complete to the same RPC-backed terminal finalizer contract.",
  "Guarded multi-write workflow is internal engineering proof only unless the owner signs a written outside-tester exception.",
  "NB-08 wire RPC-backed assignment/terminal finalizers and admin/API command boundary",
  "NB-08 should not distract from NB-01 while real-device create-request remains unproven, but it is the default engineering gate before outside-tester beta once the workflow proof path is available."
]) {
  requireSnippet(backlogDoc, backlog, snippet);
}

for (const snippet of [
  "Prove create-request, list requests, notifications, nurse apply, admin assign, complete, and cancel.",
  "converge assignment/cancel/complete on RPC-backed finalizer contracts before outside beta unless the owner signs a written exception.",
  "Backend create-job payload fix is deployed, but real-device create-request proof after the fix is still missing.",
  "Real-device patient create-request succeeds after the deployed backend fix.",
  "Goal: reduce lifecycle drift before outside-tester beta.",
  "Converge assignment and terminal lifecycle transitions on the same RPC-backed finalizer contracts used by Fastify API and admin server routes.",
  "Keep `jobs.assigned_nurse_user_id` as the canonical assignment representation.",
  "API/admin assignment and terminal actions use RPC-backed finalizer contracts by default."
]) {
  requireSnippet(productionPlanDoc, productionPlan, snippet);
}

for (const snippet of [
  "the next unlock is one fresh real-device patient create-request attempt.",
  "Do not start broad UI redesign before installed-device create-request proof exists."
]) {
  requireSnippet(startHereDoc, startHere, snippet);
}

for (const snippet of [
  "The next non-blocked engineering move is to continue converting the mobile app from a single mixed dashboard into role-specific workflow surfaces while preserving the current verified backend and VM gates.",
  "The next blocked-but-required proof move is to resolve installed-device access, then run one real create-request attempt and record the result."
]) {
  requireSnippet(blueprintDoc, blueprint, snippet);
}

for (const snippet of [
  "Outside beta should use approved RPC-backed assignment and terminal finalization.",
  "If the owner accepts guarded multi-write for any outside tester, the exception must be written"
]) {
  requireSnippet(goNoGoDoc, goNoGo, snippet);
}

for (const forbidden of [
  "NB-01 prove real-device create-job via installed build",
  "Do not start broad UI redesign before create-job is fixed.",
  "consolidate before broader beta or force admin through canonical API endpoints",
  "Clarify canonical assignment representation.",
  "Make assignment transactional or otherwise atomic enough for broader beta.",
  "Decide whether admin should keep server-side workflow helpers or call canonical API endpoints"
]) {
  for (const [doc, text] of [
    [backlogDoc, backlog],
    [productionPlanDoc, productionPlan],
    [startHereDoc, startHere]
  ]) {
    forbidSnippet(doc, text, forbidden);
  }
}

console.log("Production sequence readiness verification passed.");
