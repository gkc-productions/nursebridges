import assert from "node:assert/strict";
import test from "node:test";
import { patientRatingSignal, reportTimelinessSignal } from "../src/qualitySignals";

test("low patient ratings open service recovery", () => {
  assert.deepEqual(patientRatingSignal(1), { signalType: "patient_rating", severity: "critical", needsServiceRecovery: true });
  assert.equal(patientRatingSignal(3).needsServiceRecovery, false);
  assert.equal(patientRatingSignal(5).severity, "info");
});

test("late reports are flagged without changing clinical content", () => {
  assert.deepEqual(reportTimelinessSignal("2026-08-16T13:00:00.000Z", "2026-08-15T12:00:00.000Z"), { minutes: 1500, severity: "attention" });
});
