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

function sliceBetween(text, start, end) {
  const startIndex = text.indexOf(start);
  if (startIndex === -1) fail(`missing required marker: ${start}`);

  const endIndex = text.indexOf(end, startIndex + start.length);
  if (endIndex === -1) fail(`missing required marker after ${start}: ${end}`);

  return text.slice(startIndex, endIndex);
}

const app = read("apps/mobile/App.tsx");
const workflow = read("apps/mobile/src/workflow.ts");
const workflowTest = read("apps/mobile/test/workflow.test.ts");
const statusDoc = read("docs/release/current-build-status.md");

const helperBlock = sliceBetween(
  workflow,
  "export function buildWorkflowEvidenceSummary",
  "function timelineState"
);

for (const snippet of [
  "{ label: \"Role\"",
  "{ label: \"API\"",
  "{ label: \"Request ID\"",
  "{ label: \"Status\"",
  "{ label: \"Records\"",
  "{ label: \"Unread updates\"",
  "copyText: rows.map((row) => `${row.label}: ${row.value}`).join(\"\\n\")"
]) {
  if (!helperBlock.includes(snippet)) {
    fail(`workflow support snapshot helper is missing required snippet: ${snippet}`);
  }
}

for (const forbidden of ["title", "address", "description", "mobility", "contact_context", "mobility_notes"]) {
  if (helperBlock.toLowerCase().includes(forbidden)) {
    fail(`workflow support snapshot helper copies private care-context field: ${forbidden}`);
  }
}

for (const snippet of [
  "function WorkflowEvidencePanel",
  "Support snapshot",
  "await Clipboard.setStringAsync(workflowEvidence.copyText)",
  "<WorkflowSnapshotPanel snapshot={workflowSnapshot} />",
  "<WorkflowEvidencePanel rows={workflowEvidence.rows} onCopy={copyWorkflowEvidence} />"
]) {
  if (!app.includes(snippet)) {
    fail(`mobile app support snapshot surface is missing required snippet: ${snippet}`);
  }
}

if (app.indexOf("<WorkflowEvidencePanel") < app.indexOf("<WorkflowSnapshotPanel")) {
  fail("support snapshot must render after the workflow snapshot, not before it");
}

for (const snippet of [
  "builds a copyable support snapshot without care details",
  "assert.doesNotMatch(summary.copyText",
  "appointment|mobility|address|description"
]) {
  if (!workflowTest.includes(snippet)) {
    fail(`mobile workflow tests are missing support snapshot privacy proof: ${snippet}`);
  }
}

for (const snippet of [
  "copyable support snapshot",
  "avoids copying request title, address, description, mobility notes, or other care details"
]) {
  if (!statusDoc.includes(snippet)) {
    fail(`current build status is missing support snapshot release note: ${snippet}`);
  }
}

console.log("Mobile support snapshot verification passed.");
