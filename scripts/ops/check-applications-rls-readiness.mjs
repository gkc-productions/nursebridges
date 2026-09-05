#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const migrationPath =
  "supabase/migrations/20260905020527_harden_applications_withdrawal_policy.sql";
const sql = fs
  .readFileSync(path.join(process.cwd(), migrationPath), "utf8")
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

function requirePattern(pattern, description) {
  if (!pattern.test(sql)) {
    console.error(`${migrationPath} is missing: ${description}`);
    process.exit(1);
  }
}

function forbid(text, description) {
  if (sql.includes(text)) {
    console.error(`${migrationPath} contains unsafe SQL: ${description}`);
    process.exit(1);
  }
}

requirePattern(
  /drop policy if exists applications_update_related on public\.applications/,
  "removal of the historical broad update policy"
);
requirePattern(
  /create policy applications_update_nurse_withdrawal on public\.applications for update to authenticated/,
  "an authenticated withdrawal-only update policy"
);
requirePattern(
  /using \( nurse_user_id = \(select auth\.uid\(\)\) and status = 'applied'::public\.application_status \)/,
  "ownership and current-status checks"
);
requirePattern(
  /with check \( nurse_user_id = \(select auth\.uid\(\)\) and status = 'withdrawn'::public\.application_status \)/,
  "ownership and destination-status checks"
);
requirePattern(
  /revoke update on table public\.applications from authenticated/,
  "removal of broad authenticated column updates"
);
requirePattern(
  /grant update \(status\) on table public\.applications to authenticated/,
  "status-only authenticated update permission"
);
forbid("with check (true)", "an always-true update check");
forbid("grant update on table public.applications to authenticated", "a broad update grant");

console.log("Applications RLS readiness verification passed.");
