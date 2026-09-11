import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  finalizeAppliedAssignmentWithRpc,
  rpcAssignmentErrorCategory
} from "../src/jobAssignmentCommand.ts";
import { isApprovedNurseWithClient, markJobAssignedWithClient } from "../src/jobAssignmentCore.ts";

type Operation = {
  table: string;
  update?: Record<string, unknown>;
  select?: string;
  filters: Array<[string, string, unknown]>;
};

function createClient(results: Array<{ data?: unknown; error?: { code?: string; message?: string } | null }>) {
  const operations: Operation[] = [];

  return {
    operations,
    client: {
      from(table: string) {
        const operation: Operation = { table, filters: [] };
        operations.push(operation);

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
            return results.shift() ?? { data: null, error: null };
          },
          single() {
            return results.shift() ?? { data: { id: "row-1" }, error: null };
          }
        };

        return builder;
      }
    }
  };
}

describe("job assignment database writes", () => {
  it("checks nurse approval using the nurse profile verification status", async () => {
    const { client, operations } = createClient([{ data: { verification_status: "approved" }, error: null }]);

    assert.equal(await isApprovedNurseWithClient(client, "nurse-1"), true);
    assert.deepEqual(operations[0], {
      table: "nurse_profiles",
      select: "verification_status",
      filters: [["eq", "nurse_id", "nurse-1"]]
    });
  });

  it("assigns a job only while the job row is still open", async () => {
    const { client, operations } = createClient([{ data: { id: "job-1" }, error: null }]);

    const result = await markJobAssignedWithClient(client, "job-1", "nurse-1");

    assert.equal(result.error, null);
    assert.deepEqual(operations[0], {
      table: "jobs",
      update: { status: "assigned", assigned_nurse_user_id: "nurse-1" },
      select: "id",
      filters: [
        ["eq", "id", "job-1"],
        ["eq", "status", "open"]
      ]
    });
  });

  it("keeps the open-status guard when falling back for older jobs schemas", async () => {
    const { client, operations } = createClient([
      { data: null, error: { code: "PGRST204", message: "missing assigned nurse column" } },
      { data: { id: "job-1" }, error: null }
    ]);

    const result = await markJobAssignedWithClient(client, "job-1", "nurse-1");

    assert.equal(result.error, null);
    assert.deepEqual(operations[1], {
      table: "jobs",
      update: { status: "assigned" },
      select: "id",
      filters: [
        ["eq", "id", "job-1"],
        ["eq", "status", "open"]
      ]
    });
  });

  it("returns an error when no open job row is updated", async () => {
    const staleJobError = { code: "PGRST116", message: "no rows returned" };
    const { client } = createClient([{ data: null, error: staleJobError }]);

    const result = await markJobAssignedWithClient(client, "job-1", "nurse-1");

    assert.equal(result.error, staleJobError);
  });

  it("calls the approved assignment RPC contract with actor context", async () => {
    const calls: any[] = [];
    const result = await finalizeAppliedAssignmentWithRpc(
      {
        supabaseAdmin: {
          rpc(name: string, args: Record<string, unknown>) {
            calls.push({ name, args });
            return { data: [{ job_id: "job-1" }], error: null };
          }
        }
      },
      {
        jobId: "job-1",
        selectedApplicationId: "app-1",
        selectedNurseUserId: "nurse-1",
        actorId: "admin-1",
        actorRole: "admin"
      }
    );

    assert.deepEqual(result, { error: null, category: null, finalizedByRpc: true });
    assert.deepEqual(calls, [
      {
        name: "finalize_applied_assignment_rpc",
        args: {
          p_job_id: "job-1",
          p_selected_application_id: "app-1",
          p_selected_nurse_user_id: "nurse-1",
          p_actor_id: "admin-1",
          p_actor_role: "admin"
        }
      }
    ]);
  });

  it("maps assignment RPC errors to the shared workflow contract", () => {
    assert.equal(rpcAssignmentErrorCategory({ code: "P0002" }), "not_found");
    assert.equal(rpcAssignmentErrorCategory({ code: "P0001" }), "invalid_transition");
    assert.equal(rpcAssignmentErrorCategory({ code: "42501" }), "forbidden");
    assert.equal(rpcAssignmentErrorCategory({ code: "40001" }), "conflict");
    assert.equal(rpcAssignmentErrorCategory({ code: "40P01" }), "conflict");
    assert.equal(rpcAssignmentErrorCategory({ code: "PGRST202" }), "storage_or_db_error");
  });

  it("does not hide an unconfigured RPC client as a transition failure", async () => {
    const result = await finalizeAppliedAssignmentWithRpc(
      { supabaseAdmin: {} },
      {
        jobId: "job-1",
        selectedApplicationId: "app-1",
        selectedNurseUserId: "nurse-1"
      }
    );

    assert.equal(result.category, "storage_or_db_error");
    assert.equal(result.error.code, "RPC_CLIENT_MISSING");
  });
});
