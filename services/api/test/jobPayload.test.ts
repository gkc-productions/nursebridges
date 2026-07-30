import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCreateJobPayload } from "../src/jobPayload.ts";
import { createJobSchema } from "../src/validators.ts";

describe("buildCreateJobPayload", () => {
  it("maps a validated care request to the jobs insert shape", () => {
    const body = createJobSchema.parse({
      title: "Post-op check-in",
      description: "Check vitals and help with mobility.",
      address: "120 Main Street",
      start_time: "2026-05-01T14:00:00Z",
      hourly_rate: "45"
    });

    assert.deepEqual(buildCreateJobPayload("patient-123", body), {
      created_by: "patient-123",
      patient_user_id: "patient-123",
      patient_id: "patient-123",
      title: "Post-op check-in",
      description: "Check vitals and help with mobility.",
      address: "120 Main Street",
      start_time: "2026-05-01T14:00:00.000Z",
      hourly_rate: 45,
      status: "open"
    });
  });

  it("stores optional blank request fields as null", () => {
    const body = createJobSchema.parse({
      title: "Dialysis appointment support",
      description: "",
      address: "",
      start_time: "",
      hourly_rate: ""
    });

    assert.deepEqual(buildCreateJobPayload("patient-456", body), {
      created_by: "patient-456",
      patient_user_id: "patient-456",
      patient_id: "patient-456",
      title: "Dialysis appointment support",
      description: null,
      address: null,
      start_time: null,
      hourly_rate: null,
      status: "open"
    });
  });
});
