import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAssignedNurseMap } from "../src/jobAssignmentView.ts";

describe("patient assignment view", () => {
  it("uses the accepted application when it is visible", () => {
    const assigned = buildAssignedNurseMap(
      [{ id: "job-1" }],
      [{ job_id: "job-1", nurse_user_id: "accepted-nurse" }]
    );

    assert.equal(assigned.get("job-1"), "accepted-nurse");
  });

  it("falls back to the assigned nurse stored on the job", () => {
    const assigned = buildAssignedNurseMap(
      [{ id: "job-1", assigned_nurse_user_id: "direct-nurse" }],
      []
    );

    assert.equal(assigned.get("job-1"), "direct-nurse");
  });
});
