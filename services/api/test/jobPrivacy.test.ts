import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canReceivePrivateLogistics, privateAddressForViewer } from "../src/jobPrivacy.ts";

const job = {
  id: "job-1",
  status: "open",
  patient_user_id: "patient-1",
  title: "Appointment support",
  description: null,
  address: null,
  service_city: "Atlanta",
  service_state: "GA",
  start_time: null,
  hourly_rate: null,
  created_at: "2026-08-12T12:00:00.000Z"
};

describe("private job logistics visibility", () => {
  it("allows the patient owner and admins", () => {
    assert.equal(canReceivePrivateLogistics("patient", "patient-1", job, null), true);
    assert.equal(canReceivePrivateLogistics("admin", "admin-1", job, null), true);
  });

  it("allows only the assigned nurse, never nurses browsing an open request", () => {
    assert.equal(canReceivePrivateLogistics("nurse", "nurse-1", job, null), false);
    assert.equal(canReceivePrivateLogistics("nurse", "nurse-1", { ...job, status: "assigned" }, "nurse-1"), true);
    assert.equal(canReceivePrivateLogistics("nurse", "nurse-2", { ...job, status: "assigned" }, "nurse-1"), false);
  });

  it("redacts legacy exact addresses from nurses before assignment", () => {
    assert.equal(privateAddressForViewer("123 Private Way", "nurse", "nurse-1", job, null), null);
    assert.equal(privateAddressForViewer("123 Private Way", "nurse", "nurse-1", job, "nurse-1"), "123 Private Way");
    assert.equal(privateAddressForViewer("123 Private Way", "patient", "patient-1", job, null), "123 Private Way");
  });
});
