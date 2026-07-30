import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  finalizeTerminalJobWithRpc,
  rpcTerminalJobErrorCategory
} from "../src/jobTerminalCommand.ts";

describe("job terminal RPC finalizer contract", () => {
  it("calls the approved terminal job RPC contract with actor and transition context", async () => {
    const calls: any[] = [];
    const result = await finalizeTerminalJobWithRpc(
      {
        supabaseAdmin: {
          rpc(name: string, args: Record<string, unknown>) {
            calls.push({ name, args });
            return { data: { id: "job-1", status: "cancelled" }, error: null };
          }
        }
      },
      {
        jobId: "job-1",
        actorId: "admin-1",
        actorRole: "admin",
        expectedStatus: "open",
        nextStatus: "cancelled"
      }
    );

    assert.deepEqual(result, { data: { id: "job-1", status: "cancelled" }, error: null, category: null });
    assert.deepEqual(calls, [
      {
        name: "finalize_terminal_job_rpc",
        args: {
          p_job_id: "job-1",
          p_actor_id: "admin-1",
          p_actor_role: "admin",
          p_expected_status: "open",
          p_next_status: "cancelled"
        }
      }
    ]);
  });

  it("maps terminal job RPC errors to the shared workflow contract", () => {
    assert.equal(rpcTerminalJobErrorCategory({ code: "P0001", message: "job_not_found" }), "not_found");
    assert.equal(rpcTerminalJobErrorCategory({ code: "P0001", message: "invalid_terminal_status" }), "invalid_transition");
    assert.equal(rpcTerminalJobErrorCategory({ code: "P0001", message: "invalid_job_transition" }), "invalid_transition");
    assert.equal(rpcTerminalJobErrorCategory({ code: "P0001", message: "accepted_nurse_required" }), "invalid_transition");
    assert.equal(rpcTerminalJobErrorCategory({ code: "40001", message: "terminal_conflict" }), "conflict");
    assert.equal(rpcTerminalJobErrorCategory({ code: "40P01" }), "conflict");
    assert.equal(rpcTerminalJobErrorCategory({ code: "42501" }), "forbidden");
    assert.equal(rpcTerminalJobErrorCategory({ code: "PGRST202" }), "storage_or_db_error");
  });

  it("does not hide an unconfigured terminal RPC client as a transition failure", async () => {
    const result = await finalizeTerminalJobWithRpc(
      { supabaseAdmin: {} },
      {
        jobId: "job-1",
        actorId: "admin-1",
        actorRole: "admin",
        expectedStatus: "assigned",
        nextStatus: "completed"
      }
    );

    assert.equal(result.data, null);
    assert.equal(result.category, "storage_or_db_error");
    assert.equal(result.error.code, "RPC_CLIENT_MISSING");
  });
});
