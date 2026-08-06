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
    assert.match(result.stdout, /NurseBridges Build Status/);
    assert.match(result.stdout, /NO-GO for outside testers/);
    assert.match(result.stdout, /Staged package\s+131 files/);
    assert.match(result.stdout, /iPhone workflow\s+patient create -> nurse apply -> admin assign -> nurse complete proven/);
    assert.match(result.stdout, /Android\s+adb installed, no authorized device visible/);
    assert.match(result.stdout, /iPhone\s+signing, installed build, and TestFlight download path proven/);
    assert.match(result.stdout, /Patient release\s+new onboarding\/home\/request UX needs signed build verification/);
    assert.match(result.stdout, /apply the reviewed patient-access migration and deploy its API route/);
  });
});
