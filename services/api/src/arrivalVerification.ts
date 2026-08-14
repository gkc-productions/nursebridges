import { randomInt, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PIN_PATTERN = /^\d{6}$/;

export function createArrivalPin() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
export function hashArrivalPin(pin: string, salt = randomBytes(16).toString("hex")) {
  if (!PIN_PATTERN.test(pin)) throw new Error("Arrival PIN must contain six digits");
  const digest = scryptSync(pin, salt, 32).toString("hex");
  return `scrypt:${salt}:${digest}`;
}

export function verifyArrivalPin(pin: string, storedDigest: string) {
  if (!PIN_PATTERN.test(pin)) return false;
  const [algorithm, salt, expectedHex] = storedDigest.split(":");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(pin, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function arrivalLockAfterFailure(failedAttempts: number, now = new Date()) {
  const nextAttempts = failedAttempts + 1;
  return {
    failedAttempts: nextAttempts,
    lockedUntil: nextAttempts >= 5 ? new Date(now.getTime() + 15 * 60 * 1000) : null
  };
}
