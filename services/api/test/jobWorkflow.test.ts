import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canApplyToJob,
  canAssignJob,
  canCancelJob,
  canCompleteJob,
  canSelectApplication,
  canWithdrawApplication,
  isTerminalJobStatus
} from "../src/jobWorkflow.ts";

describe("job workflow rules", () => {
  it("only treats completed and cancelled jobs as terminal", () => {
    assert.equal(isTerminalJobStatus("open"), false);
    assert.equal(isTerminalJobStatus("assigned"), false);
    assert.equal(isTerminalJobStatus("completed"), true);
    assert.equal(isTerminalJobStatus("cancelled"), true);
  });

  it("allows cancellation before care is completed or already cancelled", () => {
    assert.equal(canCancelJob("open"), true);
    assert.equal(canCancelJob("assigned"), true);
    assert.equal(canCancelJob("completed"), false);
    assert.equal(canCancelJob("cancelled"), false);
  });

  it("requires an assigned job with an accepted nurse before completion", () => {
    assert.equal(canCompleteJob("open", false), false);
    assert.equal(canCompleteJob("assigned", false), false);
    assert.equal(canCompleteJob("assigned", true), true);
    assert.equal(canCompleteJob("completed", true), false);
    assert.equal(canCompleteJob("cancelled", true), false);
  });

  it("only allows nurses to apply to open jobs", () => {
    assert.equal(canApplyToJob("open"), true);
    assert.equal(canApplyToJob("assigned"), false);
    assert.equal(canApplyToJob("completed"), false);
    assert.equal(canApplyToJob("cancelled"), false);
  });

  it("only allows assignment while a job is open", () => {
    assert.equal(canAssignJob("open"), true);
    assert.equal(canAssignJob("assigned"), false);
    assert.equal(canAssignJob("completed"), false);
    assert.equal(canAssignJob("cancelled"), false);
  });

  it("only allows applied applications to be selected", () => {
    assert.equal(canSelectApplication("applied"), true);
    assert.equal(canSelectApplication("accepted"), false);
    assert.equal(canSelectApplication("rejected"), false);
    assert.equal(canSelectApplication("withdrawn"), false);
  });

  it("only allows applied applications to be withdrawn", () => {
    assert.equal(canWithdrawApplication("applied"), true);
    assert.equal(canWithdrawApplication("accepted"), false);
    assert.equal(canWithdrawApplication("rejected"), false);
    assert.equal(canWithdrawApplication("withdrawn"), false);
  });
});
