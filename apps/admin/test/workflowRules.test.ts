import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAssignJob,
  canCancelJob,
  canCompleteJob,
  canSelectApplication,
  isJobStatus,
  terminalJobStatus
} from "../lib/workflowRules";

describe("workflow rules", () => {
  it("keeps assignment restricted to open jobs and applied applications", () => {
    assert.equal(canAssignJob("open"), true);
    assert.equal(canAssignJob("assigned"), false);
    assert.equal(canAssignJob("completed"), false);
    assert.equal(canAssignJob("cancelled"), false);

    assert.equal(canSelectApplication("applied"), true);
    assert.equal(canSelectApplication("accepted"), false);
    assert.equal(canSelectApplication("rejected"), false);
    assert.equal(canSelectApplication("withdrawn"), false);
  });

  it("allows terminal actions only for the current closed-beta lifecycle", () => {
    assert.equal(canCancelJob("open"), true);
    assert.equal(canCancelJob("assigned"), true);
    assert.equal(canCancelJob("completed"), false);
    assert.equal(canCancelJob("cancelled"), false);

    assert.equal(canCompleteJob("assigned", true), true);
    assert.equal(canCompleteJob("assigned", false), false);
    assert.equal(canCompleteJob("open", true), false);
    assert.equal(canCompleteJob("completed", true), false);
  });

  it("identifies canonical and terminal job statuses", () => {
    assert.equal(isJobStatus("open"), true);
    assert.equal(isJobStatus("assigned"), true);
    assert.equal(isJobStatus("completed"), true);
    assert.equal(isJobStatus("cancelled"), true);
    assert.equal(isJobStatus("pending_dispatch"), false);

    assert.equal(terminalJobStatus("completed"), true);
    assert.equal(terminalJobStatus("cancelled"), true);
    assert.equal(terminalJobStatus("assigned"), false);
  });
});
