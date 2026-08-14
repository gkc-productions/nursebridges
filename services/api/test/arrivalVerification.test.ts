import assert from "node:assert/strict";
import test from "node:test";
import { arrivalLockAfterFailure, createArrivalPin, hashArrivalPin, verifyArrivalPin } from "../src/arrivalVerification.js";

test("arrival PINs are always six numeric digits", () => {
  for (let index = 0; index < 20; index += 1) assert.match(createArrivalPin(), /^\d{6}$/);
});

test("arrival PIN digest verifies without storing the raw PIN", () => {
  const digest = hashArrivalPin("123456", "fixed-test-salt");
  assert.equal(digest.includes("123456"), false);
  assert.equal(verifyArrivalPin("123456", digest), true);
  assert.equal(verifyArrivalPin("123457", digest), false);
});

test("arrival verification locks after five failures", () => {
  const now = new Date("2026-08-14T12:00:00.000Z");
  assert.equal(arrivalLockAfterFailure(3, now).lockedUntil, null);
  assert.equal(arrivalLockAfterFailure(4, now).lockedUntil?.toISOString(), "2026-08-14T12:15:00.000Z");
});
