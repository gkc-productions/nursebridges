import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Fastify from "fastify";
import { registerAdminAssignmentRoute } from "../src/routes/adminAssignmentRoute.ts";
import type { Authed, UserRole } from "../src/auth.ts";
import type { AssignmentFinalizer } from "../src/jobAssignmentCommand.ts";

type Operation = {
  table: string;
  update?: Record<string, unknown>;
  select?: string;
  filters: Array<[string, string, unknown]>;
};

type Result = { data?: unknown; error?: any };

const adminUser: Authed = {
  jwt: "admin-token",
  userId: "admin-1",
  email: "admin@example.test",
  role: "admin",
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
          neq(column: string, value: unknown) {
            operation.filters.push(["neq", column, value]);
            return builder;
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
  adminResults: Result[];
  userResults?: Result[];
  isApproved?: boolean;
  markJobAssignedError?: any;
  finalizeAssignment?: AssignmentFinalizer;
}) {
  const app = Fastify({ logger: false });
  const admin = createClient(options.adminResults);
  const user = createClient(options.userResults ?? [{ data: { id: "job-1", status: "assigned" }, error: null }]);
  const notifications: any[] = [];
  const auditRows: any[] = [];
  const assignedJobs: Array<{ jobId: string; nurseUserId: string }> = [];

  await registerAdminAssignmentRoute(app, {
    requireAuth: async () => adminUser,
    requireRole: (authed: Authed, roles: UserRole[]) => {
      if (!roles.includes(authed.role)) {
        throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
      }
    },
    supabaseAdmin: admin.client,
    supabaseForUser: () => user.client,
    isApprovedNurse: async () => options.isApproved ?? true,
    markJobAssigned: async (jobId: string, nurseUserId: string) => {
      assignedJobs.push({ jobId, nurseUserId });
      return { error: options.markJobAssignedError ?? null };
    },
    createNotifications: async (items: any[]) => {
      notifications.push(...items);
    },
    writeAdminAuditLog: async (row: any) => {
      auditRows.push(row);
    },
    finalizeAssignment: options.finalizeAssignment
  });

  return { app, admin, user, notifications, auditRows, assignedJobs };
}

