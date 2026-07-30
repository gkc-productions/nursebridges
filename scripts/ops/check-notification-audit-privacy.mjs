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
    fail(`${doc} is missing notification/audit privacy snippet: ${snippet}`);
  }
}

function forbidSnippet(doc, text, snippet) {
  if (text.includes(snippet)) {
    fail(`${doc} leaks notification/audit private detail: ${snippet}`);
  }
}

const sharedWorkflowDoc = "packages/shared/src/workflow.ts";
const assignmentRpcDoc = "docs/architecture/sql/assignment-finalize-rpc.draft.sql";
const terminalRpcDoc = "docs/architecture/sql/terminal-job-finalize-rpc.draft.sql";
const adminDataDoc = "apps/admin/lib/adminDashboardData.ts";
const adminPageDoc = "apps/admin/app/page.tsx";
const evidenceTemplateDoc = "docs/release/beta-evidence-templates.md";
const evidenceLogDoc = "docs/release/beta-evidence-log.md";

const sharedWorkflow = read(sharedWorkflowDoc);
const assignmentRpc = read(assignmentRpcDoc);
const terminalRpc = read(terminalRpcDoc);
const adminData = read(adminDataDoc);
const adminPage = read(adminPageDoc);
const evidenceTemplate = read(evidenceTemplateDoc);
const evidenceLog = read(evidenceLogDoc);

for (const snippet of [
  'title: "Care request assigned"',
  'body: "A care request has been assigned to you."',
  'body: "A care request was assigned to another nurse or caregiver."',
  'const notificationTitle = input.status === "cancelled" ? "Care request cancelled" : "Care request completed";',
  "const body = `A care request is now ${input.status}.`;"
]) {
  requireSnippet(sharedWorkflowDoc, sharedWorkflow, snippet);
}

for (const forbidden of [
  'const jobTitle = input.jobTitle',
  'title: "Job assigned"',
  'title: "Job cancelled"',
  'title: "Job completed"',
  "`${jobTitle} has been assigned to you.`",
  "`${jobTitle} was assigned to another nurse.`",
  "`${jobTitle} is now ${input.status}.`"
]) {
  forbidSnippet(sharedWorkflowDoc, sharedWorkflow, forbidden);
}

for (const snippet of [
  "'Care request assigned'",
  "'A care request has been assigned to you.'",
  "'A care request was assigned to another nurse or caregiver.'"
]) {
  requireSnippet(assignmentRpcDoc, assignmentRpc, snippet);
}

for (const snippet of [
  "'Care request cancelled'",
  "'Care request completed'",
  "v_notification_body := 'A care request is now ' || p_next_status || '.';"
]) {
  requireSnippet(terminalRpcDoc, terminalRpc, snippet);
}

for (const doc of [assignmentRpcDoc, terminalRpcDoc]) {
  const text = doc === assignmentRpcDoc ? assignmentRpc : terminalRpc;
  for (const forbidden of [
    "coalesce(v_job.title",
    "v_job.title ||",
    "'Job assigned'",
    "'Job cancelled'",
    "'Job completed'"
  ]) {
    forbidSnippet(doc, text, forbidden);
  }
}

const auditRowMatch = adminData.match(/export type AdminAuditRow = \{[\s\S]*?\n\};/);
if (!auditRowMatch) {
  fail(`${adminDataDoc} is missing AdminAuditRow`);
}

for (const snippet of [
  "action: string;",
  "entity_type: string;",
  "entity_id: string | null;",
  ".select(\"id,action,entity_type,entity_id,actor_id,created_at\")"
]) {
  requireSnippet(adminDataDoc, adminData, snippet);
}

forbidSnippet(adminDataDoc, auditRowMatch[0], "metadata");
forbidSnippet(adminDataDoc, adminData, ".select(\"id,action,entity_type,entity_id,actor_id,created_at,metadata\")");

forbidSnippet(adminPageDoc, adminPage, "event.metadata");

for (const snippet of [
  "Do not paste secrets, bearer tokens, cookies, passwords, service keys, private medical details, private document paths, or raw uploaded document contents.",
  "## Notification Evidence",
  "Notification title/body safe summary:"
]) {
  requireSnippet(evidenceTemplateDoc, evidenceTemplate, snippet);
}

for (const snippet of [
  "Do not paste secrets, bearer tokens, cookies, passwords, service keys, private document paths, or raw medical details."
]) {
  requireSnippet(evidenceLogDoc, evidenceLog, snippet);
}

console.log("Notification and audit privacy verification passed.");
