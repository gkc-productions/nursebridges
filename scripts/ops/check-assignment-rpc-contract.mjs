#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const EXPECT_RPC = process.argv.includes("--expect-rpc");

const REQUIRED_TABLE_COLUMNS = {
  jobs: ["id", "status", "title", "assigned_nurse_user_id"],
  applications: ["id", "job_id", "nurse_user_id", "status"],
  nurse_profiles: ["nurse_id", "verification_status"],
  notifications: ["user_id", "type", "title", "body", "entity_type", "entity_id"],
  admin_audit_logs: ["actor_id", "action", "entity_type", "entity_id", "metadata"]
};

const RPC_NAME = "finalize_applied_assignment_rpc";
const RPC_PATH = `/rpc/${RPC_NAME}`;

function usage() {
  console.log(`Assignment RPC contract check

Read-only Supabase Data API/OpenAPI metadata check.

Usage:
  node scripts/ops/check-assignment-rpc-contract.mjs [--expect-rpc]

Environment:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY

Modes:
  default       Verify table/column prerequisites. Missing RPC is reported as pending.
  --expect-rpc Verify table/column prerequisites and fail if ${RPC_NAME} is not exposed.

This script does not call the RPC, write rows, inspect row data, print credentials, or apply schema changes.`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function tableSchema(spec, tableName) {
  return spec?.definitions?.[tableName] || spec?.components?.schemas?.[tableName] || null;
}

function pathExists(spec, pathName) {
  return Boolean(spec?.paths?.[pathName]);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  usage();
  process.exit(0);
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  fail("Missing SUPABASE_URL and Supabase API key env. Load /etc/nursebridge/api.env before running.");
}

const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
  headers: {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    Accept: "application/openapi+json"
  }
});

if (!response.ok) {
  fail(`Unable to fetch Supabase REST schema metadata: HTTP ${response.status}`);
}

const spec = await response.json();
const missingTables = [];
const missingColumns = [];

for (const [tableName, requiredColumns] of Object.entries(REQUIRED_TABLE_COLUMNS)) {
  const schema = tableSchema(spec, tableName);
  const properties = schema?.properties ?? {};

  if (!schema || !properties) {
    missingTables.push(tableName);
    continue;
  }

  for (const column of requiredColumns) {
    if (!Object.prototype.hasOwnProperty.call(properties, column)) {
      missingColumns.push(`${tableName}.${column}`);
    }
  }
}

const rpcVisible = pathExists(spec, RPC_PATH);

console.log("Assignment RPC contract check");
console.log(`Required tables checked: ${Object.keys(REQUIRED_TABLE_COLUMNS).join(", ")}`);
console.log(`Required columns checked: ${Object.values(REQUIRED_TABLE_COLUMNS).flat().length}`);
console.log(`RPC path checked: ${RPC_PATH}`);
console.log(`RPC expectation: ${EXPECT_RPC ? "required" : "pending allowed"}`);

if (missingTables.length > 0) {
  fail(`Supabase REST schema metadata is missing required tables: ${missingTables.sort().join(", ")}`);
}

if (missingColumns.length > 0) {
  fail(`Supabase REST schema metadata is missing required assignment columns: ${missingColumns.sort().join(", ")}`);
}

if (!rpcVisible) {
  if (EXPECT_RPC) {
    fail(`Supabase REST schema metadata is missing ${RPC_PATH}. Apply/refresh the approved RPC before enabling runtime integration.`);
  }

  console.log(`RPC status: ${RPC_PATH} is not exposed yet. Result: prerequisites pass; RPC apply remains pending.`);
  process.exit(0);
}

console.log(`RPC status: ${RPC_PATH} is exposed in REST schema metadata.`);
console.log("Result: assignment RPC prerequisites satisfy the read-only Supabase metadata contract.");
