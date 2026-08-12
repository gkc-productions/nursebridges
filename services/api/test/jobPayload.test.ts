import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCreateCareRequestRpcPayload, buildCreateJobPayload } from "../src/jobPayload.ts";
import { createJobSchema } from "../src/validators.ts";

describe("buildCreateJobPayload", () => {
  it("maps a validated care request to the jobs insert shape", () => {
    const body = createJobSchema.parse({
      title: "Post-op check-in",
      description: "Check vitals and help with mobility.",
      address: "120 Main Street",
      start_time: "2026-05-01T14:00:00Z",
      hourly_rate: "45",
      logistics: {
        residence_type: "apartment",
        street_address: "120 Main Street",
        unit: "4B",
        city: "Atlanta",
        state: "ga",
        postal_code: "30303",
        stairs: "entrance",
        elevator_available: true,
        mobility_aids: ["walker"],
        transportation_mode: "medical_transport",
        return_plan: "round_trip"
      }
    });

    assert.deepEqual(buildCreateJobPayload("patient-123", body), {
      created_by: "patient-123",
      patient_user_id: "patient-123",
      patient_id: "patient-123",
      title: "Post-op check-in",
      description: "Check vitals and help with mobility.",
      address: null,
      service_city: "Atlanta",
      service_state: "GA",
      start_time: "2026-05-01T14:00:00.000Z",
      hourly_rate: null,
      status: "open"
    });

    assert.deepEqual(buildCreateCareRequestRpcPayload(body), {
      title: "Post-op check-in",
      description: "Check vitals and help with mobility.",
      start_time: "2026-05-01T14:00:00.000Z",
      logistics: {
        residence_type: "apartment",
        street_address: "120 Main Street",
        unit: "4B",
        building_name: null,
        city: "Atlanta",
        state: "GA",
        postal_code: "30303",
        stairs: "entrance",
        elevator_available: true,
        meeting_point: null,
        parking_notes: null,
        arrival_instructions: null,
        mobility_aids: ["walker"],
        mobility_notes: null,
        onsite_contact_name: null,
        onsite_contact_relationship: null,
        onsite_contact_phone: null,
        transportation_mode: "medical_transport",
        transportation_provider: null,
        pickup_time: null,
        return_plan: "round_trip",
        transportation_notes: null
      }
    });
  });

  it("stores optional blank request fields as null", () => {
    const body = createJobSchema.parse({
      title: "Dialysis appointment support",
      description: "",
      address: "",
      start_time: "",
      hourly_rate: "",
      logistics: {
        residence_type: "house",
        street_address: "10 Care Lane",
        city: "Decatur",
        state: "GA",
        postal_code: "30030",
        transportation_mode: "not_arranged",
        return_plan: "not_arranged"
      }
    });

    assert.deepEqual(buildCreateJobPayload("patient-456", body), {
      created_by: "patient-456",
      patient_user_id: "patient-456",
      patient_id: "patient-456",
      title: "Dialysis appointment support",
      description: null,
      address: null,
      service_city: "Decatur",
      service_state: "GA",
      start_time: null,
      hourly_rate: null,
      status: "open"
    });
  });
});
