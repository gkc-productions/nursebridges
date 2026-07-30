import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZodError } from "zod";
import { createJobSchema } from "../src/validators.ts";

describe("createJobSchema", () => {
  it("accepts the mobile create-job payload and normalizes optional fields", () => {
    const parsed = createJobSchema.parse({
      title: "  Post-op check-in  ",
      description: "",
      address: "  120 Main Street  ",
      start_time: "2026-05-01T14:00:00Z",
      hourly_rate: "45"
    });

    assert.equal(parsed.title, "Post-op check-in");
    assert.equal(parsed.description, "");
    assert.equal(parsed.address, "120 Main Street");
    assert.equal(parsed.start_time, "2026-05-01T14:00:00.000Z");
    assert.equal(parsed.hourly_rate, 45);
  });

  it("allows omitted optional request details", () => {
    const parsed = createJobSchema.parse({
      title: "Dialysis appointment support"
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
          start_time: "next Tuesday"
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
          hourly_rate: "-1"
        }),
      (error) =>
        error instanceof ZodError &&
        error.issues.some((issue) => issue.path.join(".") === "hourly_rate")
    );
  });
});
