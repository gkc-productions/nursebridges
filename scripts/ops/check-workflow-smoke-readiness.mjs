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
    fail(`${doc} is missing workflow-smoke readiness snippet: ${snippet}`);
  }
}

const smokeScript = "scripts/ops/smoke-beta-workflow.sh";
const smokeTest = "scripts/ops/test/smoke-beta-workflow.test.mjs";
const operatorRunbookDoc = "docs/release/closed-beta-operator-runbook.md";
const readinessDoc = "docs/release/beta-readiness.md";
const matrixDoc = "docs/release/beta-verification-matrix.md";
const templatesDoc = "docs/release/beta-evidence-templates.md";
const goNoGoDoc = "docs/release/closed-beta-go-no-go.md";

const script = read(smokeScript);
const test = read(smokeTest);
const operatorRunbook = read(operatorRunbookDoc);
const readiness = read(readinessDoc);
const matrix = read(matrixDoc);
const templates = read(templatesDoc);
const goNoGo = read(goNoGoDoc);

for (const snippet of [
  "PREFLIGHT_ONLY=0",
  "\"--preflight\")",
  "non-mutating and checks API reachability plus patient/nurse/admin token roles.",
  "PATIENT_TOKEN",
  "NURSE_TOKEN",
  "ADMIN_TOKEN",
  "ALLOW_PRODUCTION_SMOKE",
  "Refusing to run a mutating smoke test against production.",
  "api_request_public GET \"/health\"",
  "api_request \"${PATIENT_TOKEN}\" GET \"/me\"",
  "api_request \"${NURSE_TOKEN}\" GET \"/me\"",
  "api_request \"${ADMIN_TOKEN}\" GET \"/me\"",
  "Expected patient/nurse/admin tokens",
  "No care requests were created or mutated.",
  "requestId=${request_id:-unknown}",
  "api_request \"${PATIENT_TOKEN}\" POST \"/jobs\"",
  "api_request \"${NURSE_TOKEN}\" POST \"/jobs/${job_id}/apply\"",
  "api_request_expect_status \"${NURSE_TOKEN}\" PATCH \"/jobs/${job_id}/complete\" \"400\"",
  "api_request \"${ADMIN_TOKEN}\" POST \"/admin/jobs/assign\"",
  "api_request \"${NURSE_TOKEN}\" PATCH \"/jobs/${job_id}/complete\"",
  "assert_application_status \"${nurse_applications}\" \"${job_id}\" \"accepted\"",
  "api_request_expect_status \"${PATIENT_TOKEN}\" PATCH \"/jobs/${job_id}/cancel\" \"400\"",
  "api_request_expect_status \"${NURSE_TOKEN}\" PATCH \"/jobs/${cancel_job_id}/cancel\" \"403\"",
  "api_request \"${PATIENT_TOKEN}\" PATCH \"/jobs/${cancel_job_id}/cancel\"",
  "api_request_expect_status \"${NURSE_TOKEN}\" PATCH \"/jobs/${cancel_job_id}/complete\" \"400\"",
  "api_request_expect_status \"${NURSE_TOKEN}\" POST \"/jobs/${cancel_job_id}/apply\" \"400\"",
  "assert_application_status \"${nurse_applications}\" \"${cancel_job_id}\" \"rejected\""
]) {
  requireSnippet(smokeScript, script, snippet);
}

for (const snippet of [
  "smoke preflight is non-mutating",
  "prints support-ready request IDs",
  "mutating production smoke is blocked without explicit approval",
  "assert.doesNotMatch(result.stderr, /patient|nurse|admin.*Token|Bearer/i)"
]) {
  requireSnippet(smokeTest, test, snippet);
}

for (const snippet of [
  "## Step 3: Run Controlled Workflow Smoke",
  "Only run this after create-job works and after explicit approval if the target is production.",
  "Non-mutating preflight:",
  "scripts/ops/smoke-beta-workflow.sh --preflight",
  "ALLOW_PRODUCTION_SMOKE=1",
  "Save the terminal output from the approved smoke run.",
  "without exposing tokens or private care details",
  "patient create",
  "nurse apply",
  "admin assign",
  "nurse complete",
  "pending application rejected on cancellation"
]) {
  requireSnippet(operatorRunbookDoc, operatorRunbook, snippet);
}

for (const snippet of [
  "Run `scripts/ops/smoke-beta-workflow.sh` with approved patient, nurse, and admin test tokens.",
  "Production smoke runs require `ALLOW_PRODUCTION_SMOKE=1`.",
  "patient create, nurse apply, pre-assignment complete rejection, admin assign, nurse complete",
  "wrong-role nurse cancellation rejection"
]) {
  requireSnippet(readinessDoc, readiness, snippet);
}

for (const snippet of [
  "Gate 2 | Completion workflow works through API | Approved smoke: patient create, nurse apply, admin assign, nurse complete | Workflow smoke evidence",
  "Gate 2 | Cancellation workflow works through API | Approved smoke: patient/admin cancel, pending apps rejected, terminal guards pass | Workflow smoke evidence",
  "Gate 2 | Wrong-role/invalid transition guards work | Smoke or targeted tests return expected `400`, `403`, or `409` | Workflow smoke evidence",
  "Workflow smoke evidence showing completion and cancellation paths."
]) {
  requireSnippet(matrixDoc, matrix, snippet);
}

for (const snippet of [
  "## Workflow Smoke Evidence",
  "Approval reference for mutating smoke:",
  "Patient account label:",
  "Nurse account label:",
  "Admin account label:",
  "Request IDs captured:",
  "Result: Pass/Fail"
]) {
  requireSnippet(templatesDoc, templates, snippet);
}

for (const snippet of [
  "Full patient -> nurse -> admin -> terminal outcome proof is still missing.",
  "Admin sees the applicant and assigns safely.",
  "Assigned nurse or patient completes the request.",
  "Cancellation path is proven and rejects pending applications."
]) {
  requireSnippet(goNoGoDoc, goNoGo, snippet);
}

console.log("Workflow smoke readiness verification passed.");
