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

function normalizeSql(text) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function requireSnippet(doc, text, snippet) {
  if (!text.includes(snippet)) {
    fail(`${doc} is missing RPC SQL safety snippet: ${snippet}`);
  }
}

function forbidSnippet(doc, text, snippet) {
  if (text.includes(snippet)) {
    fail(`${doc} contains unsafe RPC SQL snippet: ${snippet}`);
  }
}

function requireRegex(doc, text, regex, description) {
  if (!regex.test(text)) {
    fail(`${doc} is missing RPC SQL safety pattern: ${description}`);
  }
}

const assignmentSqlDoc = "docs/architecture/sql/assignment-finalize-rpc.draft.sql";
const terminalSqlDoc = "docs/architecture/sql/terminal-job-finalize-rpc.draft.sql";
const assignmentPlanDoc = "docs/ops/assignment-rpc-rollout-plan.md";
const terminalPlanDoc = "docs/ops/terminal-job-rpc-rollout-plan.md";
const assignmentGuardDoc = "scripts/ops/check-assignment-rpc-contract.mjs";
const terminalGuardDoc = "scripts/ops/check-terminal-job-rpc-contract.mjs";

const assignmentSql = read(assignmentSqlDoc);
const terminalSql = read(terminalSqlDoc);
const assignmentSqlNormalized = normalizeSql(assignmentSql);
const terminalSqlNormalized = normalizeSql(terminalSql);
const assignmentPlan = read(assignmentPlanDoc);
const terminalPlan = read(terminalPlanDoc);
const assignmentGuard = read(assignmentGuardDoc);
const terminalGuard = read(terminalGuardDoc);

for (const [doc, text] of [
  [assignmentSqlDoc, assignmentSqlNormalized],
  [terminalSqlDoc, terminalSqlNormalized]
]) {
  requireSnippet(doc, text, "language plpgsql");
  requireSnippet(doc, text, "security definer");
  requireSnippet(doc, text, "set search_path = public");
  requireSnippet(doc, text, "for update");
  requireSnippet(doc, text, "insert into public.notifications");
  requireSnippet(doc, text, "insert into public.admin_audit_logs");
  requireRegex(
    doc,
    text,
    /revoke execute on function public\.[a-z_]+\([^)]*\) from [^;]*(anon|authenticated)/,
    "execute revoked from anon/authenticated"
  );
  requireRegex(
    doc,
    text,
    /grant execute on function public\.[a-z_]+\([^)]*\) to service_role/,
    "execute granted to service_role"
  );
  requireRegex(
    doc,
    text,
    /select .* from public\.jobs .* for update/,
    "job row selected from public.jobs for update"
  );
  requireRegex(
    doc,
    text,
    /update public\.jobs .* where id = p_job_id/,
    "job row update scoped to p_job_id"
  );
}

for (const snippet of [
  "create or replace function public.finalize_applied_assignment_rpc",
  "returns table",
  "selected_application_id uuid",
  "selected_nurse_user_id uuid",
  "rejected_nurse_user_ids uuid[]",
  "assigned_nurse_user_id = p_selected_nurse_user_id",
  "raise exception using errcode = 'p0002', message = 'job_not_found'",
  "raise exception using errcode = 'p0002', message = 'application_not_found'",
  "raise exception using errcode = 'p0001', message = 'invalid_job_transition'",
  "raise exception using errcode = 'p0001', message = 'application_not_selectable'",
  "raise exception using errcode = '42501', message = 'nurse_verification_required'",
  "raise exception using errcode = '40001', message = 'assignment_conflict'",
  "'care request assigned'",
  "'a care request has been assigned to you.'",
  "'application not selected'",
  "'a care request was assigned to another nurse or caregiver.'"
]) {
  requireSnippet(assignmentSqlDoc, assignmentSqlNormalized, snippet);
}

for (const snippet of [
  "create or replace function public.finalize_terminal_job_rpc",
  "returns public.jobs",
  "p_expected_status text",
  "p_next_status text",
  "raise exception 'invalid_terminal_status' using errcode = 'p0001'",
  "raise exception 'job_not_found' using errcode = 'p0001'",
  "raise exception 'terminal_conflict' using errcode = '40001'",
  "raise exception 'invalid_job_transition' using errcode = 'p0001'",
  "raise exception 'accepted_nurse_required' using errcode = 'p0001'",
  "set status = p_next_status",
  "'care request cancelled'",
  "'care request completed'",
  "v_notification_body := 'a care request is now ' || p_next_status || '.'"
]) {
  requireSnippet(terminalSqlDoc, terminalSqlNormalized, snippet);
}

for (const [doc, text] of [
  [assignmentSqlDoc, assignmentSqlNormalized],
  [terminalSqlDoc, terminalSqlNormalized]
]) {
  forbidSnippet(doc, text, "grant execute on function public.finalize_applied_assignment_rpc(uuid, uuid, uuid, uuid, text) to anon");
  forbidSnippet(doc, text, "grant execute on function public.finalize_applied_assignment_rpc(uuid, uuid, uuid, uuid, text) to authenticated");
  forbidSnippet(doc, text, "grant execute on function public.finalize_terminal_job_rpc(uuid, uuid, text, text, text) to anon");
  forbidSnippet(doc, text, "grant execute on function public.finalize_terminal_job_rpc(uuid, uuid, text, text, text) to authenticated");
  forbidSnippet(doc, text, "coalesce(v_job.title");
}

for (const [doc, text] of [
  [assignmentPlanDoc, assignmentPlan],
  [terminalPlanDoc, terminalPlan]
]) {
  for (const snippet of [
    "Function is not granted to `anon`.",
    "Function is not granted to `authenticated`.",
    "Function is granted only to `service_role`",
    "`SECURITY DEFINER` function has an explicit `search_path`."
  ]) {
    requireSnippet(doc, text, snippet);
  }
}

for (const [doc, text] of [
  [assignmentGuardDoc, assignmentGuard],
  [terminalGuardDoc, terminalGuard]
]) {
  for (const snippet of [
    "This script does not call the RPC, write rows, inspect row data, print credentials, or apply schema changes.",
    "--expect-rpc",
    "Apply/refresh the approved RPC before enabling runtime integration."
  ]) {
    requireSnippet(doc, text, snippet);
  }
}

console.log("RPC SQL safety verification passed.");
