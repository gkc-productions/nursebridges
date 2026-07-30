import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { once } from "node:events";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../../..");
const scriptPath = path.join(root, "scripts/ops/smoke-beta-workflow.sh");
const nodeBinDir = path.dirname(process.execPath);

function startMockApi() {
  const server = http.createServer((req, res) => {
    const token = String(req.headers.authorization ?? "").replace(/^Bearer /, "");
    const requestId = `test-${req.method}-${String(req.url).replace(/\W+/g, "-")}`;

    res.setHeader("content-type", "application/json");
    res.setHeader("x-request-id", requestId);

    if (req.url === "/health") {
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.url === "/me") {
      const profiles = {
        patient: { role: "patient", userId: "patient-user" },
        nurse: { role: "nurse", userId: "nurse-user" },
        admin: { role: "admin", userId: "admin-user" }
      };

      if (profiles[token]) {
        res.end(JSON.stringify(profiles[token]));
        return;
      }

      res.statusCode = 401;
      res.end(JSON.stringify({ error: "Invalid token" }));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Not found" }));
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}

function runSmoke(args, env) {
  const child = spawn(scriptPath, args, {
    cwd: root,
    env: { ...process.env, PATH: `${nodeBinDir}:${process.env.PATH ?? ""}`, ...env },
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

  return once(child, "close").then(([code]) => ({ code, stdout, stderr }));
}

test("smoke preflight is non-mutating and prints support-ready request IDs", async () => {
  const server = await startMockApi();

  try {
    const address = server.address();
    assert(address && typeof address === "object");

    const result = await runSmoke(["--preflight"], {
      API_BASE_URL: `http://127.0.0.1:${address.port}/`,
      PATIENT_TOKEN: "patient",
      NURSE_TOKEN: "nurse",
      ADMIN_TOKEN: "admin"
    });

    assert.equal(result.code, 0);
    assert.match(result.stdout, /Smoke preflight passed\./);
    assert.match(result.stdout, /Roles: patient\/nurse\/admin/);
    assert.match(result.stderr, /Request ok: GET \/health -> 200 requestId=test-GET--health/);
    assert.match(result.stderr, /Request ok: GET \/me -> 200 requestId=test-GET--me/);
    assert.doesNotMatch(result.stderr, /patient|nurse|admin.*Token|Bearer/i);
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("mutating production smoke is blocked without explicit approval", async () => {
  const result = await runSmoke([], {
    API_BASE_URL: "https://api.nursebridges.com",
    PATIENT_TOKEN: "patient",
    NURSE_TOKEN: "nurse",
    ADMIN_TOKEN: "admin"
  });

  assert.equal(result.code, 3);
  assert.match(result.stderr, /Refusing to run a mutating smoke test against production/);
});
