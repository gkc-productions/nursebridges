import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPatientAccessRequestPayload, emptyPatientAccessForm } from "../src/onboarding";

describe("patient onboarding", () => {
  it("normalizes the minimal early-access request", () => {
    const result = buildPatientAccessRequestPayload({
      ...emptyPatientAccessForm,
      fullName: "  Test Patient  ",
      email: "  TEST@EXAMPLE.COM ",
      phone: " 555-555-0100 ",
      serviceArea: "  Atlanta, GA ",
      requesterType: "family",
      contactConsent: true
    });

    assert.deepEqual(result, {
      ok: true,
      value: {
        full_name: "Test Patient",
        email: "test@example.com",
        phone: "555-555-0100",
        service_area: "Atlanta, GA",
        requester_type: "family",
        contact_consent: true,
        website: ""
      }
    });
  });

  it("does not include an empty optional phone number", () => {
    const result = buildPatientAccessRequestPayload({
      ...emptyPatientAccessForm,
      fullName: "Test Patient",
      email: "test@example.com",
      serviceArea: "30303",
      contactConsent: true
    });

    assert.equal(result.ok, true);
    if (result.ok) assert.equal("phone" in result.value, false);
  });

  it("requires contact consent", () => {
    const result = buildPatientAccessRequestPayload({
      ...emptyPatientAccessForm,
      fullName: "Test Patient",
      email: "test@example.com",
      serviceArea: "30303"
    });

    assert.deepEqual(result, { ok: false, error: "Confirm that NurseBridges may contact you." });
  });
});
