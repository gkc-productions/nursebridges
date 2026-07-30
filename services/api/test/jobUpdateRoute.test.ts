import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Fastify from "fastify";
import { ZodError } from "zod";
import type { Authed, UserRole } from "../src/auth.ts";
import { registerJobUpdateRoute } from "../src/routes/jobUpdateRoute.ts";

type Operation = {
  table: string;
  update?: Record<string, unknown>;
  filters: Array<[string, string, unknown]>;
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
      from(table: string) {
        const operation: Operation = { table, filters: [] };
        operations.push(operation);
        const result = results.shift() ?? { data: null, error: null };

        const builder = {
          update(value: Record<string, unknown>) {
            operation.update = value;
            return builder;
          },
          eq(column: string, value: unknown) {
            operation.filters.push(["eq", column, value]);
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

async function buildApp(options: { actor: Authed; userResults?: Result[] }) {
  const app = Fastify({ logger: false });
  const user = createClient(options.userResults ?? []);
  const terminalCalls: Array<[string, string, string, string]> = [];
  const auditRows: any[] = [];

  await registerJobUpdateRoute(app, {
    requireAuth: async () => options.actor,
    terminalActions: {
      cancelJob: async (jobId: string, actorId: string, actorRole: string) => {
        terminalCalls.push(["cancel", jobId, actorId, actorRole]);
        return { id: jobId, status: "cancelled" };
      },
      completeJob: async (jobId: string, actorId: string, actorRole: string) => {
        terminalCalls.push(["complete", jobId, actorId, actorRole]);
        return { id: jobId, status: "completed" };
      }
    },
    supabaseForUser: () => user.client,
    writeAdminAuditLog: async (row: any) => {
      auditRows.push(row);
    }
  });

  app.setErrorHandler((err: any, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: "Invalid request" });
    }

    reply.code(err?.statusCode ?? 500).send({ error: err?.message ?? "Internal server error" });
  });

  return { app, user, terminalCalls, auditRows };
}

describe("job update compatibility route", () => {
  it("delegates patient cancellation to terminal actions", async () => {
    const { app, user, terminalCalls } = await buildApp({ actor: createUser("patient") });

    const response = await app.inject({
      method: "PATCH",
      url: "/jobs/job-1",
      payload: { status: "cancelled" }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { job: { id: "job-1", status: "cancelled" } });
    assert.deepEqual(terminalCalls, [["cancel", "job-1", "patient-1", "patient"]]);
    assert.equal(user.operations.length, 0);
    await app.close();
  });

  it("delegates admin completion to terminal actions", async () => {
    const { app, user, terminalCalls } = await buildApp({ actor: createUser("admin") });

    const response = await app.inject({
      method: "PATCH",
      url: "/jobs/job-1",
      payload: { status: "completed" }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { job: { id: "job-1", status: "completed" } });
    assert.deepEqual(terminalCalls, [["complete", "job-1", "admin-1", "admin"]]);
    assert.equal(user.operations.length, 0);
    await app.close();
  });

  it("updates admin editable fields without terminal actions", async () => {
    const { app, user, terminalCalls, auditRows } = await buildApp({
      actor: createUser("admin"),
      userResults: [{ data: { id: "job-1", description: "Updated notes" }, error: null }]
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/jobs/job-1",
      payload: {
        description: "Updated notes",
        address: "120 Main Street"
      }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(terminalCalls, []);
    assert.deepEqual(user.operations[0], {
      table: "jobs",
      update: {
        description: "Updated notes",
        address: "120 Main Street"
      },
      filters: [["eq", "id", "job-1"]],
      select: "*"
    });
    assert.equal(auditRows[0].action, "job_status_update");
    await app.close();
  });

  it("rejects nurses before updating jobs", async () => {
    const { app, user, terminalCalls } = await buildApp({ actor: createUser("nurse") });

    const response = await app.inject({
      method: "PATCH",
      url: "/jobs/job-1",
      payload: { status: "cancelled" }
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.json(), { error: "Forbidden" });
    assert.deepEqual(terminalCalls, []);
    assert.equal(user.operations.length, 0);
    await app.close();
  });
});
