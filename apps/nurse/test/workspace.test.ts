import assert from "node:assert/strict";
import test from "node:test";
import { defaultAvailabilityWindow, groupAssignedJobs, nextVisitCheckpoint, nurseReadiness, partitionNurseJobs, validateAvailabilityWindow } from "../src/workspace";

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

test("availability windows reject past, reversed, and overlapping ranges", () => {
  const now = new Date("2026-08-21T12:00:00.000Z").getTime();
  const existing = [{ starts_at: "2026-08-21T14:00:00.000Z", ends_at: "2026-08-21T18:00:00.000Z", timezone: "America/New_York", recurrence: "none" as const }];
  assert.equal(validateAvailabilityWindow({ ...existing[0], starts_at: "2026-08-21T11:00:00.000Z" }, [], now), "Availability cannot start in the past.");
  assert.equal(validateAvailabilityWindow({ ...existing[0], ends_at: "2026-08-21T13:00:00.000Z" }, [], now), "End time must be after start time.");
  assert.equal(validateAvailabilityWindow({ ...existing[0], starts_at: "2026-08-21T17:00:00.000Z", ends_at: "2026-08-21T19:00:00.000Z" }, existing, now), "This window overlaps existing availability.");
  assert.equal(validateAvailabilityWindow({ ...existing[0], starts_at: "2026-08-21T18:00:00.000Z", ends_at: "2026-08-21T20:00:00.000Z" }, existing, now), null);
});

test("default availability starts on a future quarter hour for four hours", () => {
  const window = defaultAvailabilityWindow(new Date("2026-08-21T12:07:23.000Z"));
  assert.equal(window.start.toISOString(), "2026-08-21T12:15:00.000Z");
  assert.equal(window.end.toISOString(), "2026-08-21T16:15:00.000Z");
});

test("assigned visits are grouped into today, upcoming, and scheduling attention", () => {
  const groups = groupAssignedJobs([
    { id: "today", start_time: "2026-08-21T15:00:00.000Z" },
    { id: "upcoming", start_time: "2026-08-23T15:00:00.000Z" },
    { id: "missing", start_time: null },
    { id: "past", start_time: "2026-08-20T15:00:00.000Z" }
  ], new Date("2026-08-21T12:00:00.000Z"));
  assert.deepEqual(groups.today.map((job) => job.id), ["today"]);
  assert.deepEqual(groups.upcoming.map((job) => job.id), ["upcoming"]);
  assert.deepEqual(groups.needsScheduling.map((job) => job.id), ["past", "missing"]);
});
