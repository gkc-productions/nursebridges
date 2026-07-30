import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { describe, it } from "node:test";

const requiredSchemas = {
  jobs: ["id", "status", "title", "patient_user_id"],
  applications: ["job_id", "nurse_user_id", "status", "created_at"],
  notifications: ["user_id", "type", "title", "body", "entity_type", "entity_id"],
  admin_audit_logs: ["actor_id", "action", "entity_type", "entity_id", "metadata"]
};

function schema(columns) {
  return {
    type: "object",
    properties: Object.fromEntries(columns.map((column) => [column, { type: "string" }]))
  };
}

function spec({ includeRpc = false, missingColumn = null } = {}) {
  const schemas = {};
  for (const [table, columns] of Object.entries(requiredSchemas)) {
    schemas[table] = schema(columns.filter((column) => `${table}.${column}` !== missingColumn));
  }

  return {
    openapi: "3.0.0",
    components: { schemas },
    paths: includeRpc ? { "/rpc/finalize_terminal_job_rpc": { post: {} } } : {}
  };
}

async function withServer(payload, callback) {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function runChecker(url, args = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/ops/check-terminal-job-rpc-contract.mjs", ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SUPABASE_URL: url,
        SUPABASE_SERVICE_ROLE_KEY: "test-service-key"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

describe("terminal job RPC contract checker", () => {
  it("allows a missing RPC in prerequisite mode", async () => {
    await withServer(spec(), async (url) => {
      const result = await runChecker(url);

      assert.equal(result.code, 0);
      assert.match(result.stdout, /RPC status: \/rpc\/finalize_terminal_job_rpc is not exposed yet/);
      assert.doesNotMatch(result.stdout, /test-service-key/);
      assert.equal(result.stderr, "");
    });
  });

  it("requires the RPC in strict post-apply mode", async () => {
    await withServer(spec(), async (url) => {
      const result = await runChecker(url, ["--expect-rpc"]);

      assert.equal(result.code, 1);
      assert.match(result.stderr, /missing \/rpc\/finalize_terminal_job_rpc/);
    });
  });

  it("fails when a required terminal job column is missing", async () => {
    await withServer(spec({ includeRpc: true, missingColumn: "applications.created_at" }), async (url) => {
      const result = await runChecker(url, ["--expect-rpc"]);

      assert.equal(result.code, 1);
      assert.match(result.stderr, /applications\.created_at/);
    });
  });
});
