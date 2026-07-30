#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const SERVER_MANAGED_REQUIRED_FIELDS = new Set(["id", "created_at", "updated_at"]);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  fail("Missing SUPABASE_URL and Supabase API key env. Load /etc/nursebridge/api.env before running.");
}

let buildCreateJobPayload;
try {
  ({ buildCreateJobPayload } = await import("../../services/api/dist/jobPayload.js"));
} catch (error) {
  fail(`Unable to import built API job payload module. Run pnpm --filter @nursebridge/api build first. ${error.message}`);
}

const samplePayload = buildCreateJobPayload("00000000-0000-0000-0000-000000000001", {
  title: "Contract check request",
  description: "",
  address: "",
  start_time: undefined,
  hourly_rate: undefined
});
const insertPayloadFields = new Set(Object.keys(samplePayload));

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
const jobs = spec?.definitions?.jobs || spec?.components?.schemas?.jobs;

if (!jobs?.properties) {
  fail("Supabase REST schema metadata did not include a jobs table definition.");
}

const required = new Set(jobs.required || []);
const properties = new Set(Object.keys(jobs.properties || {}));
const unmanagedRequired = [...required].filter((field) => !SERVER_MANAGED_REQUIRED_FIELDS.has(field));
const missingFromPayload = unmanagedRequired.filter((field) => !insertPayloadFields.has(field));
const payloadMissingLiveColumns = [...insertPayloadFields].filter((field) => !properties.has(field));

console.log("Create-job contract check");
console.log(`Live jobs required fields: ${[...required].sort().join(", ") || "(none)"}`);
console.log(`API insert payload fields: ${[...insertPayloadFields].sort().join(", ")}`);
console.log(`Server-managed required fields: ${[...SERVER_MANAGED_REQUIRED_FIELDS].sort().join(", ")}`);

if (payloadMissingLiveColumns.length > 0) {
  fail(`API create-job payload references columns missing from live jobs schema: ${payloadMissingLiveColumns.sort().join(", ")}`);
}

if (missingFromPayload.length > 0) {
  fail(`Live jobs schema has unmanaged required columns missing from create-job payload: ${missingFromPayload.sort().join(", ")}`);
}

console.log("Result: create-job insert payload satisfies live jobs required-column contract.");
