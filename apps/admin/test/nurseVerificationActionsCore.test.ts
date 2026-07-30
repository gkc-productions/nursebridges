import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createNurseVerificationActions } from "../lib/nurseVerificationActionsCore";

type Operation = {
  table: string;
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
          update(value: Record<string, unknown>) {
            operation.update = value;
            return builder;
          },
          eq(column: string, value: unknown) {
            operation.filters.push(["eq", column, value]);
            return builder;
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
  const actions = createNurseVerificationActions({
    supabaseAdmin: admin.client,
    createNotification: async (notification: any) => {
      notifications.push(notification);
    },
    writeAdminAuditLog: async (row: any) => {
      auditRows.push(row);
    },
    now: () => "2026-07-17T09:45:00.000Z"
  });

  return { actions, admin, notifications, auditRows };
}

describe("admin nurse verification actions", () => {
  it("approves a nurse, clears document rejection reason, notifies, and audits", async () => {
    const { actions, admin, notifications, auditRows } = createActions([
      { data: null, error: null },
      { data: null, error: null }
    ]);

    const result = await actions.decideNurseVerification({
      nurseId: "nurse-1",
      actorId: "admin-1",
      decision: "approved"
    });

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(admin.operations[0], {
      table: "nurse_profiles",
      update: {
        verification_status: "approved",
        verified_at: "2026-07-17T09:45:00.000Z",
        is_active: true
      },
      filters: [["eq", "nurse_id", "nurse-1"]]
    });
    assert.deepEqual(admin.operations[1], {
      table: "nurse_verification_documents",
      update: {
        status: "approved",
        reviewed_by: "admin-1",
        reviewed_at: "2026-07-17T09:45:00.000Z",
        rejection_reason: null
      },
      filters: [
        ["eq", "nurse_user_id", "nurse-1"],
        ["eq", "status", "pending"]
      ]
    });
    assert.equal(notifications[0].type, "nurse_verification_approved");
    assert.equal(auditRows[0].action, "nurse_verification");
    assert.deepEqual(auditRows[0].metadata, { status: "approved" });
  });

  it("rejects a nurse with reason, deactivates profile, notifies, and audits", async () => {
    const { actions, admin, notifications, auditRows } = createActions([
      { data: null, error: null },
      { data: null, error: null }
    ]);

    await actions.decideNurseVerification({
      nurseId: "nurse-1",
      actorId: "admin-1",
      decision: "rejected",
      rejectionReason: "License image is unreadable."
    });

    assert.deepEqual(admin.operations[0].update, {
      verification_status: "rejected",
      verified_at: null,
      is_active: false
    });
    assert.deepEqual(admin.operations[1].update, {
      status: "rejected",
      reviewed_by: "admin-1",
      reviewed_at: "2026-07-17T09:45:00.000Z",
      rejection_reason: "License image is unreadable."
    });
    assert.equal(notifications[0].type, "nurse_verification_rejected");
    assert.match(notifications[0].body, /License image is unreadable/);
    assert.deepEqual(auditRows[0].metadata, { status: "rejected" });
  });

  it("stops before document updates, notifications, or audit when profile update fails", async () => {
    const { actions, admin, notifications, auditRows } = createActions([
      { data: null, error: { message: "update failed" } }
    ]);

    await assert.rejects(
      () =>
        actions.decideNurseVerification({
          nurseId: "nurse-1",
          actorId: "admin-1",
          decision: "approved"
        }),
      { message: "Unable to update nurse verification", statusCode: 400 }
    );
    assert.equal(admin.operations.length, 1);
    assert.deepEqual(notifications, []);
    assert.deepEqual(auditRows, []);
  });
});
