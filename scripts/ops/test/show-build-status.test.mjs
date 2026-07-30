import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { describe, it } from "node:test";

function runStatus() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/ops/show-build-status.mjs"], {
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

describe("quick build status command", () => {
  it("summarizes the production track, blockers, and next commands", async () => {
    const result = await runStatus();

    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /NurseBridge Build Status/);
    assert.match(result.stdout, /NO-GO for outside testers/);
    assert.match(result.stdout, /Staged package\s+131 files/);
    assert.match(result.stdout, /Create request proof\s+missing from a real installed phone/);
    assert.match(result.stdout, /Android\s+adb installed, no authorized device visible/);
    assert.match(result.stdout, /iPhone\s+visible to Xcode, missing provisioning profile/);
    assert.match(result.stdout, /capture one patient create-request proof against https:\/\/api\.nursebridges\.com/);
  });
});
