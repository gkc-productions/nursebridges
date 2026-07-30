import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Fastify from "fastify";
import { registerJobApplyRoute } from "../src/routes/jobApplyRoute.ts";
import type { Authed, UserRole } from "../src/auth.ts";

type Operation = {
  table: string;
  insert?: Record<string, unknown>;
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
          insert(value: Record<string, unknown>) {
            operation.insert = value;
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

async function buildApp(options: {
  adminResults?: Result[];
  userResults: Result[];
  verificationError?: Error;
}) {
  const app = Fastify({ logger: false });
  const admin = createClient(options.adminResults ?? []);
  const user = createClient(options.userResults);
  const notifications: any[] = [];

  await registerJobApplyRoute(app, {
    requireAuth: async () => nurseUser,
    requireRole: (authed: Authed, roles: UserRole[]) => {
      if (!roles.includes(authed.role)) {
        throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
      }
    },
    requireVerifiedNurse: async () => {
      if (options.verificationError) throw options.verificationError;
    },
    supabaseAdmin: options.adminResults ? admin.client : null,
    supabaseForUser: () => user.client,
    createNotification: async (notification: any) => {
      notifications.push(notification);
    }
  });

  return { app, admin, user, notifications };
}

describe("job apply route", () => {
  it("requires nurse verification before reading or writing applications", async () => {
    const { app, user } = await buildApp({
      userResults: [],
      verificationError: Object.assign(new Error("Nurse verification required"), { statusCode: 403 })
    });

    const response = await app.inject({
      method: "POST",
      url: "/jobs/job-1/apply",
      payload: { note: "Available" }
    });

    assert.equal(response.statusCode, 403);
    assert.equal(user.operations.length, 0);
    await app.close();
  });

  it("rejects applying to a job that is no longer open", async () => {
    const { app, admin, user } = await buildApp({
      adminResults: [{ data: { id: "job-1", status: "assigned" }, error: null }],
      userResults: []
    });

    const response = await app.inject({
      method: "POST",
      url: "/jobs/job-1/apply",
      payload: { note: "Available" }
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), { error: "Invalid job transition" });
    assert.equal(admin.operations.length, 1);
    assert.equal(user.operations.length, 0);
    await app.close();
  });

  it("rejects duplicate applications before inserting", async () => {
    const { app, user } = await buildApp({
      userResults: [
        { data: { id: "job-1", status: "open" }, error: null },
        { data: { id: "app-1", status: "applied" }, error: null }
      ]
    });

    const response = await app.inject({
      method: "POST",
      url: "/jobs/job-1/apply",
      payload: { note: "Available" }
    });

    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.json(), { error: "Application already exists" });
    assert.equal(user.operations.filter((operation) => operation.insert).length, 0);
    await app.close();
  });

  it("turns a database unique conflict into an application conflict response", async () => {
    const { app, user } = await buildApp({
      userResults: [
        { data: { id: "job-1", status: "open" }, error: null },
        { data: null, error: null },
        { data: null, error: { code: "23505" } }
      ]
    });

    const response = await app.inject({
      method: "POST",
      url: "/jobs/job-1/apply",
      payload: { note: "Available" }
    });

    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.json(), { error: "Application already exists" });
    assert.deepEqual(user.operations[2].insert, {
      job_id: "job-1",
      nurse_user_id: "nurse-1",
      status: "applied",
      note: "Available"
    });
    await app.close();
  });

  it("inserts an applied application and notifies the patient", async () => {
    const { app, admin, user, notifications } = await buildApp({
      adminResults: [
        { data: { id: "job-1", status: "open" }, error: null },
        { data: { id: "job-1", title: "Morning care", patient_user_id: "patient-1" }, error: null }
      ],
      userResults: [
        { data: null, error: null },
        { data: { id: "app-1", status: "applied" }, error: null }
      ]
    });

    const response = await app.inject({
      method: "POST",
      url: "/jobs/job-1/apply",
      payload: { note: "Available" }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(user.operations[1].insert, {
      job_id: "job-1",
      nurse_user_id: "nurse-1",
      status: "applied",
      note: "Available"
    });
    assert.equal(admin.operations.length, 2);
    assert.deepEqual(notifications, [
      {
        userId: "patient-1",
        type: "nurse_applied",
        title: "New nurse application",
        body: "nurse@example.test applied to Morning care.",
        entityType: "job",
        entityId: "job-1"
      }
    ]);
    await app.close();
  });
});
