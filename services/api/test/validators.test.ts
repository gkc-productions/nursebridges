import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZodError } from "zod";
import {
  careCircleRecipientSchema,
  createJobSchema,
  patientFeedbackSchema,
  visitEventSchema,
  visitReportSchema
} from "../src/validators.ts";

describe("createJobSchema", () => {
  it("accepts the mobile create-job payload and normalizes optional fields", () => {
    const parsed = createJobSchema.parse({
      title: "  Post-op check-in  ",
      description: "",
      address: "  120 Main Street  ",
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
        transportation_mode: "medical_transport",
        return_plan: "round_trip"
      }
    });

    assert.equal(parsed.title, "Post-op check-in");
    assert.equal(parsed.description, "");
    assert.equal(parsed.address, "120 Main Street");
    assert.equal(parsed.start_time, "2026-05-01T14:00:00.000Z");
    assert.equal(parsed.hourly_rate, 45);
    assert.equal(parsed.logistics.state, "GA");
    assert.deepEqual(parsed.logistics.mobility_aids, []);
  });

  it("allows omitted optional request details", () => {
    const parsed = createJobSchema.parse({
      title: "Dialysis appointment support",
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

    assert.equal(parsed.description, "");
    assert.equal(parsed.address, "");
    assert.equal(parsed.start_time, undefined);
    assert.equal(parsed.hourly_rate, undefined);
  });

  it("rejects invalid dates with a field-level issue", () => {
    assert.throws(
      () =>
        createJobSchema.parse({
          title: "Medication pickup",
          start_time: "next Tuesday",
          logistics: {
            residence_type: "house",
            street_address: "10 Care Lane",
            city: "Decatur",
            state: "GA",
            postal_code: "30030",
            transportation_mode: "not_arranged",
            return_plan: "not_arranged"
          }
        }),
      (error) =>
        error instanceof ZodError &&
        error.issues.some((issue) => issue.path.join(".") === "start_time")
    );
  });

  it("rejects negative hourly rates with a field-level issue", () => {
    assert.throws(
      () =>
        createJobSchema.parse({
          title: "Home safety visit",
          hourly_rate: "-1",
          logistics: {
            residence_type: "house",
            street_address: "10 Care Lane",
            city: "Decatur",
            state: "GA",
            postal_code: "30030",
            transportation_mode: "not_arranged",
            return_plan: "not_arranged"
          }
        }),
      (error) =>
        error instanceof ZodError &&
        error.issues.some((issue) => issue.path.join(".") === "hourly_rate")
    );
  });

  it("requires apartment routing details and blocks access codes", () => {
    const base = {
      title: "Appointment support",
      logistics: {
        residence_type: "apartment",
        street_address: "120 Main Street",
        city: "Atlanta",
        state: "GA",
        postal_code: "30303",
        transportation_mode: "family_friend",
        return_plan: "round_trip"
      }
    };

    assert.throws(
      () => createJobSchema.parse(base),
      (error) => error instanceof ZodError && error.issues.some((issue) => issue.path.join(".") === "logistics.unit")
    );
    assert.throws(
      () => createJobSchema.parse({
        ...base,
        logistics: { ...base.logistics, unit: "4B", arrival_instructions: "Gate code is 1234" }
      }),
      (error) => error instanceof ZodError && error.issues.some((issue) => issue.path.join(".") === "logistics.arrival_instructions")
    );
  });
});

describe("visit coordination schemas", () => {
  it("accepts ordered checkpoints and privacy-minimized reports", () => {
    assert.deepEqual(visitEventSchema.parse({ event_type: "patient_handoff" }), {
      event_type: "patient_handoff"
    });
    assert.deepEqual(visitReportSchema.parse({ status: "submitted", visit_summary: "Patient returned home safely." }), {
      status: "submitted",
      visit_summary: "Patient returned home safely."
    });
  });

  it("rejects invalid ratings and incomplete care-circle consent", () => {
    assert.throws(() => patientFeedbackSchema.parse({ rating: 6 }), ZodError);
    assert.throws(
      () => careCircleRecipientSchema.parse({ display_name: "Family", relationship: "Daughter", email: "family@example.com" }),
      ZodError
    );
  });

  it("requires a contact method and permits explicit consent", () => {
    const recipient = careCircleRecipientSchema.parse({
      display_name: "Family",
      relationship: "Daughter",
      email: "family@example.com",
      receive_milestones: true
    });
    assert.equal(recipient.receive_milestones, true);
    assert.equal(recipient.receive_summary, false);
  });
});
