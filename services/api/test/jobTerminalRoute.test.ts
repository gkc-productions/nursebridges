import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Fastify from "fastify";
import { createJobTerminalActions, registerJobTerminalRoutes } from "../src/routes/jobTerminalRoute.ts";
import type { Authed } from "../src/auth.ts";
import type { FinalizeTerminalJobInput, FinalizeTerminalJobResult } from "../src/jobTerminalCommand.ts";

type Operation = {
  table: string;
  update?: Record<string, unknown>;
  select?: string;
  filters: Array<[string, string, unknown]>;
};

type Result = { data?: unknown; error?: any };

function createUser(role: Authed["role"], userId: string): Authed {
  return {
    jwt: `${role}-token`,
    userId,
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
          in(column: string, value: unknown[]) {
            operation.filters.push(["in", column, value]);
            return builder;
          },
          maybeSingle() {
            return result;
          },
          single() {
            return result;
          },
          then(resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) {
            return Promise.resolve(result).then(resolve, reject);
          }
        };

        return builder;
      }
    }
  };
}

async function buildApp(options: {
  actor: Authed;
  adminResults: Result[];
  finalizeTerminalJob?: (
    deps: { supabaseAdmin: any },
    input: FinalizeTerminalJobInput
  ) => Promise<FinalizeTerminalJobResult>;
}) {
  const app = Fastify({ logger: false });
  const admin = createClient(options.adminResults);
  const notifications: any[] = [];
  const auditRows: any[] = [];

  const actions = createJobTerminalActions({
    supabaseAdmin: admin.client,
    createNotifications: async (items: any[]) => {
      notifications.push(...items);
    },
    writeAdminAuditLog: async (row: any) => {
      auditRows.push(row);
    },
    finalizeTerminalJob: options.finalizeTerminalJob
  });

  await registerJobTerminalRoutes(app, {
    requireAuth: async () => options.actor,
    actions
  });

  app.setErrorHandler((err: any, _req, reply) => {
    reply.code(err?.statusCode ?? 500).send({ error: err?.message ?? "Internal server error" });
  });

  return { app, admin, notifications, auditRows };
}

