import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { Session } from "@supabase/supabase-js";
import { ApiRequestError, apiFetch, formatApiErrorMessage } from "../src/api";

const originalFetch = globalThis.fetch;
const originalDateNow = Date.now;
const originalMathRandom = Math.random;
const originalConsoleWarn = console.warn;

function testSession(): Session {
  return {
    access_token: "access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: 1784263600,
    refresh_token: "refresh-token",
    user: {
      id: "user-1",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00Z"
    }
  } as Session;
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  Date.now = originalDateNow;
  Math.random = originalMathRandom;
  console.warn = originalConsoleWarn;
});

describe("mobile API helper", () => {
  it("sends a mobile request ID and uses it as the fallback error reference", async () => {
    Date.now = () => 1784260000000;
    Math.random = () => 0.123456789;
    console.warn = () => {};

    let sentRequestId: string | null = null;
    globalThis.fetch = async (_url, init) => {
      sentRequestId = new Headers(init?.headers).get("x-request-id");
      return jsonResponse(400, { error: "Unable to create job" });
    };

    await assert.rejects(
      () => apiFetch("https://api.example.test", testSession(), "/jobs", { method: "POST" }),
      (error: unknown) => {
        assert.ok(error instanceof ApiRequestError);
        assert.equal(error.requestId, sentRequestId);
        assert.match(error.requestId ?? "", /^mobile-/);
        assert.equal(error.message, "Unable to create job");
        return true;
      }
    );
  });

  it("prefers server request IDs and includes validation issues in formatted errors", () => {
    const error = new ApiRequestError(
      400,
      {
        error: "Invalid request",
        requestId: "server-request-id",
        issues: [
          { path: "title", message: "Too small" },
          { message: "General issue" }
        ]
      },
      "mobile-fallback"
    );

    assert.equal(error.requestId, "server-request-id");
    assert.equal(
      formatApiErrorMessage("Unable to create job.", error),
      "Invalid request\ntitle: Too small\nGeneral issue\nReference: server-request-id"
    );
  });

  it("returns the caller fallback for non-API errors", () => {
    assert.equal(formatApiErrorMessage("Unable to create job.", new Error("Network down")), "Unable to create job.");
  });
});
