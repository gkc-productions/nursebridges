import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Fastify from "fastify";
import { ZodError } from "zod";
import { registerJobCreateRoute } from "../src/routes/jobCreateRoute.ts";
import type { Authed, UserRole } from "../src/auth.ts";

type Operation = {
  table: string;
  rpc?: string;
  args?: Record<string, unknown>;
  insert?: Record<string, unknown>;
  select?: string;
};

type Result = { data?: unknown; error?: any };

function createUser(role: UserRole): Authed {
  return {
    jwt: `${role}-token`,
    userId: `${role}-1`,
    email: `${role}@example.test`,
    role,
    profile: null
  };
}

function createClient(results: Result[]) {
  const operations: Operation[] = [];

  return {
    operations,
    client: {
      rpc(name: string, args: Record<string, unknown>) {
        const operation: Operation = { table: "rpc", rpc: name, args };
        operations.push(operation);
        return results.shift() ?? { data: null, error: null };
      },
      from(table: string) {
        const operation: Operation = { table };
        operations.push(operation);
        const result = results.shift() ?? { data: null, error: null };

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

async function buildApp(options: { role?: UserRole; userResults: Result[] }) {
  const app = Fastify({
    logger: false,
    genReqId: (req) => {
      const requestId = req.headers["x-request-id"];
      return Array.isArray(requestId) ? requestId[0] : requestId || "req-1";
    }
  });
  const user = createClient(options.userResults);
  const authed = createUser(options.role ?? "patient");

  await registerJobCreateRoute(app, {
    requireAuth: async () => authed,
    requireRole: (current: Authed, roles: UserRole[]) => {
      if (!roles.includes(current.role)) {
        throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
      }
    },
    supabaseForUser: () => user.client
  });

  app.setErrorHandler((err: any, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: "Invalid request",
        issues: err.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    reply.code(err?.statusCode ?? 500).send({ error: err?.message ?? "Internal server error" });
  });

  return { app, user };
}

describe("job create route", () => {
  it("rejects non-patient users before inserting", async () => {
    const { app, user } = await buildApp({ role: "nurse", userResults: [] });

    const response = await app.inject({
      method: "POST",
      url: "/jobs",
      payload: { title: "Post-op check-in" }
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.json(), { error: "Forbidden" });
    assert.equal(user.operations.length, 0);
    await app.close();
  });

  it("validates the mobile create-job payload before inserting", async () => {
    const { app, user } = await buildApp({ userResults: [] });

    const response = await app.inject({
      method: "POST",
      url: "/jobs",
      payload: { title: "No" }
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, "Invalid request");
    assert.equal(response.json().issues[0].path, "title");
    assert.equal(user.operations.length, 0);
    await app.close();
  });

  it("inserts the normalized job payload for a patient", async () => {
    const { app, user } = await buildApp({
      userResults: [
        {
          data: "job-1",
          error: null
        }
      ]
    });

    const response = await app.inject({
      method: "POST",
      url: "/jobs",
      payload: {
        title: "  Dialysis appointment support  ",
        description: "",
        address: "120 Main Street",
        start_time: "2026-05-01T14:00:00Z",
        hourly_rate: "45",
        logistics: {
          residence_type: "apartment",
          street_address: "120 Main Street",
          unit: "4B",
          city: "Atlanta",
          state: "GA",
          postal_code: "30303",
          stairs: "entrance",
          elevator_available: true,
          mobility_aids: ["walker"],
          transportation_mode: "medical_transport",
          transportation_provider: "Scheduled provider",
          return_plan: "round_trip"
        }
      }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(user.operations[0], {
      table: "rpc",
      rpc: "create_care_request",
      args: {
        p_request: {
        title: "Dialysis appointment support",
        description: null,
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
            transportation_provider: "Scheduled provider",
            pickup_time: null,
            return_plan: "round_trip",
            transportation_notes: null
          }
        }
      }
    });
    assert.deepEqual(response.json(), { job: { id: "job-1", title: "Dialysis appointment support", status: "open" } });
    await app.close();
  });

  it("returns requestId when the database insert fails", async () => {
    const { app } = await buildApp({
      userResults: [
        {
          data: null,
          error: {
            code: "23502",
            message: "null value in column",
            details: "failing row",
            hint: "check required columns"
          }
        }
      ]
    });

    const response = await app.inject({
      method: "POST",
      url: "/jobs",
      headers: { "x-request-id": "create-job-test-request" },
      payload: {
        title: "Post-op check-in",
        logistics: {
          residence_type: "house",
          street_address: "10 Care Lane",
          city: "Decatur",
          state: "GA",
          postal_code: "30030",
          transportation_mode: "not_arranged",
          return_plan: "not_arranged"
        }
      }
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), {
      error: "Unable to create job",
      requestId: "create-job-test-request"
    });
    await app.close();
  });
});
