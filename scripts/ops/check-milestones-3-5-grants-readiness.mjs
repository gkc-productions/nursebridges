#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const migrationPath =
  "supabase/migrations/20260905033308_harden_milestones_3_5_authenticated_grants.sql";
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

function forbid(pattern, description) {
  if (pattern.test(sql)) {
    console.error(`${migrationPath} contains unsafe SQL: ${description}`);
    process.exit(1);
  }
}

requirePattern(
  /revoke all on table .*public\.nurse_availability_windows.*public\.marketplace_quality_signals from anon, authenticated/,
  "a complete anon/authenticated privilege reset for the milestone tables"
);
requirePattern(
  /alter function public\.replace_my_nurse_availability\(jsonb\) security definer/,
  "owner-privileged atomic availability writes before direct grants are removed"
);
requirePattern(
  /grant select on table public\.nurse_availability_windows to authenticated/,
  "read-only direct access to nurse availability"
);
requirePattern(
  /grant select, insert on table public\.operations_cases to authenticated/,
  "reporter support-case access"
);
requirePattern(
  /grant select, insert, update on table public\.preferred_nurses to authenticated/,
  "patient preference upsert access"
);
requirePattern(
  /grant select, insert on table public\.recurring_care_plans to authenticated/,
  "patient recurring-plan request access"
);
requirePattern(
  /grant select on table public\.care_quotes, public\.nurse_earning_records to authenticated/,
  "owner-scoped quote and earnings reads"
);

forbid(/grant\s+[^;]*\bdelete\b[^;]*\bto authenticated\b/, "authenticated delete access");
forbid(/grant\s+[^;]*\btruncate\b[^;]*\bto authenticated\b/, "authenticated truncate access");
forbid(/grant\s+[^;]*\breferences\b[^;]*\bto authenticated\b/, "authenticated references access");
forbid(/grant\s+[^;]*\btrigger\b[^;]*\bto authenticated\b/, "authenticated trigger access");
forbid(/grant\s+[^;]*public\.operations_case_presence[^;]*\bto authenticated\b/, "direct presence-table access");
forbid(/grant\s+[^;]*public\.visit_arrival_verifications[^;]*\bto authenticated\b/, "direct arrival-secret access");
forbid(/grant\s+[^;]*public\.marketplace_quality_signals[^;]*\bto authenticated\b/, "direct quality-signal access");
forbid(/grant\s+[^;]*public\.admin_team_members[^;]*\bto authenticated\b/, "direct admin-team access");

console.log("Milestones 3-5 grants readiness verification passed.");
