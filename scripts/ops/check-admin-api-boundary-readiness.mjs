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
    fail(`${doc} is missing admin/API boundary snippet: ${snippet}`);
  }
}

const workflowDoc = "docs/architecture/workflow-source-of-truth.md";
const productionDoc = "docs/architecture/production-architecture.md";
const betaReadinessDoc = "docs/release/beta-readiness.md";
const assignmentPlanDoc = "docs/ops/assignment-rpc-rollout-plan.md";
const terminalPlanDoc = "docs/ops/terminal-job-rpc-rollout-plan.md";
const currentStatusDoc = "docs/release/current-build-status.md";
const adminAssignRouteDoc = "apps/admin/app/api/admin/jobs/assign/route.ts";
const adminTerminalRouteDoc = "apps/admin/app/api/admin/jobs/[id]/route.ts";
const adminVerificationRouteDoc = "apps/admin/app/api/admin/nurses/verify/route.ts";
const adminAssignmentCoreDoc = "apps/admin/lib/jobAssignmentActionsCore.ts";
const adminTerminalCoreDoc = "apps/admin/lib/jobTerminalActionsCore.ts";
const apiAssignmentRouteDoc = "services/api/src/routes/adminAssignmentRoute.ts";
const apiTerminalRouteDoc = "services/api/src/routes/jobTerminalRoute.ts";

const workflow = read(workflowDoc);
const production = read(productionDoc);
const betaReadiness = read(betaReadinessDoc);
const assignmentPlan = read(assignmentPlanDoc);
const terminalPlan = read(terminalPlanDoc);
const currentStatus = read(currentStatusDoc);
const adminAssignRoute = read(adminAssignRouteDoc);
const adminTerminalRoute = read(adminTerminalRouteDoc);
const adminVerificationRoute = read(adminVerificationRouteDoc);
const adminAssignmentCore = read(adminAssignmentCoreDoc);
const adminTerminalCore = read(adminTerminalCoreDoc);
const apiAssignmentRoute = read(apiAssignmentRouteDoc);
const apiTerminalRoute = read(apiTerminalRouteDoc);

for (const snippet of [
  "same RPC-backed finalizer contract used by API routes",
  "Admin verification can remain admin-server-only because it is not a patient/nurse lifecycle transition.",
  "uses the same RPC-backed assignment and terminal finalizer contracts as API",
  "keeps admin-only verification server-side with matching audit/notification rules",
  "Do not begin broad consolidation while installed-device create-request proof is still missing.",
  "Move admin assignment to the same RPC-backed finalizer contract as API assignment.",
  "Move admin cancel/complete to the same RPC-backed terminal finalizer contract as API terminal actions."
]) {
  requireSnippet(workflowDoc, workflow, snippet);
}

for (const snippet of [
  "Before outside-tester beta, assignment and terminal lifecycle transitions should converge on the same RPC-backed finalizer contracts used by the API.",
  "Admin-only verification may remain in the protected admin server path with audit and notification coverage."
]) {
  requireSnippet(productionDoc, production, snippet);
}

for (const snippet of [
  "Wire API/admin assignment to the RPC-backed finalizer by default.",
  "Wire API/admin cancel/complete to the RPC-backed finalizer by default.",
  "Keep admin verification admin-server-only, but keep assignment/cancel/complete on the same API/admin finalizer contracts."
]) {
  requireSnippet(betaReadinessDoc, betaReadiness, snippet);
}

for (const snippet of [
  "Update API admin assignment and patient application acceptance to use the same RPC-backed finalizer.",
  "Update admin web assignment to call the same canonical finalizer or API endpoint."
]) {
  requireSnippet(assignmentPlanDoc, assignmentPlan, snippet);
}

for (const snippet of [
  "Update API patient/nurse terminal routes and admin web terminal actions to use the same RPC-backed finalizer."
]) {
  requireSnippet(terminalPlanDoc, terminalPlan, snippet);
}

for (const snippet of [
  "API/admin command orchestration and assignment atomicity remain open before broader beta.",
  "Full transaction/RPC-backed assignment is still required before broader beta."
]) {
  requireSnippet(currentStatusDoc, currentStatus, snippet);
}

for (const snippet of ["assignJobAsAdmin", "jobAssignmentActionsCore"]) {
  requireSnippet(adminAssignRouteDoc, adminAssignRoute, snippet);
}

for (const snippet of ["cancelJobAsAdmin", "completeJobAsAdmin"]) {
  requireSnippet(adminTerminalRouteDoc, adminTerminalRoute, snippet);
}

requireSnippet(adminVerificationRouteDoc, adminVerificationRoute, "decideNurseVerification");

for (const snippet of ["createAssignmentCommandPlan", "markJobAssigned"]) {
  requireSnippet(adminAssignmentCoreDoc, adminAssignmentCore, snippet);
}

for (const snippet of ["createCancelJobCommandPlan", "createCompleteJobCommandPlan"]) {
  requireSnippet(adminTerminalCoreDoc, adminTerminalCore, snippet);
}

for (const snippet of ["finalizeAssignment", "createAssignmentCommandPlan"]) {
  requireSnippet(apiAssignmentRouteDoc, apiAssignmentRoute, snippet);
}

for (const snippet of ["createJobTerminalActions", "createCancelJobCommandPlan", "createCompleteJobCommandPlan"]) {
  requireSnippet(apiTerminalRouteDoc, apiTerminalRoute, snippet);
}

console.log("Admin/API boundary readiness verification passed.");
