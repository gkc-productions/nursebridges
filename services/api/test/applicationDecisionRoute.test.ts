import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Fastify from "fastify";
import { registerApplicationDecisionRoute } from "../src/routes/applicationDecisionRoute.ts";
import type { Authed, UserRole } from "../src/auth.ts";
import type { AssignmentFinalizer } from "../src/jobAssignmentCommand.ts";

type Operation = {
  table: string;
  update?: Record<string, unknown>;
  select?: string;
  filters: Array<[string, string, unknown]>;
};

type Result = { data?: unknown; error?: any };

const patientUser: Authed = {
  jwt: "patient-token",
  userId: "patient-1",
  email: "patient@example.test",
  role: "patient",
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
          maybeSingle() {
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
  isApproved?: boolean;
  markJobAssignedError?: any;
  finalizeAssignment?: AssignmentFinalizer;
}) {
  const app = Fastify({ logger: false });
  const admin = createClient(options.adminResults);
  const notifications: any[] = [];
  const assignedJobs: Array<{ jobId: string; nurseUserId: string }> = [];
  const auditRows: any[] = [];

  await registerApplicationDecisionRoute(app, {
    requireAuth: async () => patientUser,
    requireRole: (authed: Authed, roles: UserRole[]) => {
      if (!roles.includes(authed.role)) {
        throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
      }
    },
    supabaseAdmin: admin.client,
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

  return { app, admin, notifications, assignedJobs, auditRows };
}

describe("application decision route", () => {
  it("rejects decisions for applications that are no longer applied", async () => {
    const { app, admin, assignedJobs } = await buildApp({
      adminResults: [
        {
          data: { id: "app-1", job_id: "job-1", nurse_user_id: "nurse-1", status: "accepted" },
          error: null
        }
      ]
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/applications/app-1/decide",
      payload: { decision: "accept" }
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), { error: "Application is not selectable" });
    assert.equal(admin.operations.filter((operation) => operation.update).length, 0);
    assert.deepEqual(assignedJobs, []);
    await app.close();
  });

  it("rejects accepting an application for another patient's job", async () => {
    const { app, admin, assignedJobs } = await buildApp({
      adminResults: [
        {
          data: { id: "app-1", job_id: "job-1", nurse_user_id: "nurse-1", status: "applied" },
          error: null
        },
        { data: { id: "job-1", status: "open", patient_user_id: "patient-2" }, error: null }
      ]
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/applications/app-1/decide",
      payload: { decision: "accept" }
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.json(), { error: "Forbidden" });
    assert.equal(admin.operations.filter((operation) => operation.update).length, 0);
    assert.deepEqual(assignedJobs, []);
    await app.close();
  });

  it("rejects accepting an application when the job is no longer open", async () => {
    const { app, admin, assignedJobs } = await buildApp({
      adminResults: [
        {
          data: { id: "app-1", job_id: "job-1", nurse_user_id: "nurse-1", status: "applied" },
          error: null
        },
        { data: { id: "job-1", status: "assigned", patient_user_id: "patient-1" }, error: null }
      ]
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/applications/app-1/decide",
      payload: { decision: "accept" }
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), { error: "Invalid job transition" });
    assert.equal(admin.operations.filter((operation) => operation.update).length, 0);
    assert.deepEqual(assignedJobs, []);
    await app.close();
  });

  it("accepts and rejects only currently applied applications", async () => {
    const { app, admin, notifications, assignedJobs, auditRows } = await buildApp({
      adminResults: [
        {
          data: { id: "app-1", job_id: "job-1", nurse_user_id: "nurse-1", status: "applied" },
          error: null
        },
        { data: { id: "job-1", status: "open", patient_user_id: "patient-1", title: "Morning care" }, error: null },
        {
          data: [
            { id: "app-1", nurse_user_id: "nurse-1", status: "applied" },
            { nurse_user_id: "nurse-2", status: "applied" }
          ],
          error: null
        },
        { data: { id: "app-1", status: "accepted" }, error: null },
        { data: null, error: null }
      ]
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/applications/app-1/decide",
      payload: { decision: "accept" }
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
    assert.equal(auditRows[0].action, "application_decision");
    assert.equal(auditRows[0].entity_type, "application");
    assert.equal(auditRows[0].entity_id, "app-1");
    assert.deepEqual(auditRows[0].metadata, {
      decision: "accept",
      status: "accepted",
      job_id: "job-1",
      nurse_user_id: "nurse-1"
    });
    await app.close();
  });

  it("does not mutate applications when accepting cannot claim the open job", async () => {
    const { app, admin, notifications, assignedJobs, auditRows } = await buildApp({
      markJobAssignedError: { code: "PGRST116", message: "no rows returned" },
      adminResults: [
        {
          data: { id: "app-1", job_id: "job-1", nurse_user_id: "nurse-1", status: "applied" },
          error: null
        },
        { data: { id: "job-1", status: "open", patient_user_id: "patient-1" }, error: null },
        { data: [{ id: "app-1", nurse_user_id: "nurse-1", status: "applied" }], error: null }
      ]
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/applications/app-1/decide",
      payload: { decision: "accept" }
    });

    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.json(), { error: "Unable to decide application" });
    assert.deepEqual(assignedJobs, [{ jobId: "job-1", nurseUserId: "nurse-1" }]);
    assert.equal(admin.operations.filter((operation) => operation.update).length, 0);
    assert.deepEqual(notifications, []);
    assert.deepEqual(auditRows, []);
    await app.close();
  });

  it("audits patient application rejection after the application update succeeds", async () => {
    const { app, admin, notifications, assignedJobs, auditRows } = await buildApp({
      adminResults: [
        {
          data: { id: "app-1", job_id: "job-1", nurse_user_id: "nurse-1", status: "applied" },
          error: null
        },
        { data: { id: "job-1", status: "open", patient_user_id: "patient-1" }, error: null },
        { data: { id: "app-1", status: "rejected" }, error: null }
      ]
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/applications/app-1/decide",
      payload: { decision: "reject" }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(assignedJobs, []);
    assert.deepEqual(notifications, []);

    const rejectOperation = admin.operations[2];
    assert.deepEqual(rejectOperation.update, { status: "rejected" });
    assert.deepEqual(rejectOperation.filters, [
      ["eq", "id", "app-1"],
      ["eq", "status", "applied"]
    ]);
    assert.equal(auditRows[0].action, "application_decision");
    assert.deepEqual(auditRows[0].metadata, {
      decision: "reject",
      status: "rejected",
      job_id: "job-1",
      nurse_user_id: "nurse-1"
    });
    await app.close();
  });

  it("passes patient actor context through the assignment finalizer seam", async () => {
    const finalizerCalls: any[] = [];
    const { app, assignedJobs } = await buildApp({
      adminResults: [
        {
          data: { id: "app-1", job_id: "job-1", nurse_user_id: "nurse-1", status: "applied" },
          error: null
        },
        { data: { id: "job-1", status: "open", patient_user_id: "patient-1", title: "Morning care" }, error: null }
      ],
      finalizeAssignment: async (_deps, input) => {
        finalizerCalls.push(input);
        return { error: null, category: null };
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/applications/app-1/decide",
      payload: { decision: "accept" }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(assignedJobs, []);
    assert.deepEqual(finalizerCalls, [
      {
        jobId: "job-1",
        jobTitle: "Morning care",
        selectedApplicationId: "app-1",
        selectedNurseUserId: "nurse-1",
        actorId: "patient-1",
        actorRole: "patient"
      }
    ]);
    await app.close();
  });
});
