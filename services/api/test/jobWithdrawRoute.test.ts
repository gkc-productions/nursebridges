import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Fastify from "fastify";
import { registerJobWithdrawRoute } from "../src/routes/jobWithdrawRoute.ts";
import type { Authed, UserRole } from "../src/auth.ts";

type Operation = {
  table: string;
  update?: Record<string, unknown>;
  select?: string;
  filters: Array<[string, string, unknown]>;
};

type Result = { data?: unknown; error?: any };

const nurseUser: Authed = {
  jwt: "nurse-token",
  userId: "nurse-1",
  email: "nurse@example.test",
  role: "nurse",
  profile: null
};

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
          select(columns: string) {
            operation.select = columns;
            return builder;
          },
          update(value: Record<string, unknown>) {
            operation.update = value;
            return builder;
          },
          eq(column: string, value: unknown) {
            operation.filters.push(["eq", column, value]);
            return builder;
          },
          single() {
            return result;
          },
          maybeSingle() {
            return result;
          }
        };

        return builder;
      }
    }
  };
}

async function buildApp(userResults: Result[]) {
  const app = Fastify({ logger: false });
  const user = createClient(userResults);

  await registerJobWithdrawRoute(app, {
    requireAuth: async () => nurseUser,
    requireRole: (authed: Authed, roles: UserRole[]) => {
      if (!roles.includes(authed.role)) {
        throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
      }
    },
    supabaseForUser: () => user.client
  });

  return { app, user };
}

describe("job withdraw route", () => {
  it("returns not found when the nurse has no application for the job", async () => {
    const { app, user } = await buildApp([{ data: null, error: null }]);

    const response = await app.inject({
      method: "POST",
      url: "/jobs/job-1/withdraw"
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), { error: "Application not found" });
    assert.equal(user.operations.filter((operation) => operation.update).length, 0);
    await app.close();
  });

  it("rejects withdrawing applications that are no longer applied", async () => {
    const { app, user } = await buildApp([{ data: { id: "app-1", status: "accepted" }, error: null }]);

    const response = await app.inject({
      method: "POST",
      url: "/jobs/job-1/withdraw"
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), { error: "Application cannot be withdrawn" });
    assert.equal(user.operations.filter((operation) => operation.update).length, 0);
    await app.close();
  });

  it("returns an update error when the applied application changes before withdrawal writes", async () => {
    const { app, user } = await buildApp([
      { data: { id: "app-1", status: "applied" }, error: null },
      { data: null, error: { code: "PGRST116" } }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/jobs/job-1/withdraw"
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), { error: "Unable to withdraw application" });
    assert.deepEqual(user.operations[1].filters, [
      ["eq", "id", "app-1"],
      ["eq", "job_id", "job-1"],
      ["eq", "nurse_user_id", "nurse-1"],
      ["eq", "status", "applied"]
    ]);
    await app.close();
  });

  it("withdraws only the nurse's currently applied application", async () => {
    const { app, user } = await buildApp([
      { data: { id: "app-1", status: "applied" }, error: null },
      { data: { id: "app-1", status: "withdrawn" }, error: null }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/jobs/job-1/withdraw"
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(user.operations[1].update, { status: "withdrawn" });
    assert.deepEqual(user.operations[1].filters, [
      ["eq", "id", "app-1"],
      ["eq", "job_id", "job-1"],
      ["eq", "nurse_user_id", "nurse-1"],
      ["eq", "status", "applied"]
    ]);
    await app.close();
  });
});
