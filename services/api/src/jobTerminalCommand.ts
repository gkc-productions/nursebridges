import type { TerminalJobStatus, WorkflowErrorCategory } from "./jobWorkflow.js";

export type FinalizeTerminalJobInput = {
  jobId: string;
  actorId: string;
  actorRole: string;
  expectedStatus: string;
  nextStatus: TerminalJobStatus;
};

export type FinalizeTerminalJobResult =
  | { data: any; error: null; category: null }
  | { data: null; error: any; category: WorkflowErrorCategory };

function errorText(error: any) {
  return String(error?.message ?? error?.details ?? error?.hint ?? "");
}

export function rpcTerminalJobErrorCategory(error: any): WorkflowErrorCategory {
  const code = String(error?.code ?? "");
  const text = errorText(error);

  if (text.includes("job_not_found")) return "not_found";
  if (
    text.includes("invalid_terminal_status") ||
    text.includes("invalid_job_transition") ||
    text.includes("accepted_nurse_required")
  ) {
    return "invalid_transition";
  }
  if (code === "42501") return "forbidden";
  if (text.includes("terminal_conflict") || code === "40001" || code.startsWith("40")) return "conflict";
  if (code === "P0002") return "not_found";
  if (code === "P0001") return "invalid_transition";

  return "storage_or_db_error";
}

export async function finalizeTerminalJobWithRpc(
  deps: { supabaseAdmin: any },
  input: FinalizeTerminalJobInput
): Promise<FinalizeTerminalJobResult> {
  if (!deps.supabaseAdmin?.rpc) {
    return {
      data: null,
      error: { code: "RPC_CLIENT_MISSING", message: "Supabase RPC client not configured" },
      category: "storage_or_db_error"
    };
  }

  const { data, error } = await deps.supabaseAdmin.rpc("finalize_terminal_job_rpc", {
    p_job_id: input.jobId,
    p_actor_id: input.actorId,
    p_actor_role: input.actorRole,
    p_expected_status: input.expectedStatus,
    p_next_status: input.nextStatus
  });

  if (error) {
    return { data: null, error, category: rpcTerminalJobErrorCategory(error) };
  }

  return { data, error: null, category: null };
}
