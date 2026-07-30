import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { markJobCancelledWithClient, markJobCompletedWithClient } from "../src/jobStatusCore.ts";

type Operation = {
  table: string;
  update?: Record<string, unknown>;
  select?: string;
  filters: Array<[string, string, unknown]>;
};

function createClient(result: { data?: unknown; error?: any }) {
  const operations: Operation[] = [];

  return {
    operations,
    client: {
      from(table: string) {
        const operation: Operation = { table, filters: [] };
        operations.push(operation);

        const builder = {
          update(value: Record<string, unknown>) {
            operation.update = value;
            return builder;
          },
          eq(column: string, value: unknown) {
            operation.filters.push(["eq", column, value]);
            return builder;
          },
          select(columns: string) {
            operation.select = columns;
            return builder;
          },
          single() {
            return result;
          }
        };

        return builder;
      }
    }
  };
}

describe("job status database writes", () => {
  it("cancels a job only if it still has the checked status", async () => {
    const { client, operations } = createClient({ data: { id: "job-1", status: "cancelled" }, error: null });

    const result = await markJobCancelledWithClient(client, "job-1", "assigned");

    assert.deepEqual(result, { data: { id: "job-1", status: "cancelled" }, error: null });
    assert.deepEqual(operations[0], {
      table: "jobs",
      update: { status: "cancelled" },
      select: "*",
      filters: [
        ["eq", "id", "job-1"],
        ["eq", "status", "assigned"]
      ]
    });
  });

  it("returns the database error when a stale cancel write updates no row", async () => {
    const staleWriteError = { code: "PGRST116", message: "no rows returned" };
    const { client } = createClient({ data: null, error: staleWriteError });

    const result = await markJobCancelledWithClient(client, "job-1", "open");

    assert.equal(result.error, staleWriteError);
  });

  it("completes a job only if it is still assigned", async () => {
    const { client, operations } = createClient({ data: { id: "job-1", status: "completed" }, error: null });

    const result = await markJobCompletedWithClient(client, "job-1", "assigned");

    assert.deepEqual(result, { data: { id: "job-1", status: "completed" }, error: null });
    assert.deepEqual(operations[0], {
      table: "jobs",
      update: { status: "completed" },
      select: "*",
      filters: [
        ["eq", "id", "job-1"],
        ["eq", "status", "assigned"]
      ]
    });
  });

  it("returns the database error when a stale complete write updates no row", async () => {
    const staleWriteError = { code: "PGRST116", message: "no rows returned" };
    const { client } = createClient({ data: null, error: staleWriteError });

    const result = await markJobCompletedWithClient(client, "job-1", "assigned");

    assert.equal(result.error, staleWriteError);
  });
});
