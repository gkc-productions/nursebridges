import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { describe, it } from "node:test";

function runChecker() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/ops/check-beta-gates.mjs"], {
      cwd: process.cwd(),
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

describe("beta gate checker", () => {
  it("keeps the closed-beta no-go decision and proof gates explicit", async () => {
    const result = await runChecker();

    assert.equal(result.code, 0);
    assert.match(result.stdout, /Beta gate verification passed\./);
    assert.equal(result.stderr, "");
  });
});