describe("admin assignment route", () => {
  it("rejects assignment when the job is not open", async () => {
    const { app, admin, assignedJobs } = await buildApp({
      adminResults: [{ data: { id: "job-1", status: "assigned", title: "Visit" }, error: null }]
    });

    const response = await app.inject({
      method: "POST",
      url: "/admin/jobs/assign",
      payload: { jobId: "job-1", nurseUserId: "nurse-1" }
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), { error: "Invalid job transition" });
    assert.equal(admin.operations.length, 1);
    assert.deepEqual(assignedJobs, []);
    await app.close();
  });

  it("rejects assignment when the selected application is no longer applied", async () => {
    const { app, admin, assignedJobs } = await buildApp({
      adminResults: [
        { data: { id: "job-1", status: "open", title: "Visit" }, error: null },
        { data: [{ id: "app-1", nurse_user_id: "nurse-1", status: "accepted" }], error: null }
      ]
    });

    const response = await app.inject({
      method: "POST",
      url: "/admin/jobs/assign",
      payload: { jobId: "job-1", nurseUserId: "nurse-1" }
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), { error: "Application is not selectable" });
    assert.equal(admin.operations.filter((operation) => operation.update).length, 0);
    assert.deepEqual(assignedJobs, []);
    await app.close();
  });

  it("accepts and rejects only currently applied applications", async () => {
    const { app, admin, notifications, auditRows, assignedJobs } = await buildApp({
      adminResults: [
        { data: { id: "job-1", status: "open", title: "Visit" }, error: null },
        {
          data: [
            { id: "app-1", nurse_user_id: "nurse-1", status: "applied" },
            { id: "app-2", nurse_user_id: "nurse-2", status: "applied" },
            { id: "app-3", nurse_user_id: "nurse-3", status: "withdrawn" }
          ],
          error: null
        },
        {
          data: [
            { id: "app-1", nurse_user_id: "nurse-1", status: "applied" },
            { nurse_user_id: "nurse-2", status: "applied" }
          ],
          error: null
        },
        { data: { id: "app-1" }, error: null },
        { data: null, error: null }
      ]
    });

    const response = await app.inject({
      method: "POST",
      url: "/admin/jobs/assign",
      payload: { jobId: "job-1", nurseUserId: "nurse-1" }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(assignedJobs, [{ jobId: "job-1", nurseUserId: "nurse-1" }]);

    const acceptOperation = admin.operations[3];
    assert.deepEqual(acceptOperation.update, { status: "accepted" });
    assert.deepEqual(acceptOperation.filters, [
      ["eq", "id", "app-1"],
      ["eq", "status", "applied"]
    ]);

    const rejectOperation = admin.operations[4];
    assert.deepEqual(rejectOperation.update, { status: "rejected" });
    assert.deepEqual(rejectOperation.filters, [
      ["eq", "job_id", "job-1"],
      ["eq", "status", "applied"],
      ["neq", "nurse_user_id", "nurse-1"]
    ]);

    assert.deepEqual(
      notifications.map((notification) => [notification.userId, notification.type]),
      [
        ["nurse-1", "job_assigned"],
        ["nurse-2", "application_rejected"]
      ]
    );
    assert.equal(auditRows[0].action, "job_assigned");
    await app.close();
  });

  it("does not mutate applications when the guarded job assignment write fails", async () => {
    const { app, admin, notifications, auditRows, assignedJobs } = await buildApp({
      markJobAssignedError: { code: "PGRST116", message: "no rows returned" },
      adminResults: [
        { data: { id: "job-1", status: "open", title: "Visit" }, error: null },
        {
          data: [
            { id: "app-1", nurse_user_id: "nurse-1", status: "applied" },
            { id: "app-2", nurse_user_id: "nurse-2", status: "applied" }
          ],
          error: null
        },
        {
          data: [
            { id: "app-1", nurse_user_id: "nurse-1", status: "applied" },
            { id: "app-2", nurse_user_id: "nurse-2", status: "applied" }
          ],
          error: null
        }
      ]
    });

    const response = await app.inject({
      method: "POST",
      url: "/admin/jobs/assign",
      payload: { jobId: "job-1", nurseUserId: "nurse-1" }
    });

    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.json(), { error: "Unable to assign job" });
    assert.deepEqual(assignedJobs, [{ jobId: "job-1", nurseUserId: "nurse-1" }]);
    assert.equal(admin.operations.filter((operation) => operation.update).length, 0);
    assert.deepEqual(notifications, []);
    assert.deepEqual(auditRows, []);
    await app.close();
  });

  it("passes admin actor context through the assignment finalizer seam", async () => {
    const finalizerCalls: any[] = [];
    const { app, assignedJobs, auditRows } = await buildApp({
      adminResults: [
        { data: { id: "job-1", status: "open", title: "Visit" }, error: null },
        { data: [{ id: "app-1", nurse_user_id: "nurse-1", status: "applied" }], error: null }
      ],
      finalizeAssignment: async (_deps, input) => {
        finalizerCalls.push(input);
        return { error: null, category: null, finalizedByRpc: true };
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/admin/jobs/assign",
      payload: { jobId: "job-1", nurseUserId: "nurse-1" }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(assignedJobs, []);
    assert.deepEqual(auditRows, []);
    assert.deepEqual(finalizerCalls, [
      {
        jobId: "job-1",
        jobTitle: "Visit",
        selectedApplicationId: "app-1",
        selectedNurseUserId: "nurse-1",
        actorId: "admin-1",
        actorRole: "admin"
      }
    ]);
    await app.close();
  });
});
