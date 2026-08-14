import assert from "node:assert/strict";
import test from "node:test";
import { nextVisitCheckpoint, nurseReadiness, partitionNurseJobs } from "../src/workspace";

test("nurse readiness never exposes opportunities before approval", () => {
  assert.deepEqual(nurseReadiness(null), { ready: false, next: "profile" });
  assert.deepEqual(nurseReadiness({ verification_status: "pending", onboarding_step: "review" }), { ready: false, next: "review" });
  assert.deepEqual(nurseReadiness({ verification_status: "approved", onboarding_step: "complete" }), { ready: true, next: "opportunities" });
});

test("visit checkpoints advance in the required safety order", () => {
  assert.equal(nextVisitCheckpoint([]), "pre_visit_confirmed");
  assert.equal(nextVisitCheckpoint([{ event_type: "pre_visit_confirmed" }, { event_type: "en_route" }]), "arrived");
});

test("nurse jobs are separated into opportunities and assigned schedule", () => {
  const result = partitionNurseJobs([
    { id: "open", status: "open" },
    { id: "mine", status: "assigned", assigned_nurse_user_id: "nurse" },
    { id: "other", status: "assigned", assigned_nurse_user_id: "other" },
    { id: "done", status: "completed", assigned_nurse_user_id: "nurse" }
  ], "nurse");
  assert.deepEqual(result.opportunities.map((job) => job.id), ["open"]);
  assert.deepEqual(result.assigned.map((job) => job.id), ["mine"]);
});
