import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAdminJobAssignmentActions } from "../lib/jobAssignmentActionsCore";

type Operation = {
  table: string;
  select?: string;
  update?: Record<string, unknown>;
  filters: Array<[string, string, unknown]>;
};

type Result = { data?: unknown; error?: any };

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

function createActions(results: Result[]) {
  const admin = createClient(results);
  const notifications: any[] = [];
  const auditRows: any[] = [];
  const actions = createAdminJobAssignmentActions({
    supabaseAdmin: admin.client,
    createNotifications: async (items: any[]) => {
      notifications.push(...items);
    },
    writeAdminAuditLog: async (row: any) => {
      auditRows.push(row);
    }
  });

  return { actions, admin, notifications, auditRows };
}

describe("admin job assignment actions", () => {
  it("rejects assignment when the job is not open", async () => {
    const { actions, admin } = createActions([
      { data: { id: "job-1", status: "assigned", title: "Visit" }, error: null }
    ]);

    await assert.rejects(
      () => actions.assignJobAsAdmin({ jobId: "job-1", nurseId: "nurse-1", actorId: "admin-1" }),
      { message: "Invalid job transition", statusCode: 400, category: "invalid_transition" }
    );
    assert.equal(admin.operations.filter((operation) => operation.update).length, 0);
  });

  it("rejects assignment when the selected application is no longer applied", async () => {
    const { actions, admin } = createActions([
      { data: { id: "job-1", status: "open", title: "Visit" }, error: null },
      { data: { verification_status: "approved" }, error: null },
      { data: [{ id: "app-1", nurse_user_id: "nurse-1", status: "accepted" }], error: null }
    ]);

    await assert.rejects(
      () => actions.assignJobAsAdmin({ jobId: "job-1", nurseId: "nurse-1", actorId: "admin-1" }),
      { message: "Application is not selectable", statusCode: 400, category: "invalid_transition" }
    );
    assert.equal(admin.operations.filter((operation) => operation.update).length, 0);
  });

  it("accepts, rejects, assigns open jobs, notifies, and audits", async () => {
    const { actions, admin, notifications, auditRows } = createActions([
      { data: { id: "job-1", status: "open", title: "Visit" }, error: null },
      { data: { verification_status: "approved" }, error: null },
      {
        data: [
          { id: "app-1", nurse_user_id: "nurse-1", status: "applied" },
          { id: "app-2", nurse_user_id: "nurse-2", status: "applied" },
          { id: "app-3", nurse_user_id: "nurse-3", status: "withdrawn" }
        ],
        error: null
      },
      { data: { id: "job-1" }, error: null },
      { data: { id: "app-1" }, error: null },
      { data: null, error: null }
    ]);

    const result = await actions.assignJobAsAdmin({ jobId: "job-1", nurseId: "nurse-1", actorId: "admin-1" });

    assert.deepEqual(result, { ok: true });

    const assignOperation = admin.operations[3];
    assert.deepEqual(assignOperation.update, { status: "assigned", assigned_nurse_user_id: "nurse-1" });
    assert.deepEqual(assignOperation.filters, [
      ["eq", "id", "job-1"],
      ["eq", "status", "open"]
    ]);

    const acceptOperation = admin.operations[4];
    assert.deepEqual(acceptOperation.update, { status: "accepted" });
    assert.deepEqual(acceptOperation.filters, [
      ["eq", "job_id", "job-1"],
      ["eq", "nurse_user_id", "nurse-1"],
      ["eq", "status", "applied"]
    ]);

    const rejectOperation = admin.operations[5];
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
    assert.deepEqual(auditRows[0].metadata, { nurse_user_id: "nurse-1" });
  });

  it("does not mutate applications when the guarded job assignment write fails", async () => {
    const { actions, admin, notifications, auditRows } = createActions([
      { data: { id: "job-1", status: "open", title: "Visit" }, error: null },
      { data: { verification_status: "approved" }, error: null },
      {
        data: [
          { id: "app-1", nurse_user_id: "nurse-1", status: "applied" },
          { id: "app-2", nurse_user_id: "nurse-2", status: "applied" }
        ],
        error: null
      },
      { data: null, error: { code: "PGRST116", message: "no rows returned" } }
    ]);

    await assert.rejects(
      () => actions.assignJobAsAdmin({ jobId: "job-1", nurseId: "nurse-1", actorId: "admin-1" }),
      { message: "Unable to assign job", statusCode: 409, category: "conflict" }
    );

    const updateOperations = admin.operations.filter((operation) => operation.update);
    assert.equal(updateOperations.length, 1);
    assert.deepEqual(updateOperations[0].update, { status: "assigned", assigned_nurse_user_id: "nurse-1" });
    assert.deepEqual(notifications, []);
    assert.deepEqual(auditRows, []);
  });
});