describe("job terminal routes", () => {
  it("rejects patient cancellation for a job owned by another patient", async () => {
    const { app, admin } = await buildApp({
      actor: createUser("patient", "patient-1"),
      adminResults: [{ data: { id: "job-1", status: "open", patient_user_id: "patient-2", title: "Visit" }, error: null }]
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/jobs/job-1/cancel"
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.json(), { error: "Forbidden" });
    assert.equal(admin.operations.filter((operation) => operation.update).length, 0);
    await app.close();
  });

  it("cancels an open job, rejects applied applications, and notifies active nurses", async () => {
    const { app, admin, notifications } = await buildApp({
      actor: createUser("patient", "patient-1"),
      adminResults: [
        { data: { id: "job-1", status: "open", patient_user_id: "patient-1", title: "Visit" }, error: null },
        {
          data: [
            { nurse_user_id: "nurse-1", status: "applied" },
            { nurse_user_id: "nurse-2", status: "accepted" },
            { nurse_user_id: "nurse-3", status: "withdrawn" }
          ],
          error: null
        },
        { data: null, error: null },
        { data: { id: "job-1", status: "cancelled" }, error: null }
      ]
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/jobs/job-1/cancel"
    });

    assert.equal(response.statusCode, 200);

    const rejectOperation = admin.operations[2];
    assert.deepEqual(rejectOperation.update, { status: "rejected" });
    assert.deepEqual(rejectOperation.filters, [
      ["eq", "job_id", "job-1"],
      ["eq", "status", "applied"]
    ]);

    const cancelOperation = admin.operations[3];
    assert.deepEqual(cancelOperation.update, { status: "cancelled" });
    assert.deepEqual(cancelOperation.filters, [
      ["eq", "id", "job-1"],
      ["eq", "status", "open"]
    ]);

    assert.deepEqual(
      notifications.map((notification) => [notification.userId, notification.type]),
      [
        ["patient-1", "job_cancelled"],
        ["nurse-1", "assigned_job_cancelled"],
        ["nurse-2", "assigned_job_cancelled"]
      ]
    );
    await app.close();
  });

  it("returns conflict when a cancellation stale write updates no job row", async () => {
    const { app, admin, notifications, auditRows } = await buildApp({
      actor: createUser("patient", "patient-1"),
      adminResults: [
        { data: { id: "job-1", status: "open", patient_user_id: "patient-1", title: "Visit" }, error: null },
        { data: [{ nurse_user_id: "nurse-1", status: "applied" }], error: null },
        { data: null, error: null },
        { data: null, error: { code: "PGRST116", message: "no rows returned" } }
      ]
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/jobs/job-1/cancel"
    });

    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.json(), { error: "Unable to update job" });
    assert.deepEqual(notifications, []);
    assert.deepEqual(auditRows, []);
    assert.equal(admin.operations.filter((operation) => operation.update).length, 2);
    await app.close();
  });

  it("rejects completion by a nurse who is not the accepted nurse", async () => {
    const { app, admin } = await buildApp({
      actor: createUser("nurse", "nurse-2"),
      adminResults: [
        { data: { id: "job-1", status: "assigned", patient_user_id: "patient-1", title: "Visit" }, error: null },
        { data: { nurse_user_id: "nurse-1" }, error: null }
      ]
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/jobs/job-1/complete"
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.json(), { error: "Forbidden" });
    assert.equal(admin.operations.filter((operation) => operation.update).length, 0);
    await app.close();
  });

  it("requires a submitted report and final checkpoint before nurse completion", async () => {
    const { app, admin } = await buildApp({
      actor: createUser("nurse", "nurse-1"),
      adminResults: [
        { data: { id: "job-1", status: "assigned", patient_user_id: "patient-1", title: "Visit" }, error: null },
        { data: { nurse_user_id: "nurse-1" }, error: null },
        { data: null, error: null },
        { data: { id: "report-1", status: "submitted" }, error: null }
      ]
    });

    const response = await app.inject({ method: "PATCH", url: "/jobs/job-1/complete" });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), { error: "Submit the visit report and final checkpoint before completing care" });
    assert.equal(admin.operations.filter((operation) => operation.update).length, 0);
    await app.close();
  });

  it("completes an assigned job only while it is still assigned", async () => {
    const { app, admin, notifications, auditRows } = await buildApp({
      actor: createUser("admin", "admin-1"),
      adminResults: [
        { data: { id: "job-1", status: "assigned", patient_user_id: "patient-1", title: "Visit" }, error: null },
        { data: { nurse_user_id: "nurse-1" }, error: null },
        { data: { id: "job-1", status: "completed" }, error: null }
      ]
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/jobs/job-1/complete"
    });

    assert.equal(response.statusCode, 200);

    const completeOperation = admin.operations[2];
    assert.deepEqual(completeOperation.update, { status: "completed" });
    assert.deepEqual(completeOperation.filters, [
      ["eq", "id", "job-1"],
      ["eq", "status", "assigned"]
    ]);

    assert.deepEqual(
      notifications.map((notification) => [notification.userId, notification.type]),
      [
        ["patient-1", "job_completed"],
        ["nurse-1", "assigned_job_completed"]
      ]
    );
    assert.equal(auditRows[0].action, "job_completed");
    await app.close();
  });

  it("returns conflict when a completion stale write updates no job row", async () => {
    const { app, notifications, auditRows } = await buildApp({
      actor: createUser("admin", "admin-1"),
      adminResults: [
        { data: { id: "job-1", status: "assigned", patient_user_id: "patient-1", title: "Visit" }, error: null },
        { data: { nurse_user_id: "nurse-1" }, error: null },
        { data: null, error: { code: "PGRST116", message: "no rows returned" } }
      ]
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/jobs/job-1/complete"
    });

    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.json(), { error: "Unable to update job" });
    assert.deepEqual(notifications, []);
    assert.deepEqual(auditRows, []);
    await app.close();
  });

  it("uses the terminal RPC finalizer for cancellation when configured", async () => {
    const finalizerCalls: FinalizeTerminalJobInput[] = [];
    const { app, admin, notifications, auditRows } = await buildApp({
      actor: createUser("admin", "admin-1"),
      adminResults: [
        { data: { id: "job-1", status: "open", patient_user_id: "patient-1", title: "Visit" }, error: null },
        { data: [{ nurse_user_id: "nurse-1", status: "applied" }], error: null }
      ],
      finalizeTerminalJob: async (_deps, input) => {
        finalizerCalls.push(input);
        return { data: { id: "job-1", status: "cancelled" }, error: null, category: null };
      }
    });

    const response = await app.inject({ method: "PATCH", url: "/jobs/job-1/cancel" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(finalizerCalls, [
      {
        jobId: "job-1",
        actorId: "admin-1",
        actorRole: "admin",
        expectedStatus: "open",
        nextStatus: "cancelled"
      }
    ]);
    assert.equal(admin.operations.filter((operation) => operation.update).length, 0);
    assert.deepEqual(notifications, []);
    assert.deepEqual(auditRows, []);
    await app.close();
  });

  it("uses the terminal RPC finalizer for completion when configured", async () => {
    const finalizerCalls: FinalizeTerminalJobInput[] = [];
    const { app, admin, notifications, auditRows } = await buildApp({
      actor: createUser("admin", "admin-1"),
      adminResults: [
        { data: { id: "job-1", status: "assigned", patient_user_id: "patient-1", title: "Visit" }, error: null },
        { data: { nurse_user_id: "nurse-1" }, error: null }
      ],
      finalizeTerminalJob: async (_deps, input) => {
        finalizerCalls.push(input);
        return { data: { id: "job-1", status: "completed" }, error: null, category: null };
      }
    });

    const response = await app.inject({ method: "PATCH", url: "/jobs/job-1/complete" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(finalizerCalls, [
      {
        jobId: "job-1",
        actorId: "admin-1",
        actorRole: "admin",
        expectedStatus: "assigned",
        nextStatus: "completed"
      }
    ]);
    assert.equal(admin.operations.filter((operation) => operation.update).length, 0);
    assert.deepEqual(notifications, []);
    assert.deepEqual(auditRows, []);
    await app.close();
  });
});
