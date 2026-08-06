import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Fastify from "fastify";
import { ZodError } from "zod";
import {
  createAccessRequestRateLimiter,
  registerPatientAccessRequestRoute
} from "../src/routes/patientAccessRequestRoute.ts";

type Result = { data?: unknown; error?: any };

function createAdminClient(result: Result) {
  const operations: Array<{ table: string; insert?: Record<string, unknown>; select?: string }> = [];
  return {
    operations,
    client: {
      from(table: string) {
        const operation: { table: string; insert?: Record<string, unknown>; select?: string } = { table };
        operations.push(operation);
        const builder = {
          insert(value: Record<string, unknown>) {
            operation.insert = value;
            return builder;
          },
          select(columns: string) {
            operation.select = columns;
            return builder;
          },
          single() {
            return result;
          }
        };
        return builder;
      }
    }
  };
}

async function buildApp(result: Result, limit = 3) {
  const app = Fastify({ logger: false, genReqId: () => "access-request-1" });
  const admin = createAdminClient(result);
  await registerPatientAccessRequestRoute(app, {
    supabaseAdmin: admin.client,
    rateLimiter: createAccessRequestRateLimiter({ limit, now: () => 1000 }),
    now: () => new Date("2026-08-04T01:00:00.000Z")
  });
  app.setErrorHandler((err: any, _req, reply) => {
    if (err instanceof ZodError) return reply.code(400).send({ error: "Invalid request" });
    return reply.code(500).send({ error: "Internal server error" });
  });
  return { app, admin };
}

const validPayload = {
  full_name: "Test Patient",
  email: "TEST@example.com",
  service_area: "Atlanta, GA",
  requester_type: "patient",
  contact_consent: true,
  website: ""
};

describe("patient access request route", () => {
  it("stores normalized minimal contact data and returns 202", async () => {
    const { app, admin } = await buildApp({ data: { id: "access-1" }, error: null });
    const response = await app.inject({ method: "POST", url: "/v1/access-requests/patient", payload: validPayload });

    assert.equal(response.statusCode, 202);
    assert.deepEqual(response.json(), {
      ok: true,
      message: "Request received.",
      requestId: "access-request-1"
    });
    assert.deepEqual(admin.operations[0], {
      table: "patient_access_requests",
      insert: {
        full_name: "Test Patient",
        email: "test@example.com",
        phone: null,
        service_area: "Atlanta, GA",
        requester_type: "patient",
        source: "patient_ios_app",
        contact_consent_at: "2026-08-04T01:00:00.000Z"
      },
      select: "id"
    });
    await app.close();
  });

  it("accepts duplicate open requests without revealing account state", async () => {
    const { app } = await buildApp({ data: null, error: { code: "23505" } });
    const response = await app.inject({ method: "POST", url: "/v1/access-requests/patient", payload: validPayload });
    assert.equal(response.statusCode, 202);
    assert.equal(response.json().message, "Request received.");
    await app.close();
  });

  it("does not store honeypot submissions", async () => {
    const { app, admin } = await buildApp({ data: { id: "access-1" }, error: null });
    const response = await app.inject({
      method: "POST",
      url: "/v1/access-requests/patient",
      payload: { ...validPayload, website: "https://spam.example" }
    });
    assert.equal(response.statusCode, 202);
    assert.equal(admin.operations.length, 0);
    await app.close();
  });

  it("rate limits repeated submissions without storing another request", async () => {
    const { app, admin } = await buildApp({ data: { id: "access-1" }, error: null }, 1);
    await app.inject({ method: "POST", url: "/v1/access-requests/patient", payload: validPayload });
    const response = await app.inject({ method: "POST", url: "/v1/access-requests/patient", payload: validPayload });
    assert.equal(response.statusCode, 429);
    assert.equal(admin.operations.length, 1);
    await app.close();
  });

  it("rejects requests without consent", async () => {
    const { app, admin } = await buildApp({ data: { id: "access-1" }, error: null });
    const response = await app.inject({
      method: "POST",
      url: "/v1/access-requests/patient",
      payload: { ...validPayload, contact_consent: false }
    });
    assert.equal(response.statusCode, 400);
    assert.equal(admin.operations.length, 0);
    await app.close();
  });
});
