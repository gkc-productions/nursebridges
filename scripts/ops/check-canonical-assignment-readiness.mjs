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
    fail(`${doc} is missing canonical assignment snippet: ${snippet}`);
  }
}

function forbidSnippet(doc, text, snippet) {
  if (text.includes(snippet)) {
    fail(`${doc} contains stale canonical assignment language: ${snippet}`);
  }
}

const dataContractDoc = "docs/architecture/data-contract.md";
const workflowDoc = "docs/architecture/workflow-source-of-truth.md";
const supabaseContractDoc = "docs/ops/supabase-data-contract-verification.md";
const assignmentPlanDoc = "docs/ops/assignment-rpc-rollout-plan.md";
const betaReadinessDoc = "docs/release/beta-readiness.md";
const assignmentSqlDoc = "docs/architecture/sql/assignment-finalize-rpc.draft.sql";
const assignmentGuardDoc = "scripts/ops/check-assignment-rpc-contract.mjs";
const apiAssignmentDoc = "services/api/src/jobAssignmentCommand.ts";
const adminAssignmentDoc = "apps/admin/lib/jobAssignmentActionsCore.ts";
const adminDashboardDoc = "apps/admin/lib/adminDashboardData.ts";

const dataContract = read(dataContractDoc);
const workflow = read(workflowDoc);
const supabaseContract = read(supabaseContractDoc);
const assignmentPlan = read(assignmentPlanDoc);
const betaReadiness = read(betaReadinessDoc);
const assignmentSql = read(assignmentSqlDoc);
const assignmentGuard = read(assignmentGuardDoc);
const apiAssignment = read(apiAssignmentDoc);
const adminAssignment = read(adminAssignmentDoc);
const adminDashboard = read(adminDashboardDoc);

for (const snippet of [
  "production canonical field: `jobs.assigned_nurse_user_id`",
  "supporting evidence: exactly one accepted application for the assigned nurse/caregiver",
  "compatibility-only reads may derive assignment from accepted applications until the RPC-backed API/admin rollout is complete",
  "Client-provided assignment fields.",
  "Accepted application state as the only production assignment source after RPC-backed assignment is enabled."
]) {
  requireSnippet(dataContractDoc, dataContract, snippet);
}

for (const snippet of [
  "`jobs.assigned_nurse_user_id` is the intended canonical assignment field for production writes.",
  "Exactly one accepted application for the assigned nurse/caregiver is supporting evidence and compatibility state, not the production source of truth.",
  "The production canonical assignment column is `jobs.assigned_nurse_user_id`.",
  "read path that derives assignment only from accepted applications should be treated as temporary",
  "Reverify that live Supabase exposes `jobs.assigned_nurse_user_id`"
]) {
  requireSnippet(workflowDoc, workflow, snippet);
}

for (const snippet of [
  "canonical field: `jobs.assigned_nurse_user_id`",
  "supporting evidence: exactly one accepted application for the assigned nurse/caregiver",
  "Reverify `jobs.assigned_nurse_user_id` exists in live Supabase.",
  "Treat accepted application state as supporting evidence, not a second production source of truth.",
  "Treat any accepted-application-only read path as compatibility-only until it is reconciled."
]) {
  requireSnippet(supabaseContractDoc, supabaseContract, snippet);
}

for (const snippet of [
  "`jobs.assigned_nurse_user_id` exists and is the canonical assignment field",
  "set job assigned and canonical assigned nurse field"
]) {
  requireSnippet(assignmentPlanDoc, assignmentPlan, snippet);
}

forbidSnippet(assignmentPlanDoc, assignmentPlan, "Confirm the canonical assignment field is `jobs.assigned_nurse_user_id`.");

for (const snippet of [
  "Production canonical assignment field is documented as `jobs.assigned_nurse_user_id`.",
  "Reverify live Supabase exposes `jobs.assigned_nurse_user_id` before RPC apply."
]) {
  requireSnippet(betaReadinessDoc, betaReadiness, snippet);
}

for (const snippet of [
  "assigned_nurse_user_id = p_selected_nurse_user_id",
  "p_selected_nurse_user_id uuid"
]) {
  requireSnippet(assignmentSqlDoc, assignmentSql, snippet);
}

requireSnippet(assignmentGuardDoc, assignmentGuard, 'jobs: ["id", "status", "title", "assigned_nurse_user_id"]');
requireSnippet(apiAssignmentDoc, apiAssignment, ".update({ status: \"accepted\" })");
requireSnippet(adminAssignmentDoc, adminAssignment, ".update({ status: \"assigned\", assigned_nurse_user_id: nurseId })");
requireSnippet(adminDashboardDoc, adminDashboard, ".select(\"id,status,title,description,address,start_time,hourly_rate,patient_user_id,assigned_nurse_user_id,created_at,updated_at\")");

console.log("Canonical assignment readiness verification passed.");
