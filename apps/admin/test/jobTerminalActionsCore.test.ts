import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAdminJobTerminalActions } from "../lib/jobTerminalActionsCore";

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
  const actions = createAdminJobTerminalActions({
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

describe("admin job terminal actions", () => {
  it("cancels an open job with guarded status write, notifications, and audit", async () => {
    const { actions, admin, notifications, auditRows } = createActions([
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
    ]);

    const job = await actions.cancelJobAsAdmin("job-1", "admin-1");

    assert.deepEqual(job, { id: "job-1", status: "cancelled" });

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
    assert.equal(auditRows[0].action, "job_cancelled");
  });

  it("rejects cancelling a completed job before writing", async () => {
    const { actions, admin } = createActions([
      { data: { id: "job-1", status: "completed", patient_user_id: "patient-1", title: "Visit" }, error: null }
    ]);

    await assert.rejects(() => actions.cancelJobAsAdmin("job-1", "admin-1"), {
      message: "Invalid job transition",
      statusCode: 400,
      category: "invalid_transition"
    });
    assert.equal(admin.operations.filter((operation) => operation.update).length, 0);
  });

  it("returns conflict when a cancellation stale write updates no job row", async () => {
    const { actions, admin, notifications, auditRows } = createActions([
      { data: { id: "job-1", status: "open", patient_user_id: "patient-1", title: "Visit" }, error: null },
      { data: [{ nurse_user_id: "nurse-1", status: "applied" }], error: null },
      { data: null, error: null },
      { data: null, error: { code: "PGRST116", message: "no rows returned" } }
    ]);

    await assert.rejects(() => actions.cancelJobAsAdmin("job-1", "admin-1"), {
      message: "Unable to update job",
      statusCode: 409,
      category: "conflict"
    });
    assert.equal(admin.operations.filter((operation) => operation.update).length, 2);
    assert.deepEqual(notifications, []);
    assert.deepEqual(auditRows, []);
  });

  it("completes an assigned job with guarded status write, notifications, and audit", async () => {
    const { actions, admin, notifications, auditRows } = createActions([
      { data: { id: "job-1", status: "assigned", patient_user_id: "patient-1", title: "Visit" }, error: null },
      { data: [{ nurse_user_id: "nurse-1", status: "accepted" }], error: null },
      { data: { id: "job-1", status: "completed" }, error: null }
    ]);

    const job = await actions.completeJobAsAdmin("job-1", "admin-1");

    assert.deepEqual(job, { id: "job-1", status: "completed" });

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
    assert.deepEqual(auditRows[0].metadata, { previous_status: "assigned", nurse_user_id: "nurse-1" });
  });

  it("rejects completing without an accepted nurse before writing", async () => {
    const { actions, admin } = createActions([
      { data: { id: "job-1", status: "assigned", patient_user_id: "patient-1", title: "Visit" }, error: null },
      { data: [{ nurse_user_id: "nurse-1", status: "applied" }], error: null }
    ]);

    await assert.rejects(() => actions.completeJobAsAdmin("job-1", "admin-1"), {
      message: "Invalid job transition",
      statusCode: 400,
      category: "invalid_transition"
    });
    assert.equal(admin.operations.filter((operation) => operation.update).length, 0);
  });

  it("returns conflict when a completion stale write updates no job row", async () => {
    const { actions, notifications, auditRows } = createActions([
      { data: { id: "job-1", status: "assigned", patient_user_id: "patient-1", title: "Visit" }, error: null },
      { data: [{ nurse_user_id: "nurse-1", status: "accepted" }], error: null },
      { data: null, error: { code: "PGRST116", message: "no rows returned" } }
    ]);

    await assert.rejects(() => actions.completeJobAsAdmin("job-1", "admin-1"), {
      message: "Unable to update job",
      statusCode: 409,
      category: "conflict"
    });
    assert.deepEqual(notifications, []);
    assert.deepEqual(auditRows, []);
  });
});
