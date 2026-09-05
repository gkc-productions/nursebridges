import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { describe, it } from "node:test";

function runChecker() {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ["scripts/ops/check-milestones-3-5-grants-readiness.mjs"],
      { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] }
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

describe("Milestones 3-5 grants readiness checker", () => {
  it("keeps direct clients on the least-privilege milestone surface", async () => {
    const result = await runChecker();

    assert.equal(result.code, 0);
    assert.match(
      result.stdout,
      /Milestones 3-5 grants readiness verification passed\./
    );
    assert.equal(result.stderr, "");
  });
});
