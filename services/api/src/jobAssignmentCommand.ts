import { createAssignmentCommandPlan, type WorkflowErrorCategory } from "./jobWorkflow.js";

export type AssignmentCommandDeps = {
  supabaseAdmin: any;
  markJobAssigned(jobId: string, nurseUserId: string): Promise<{ error: any }>;
  createNotifications(notifications: any[]): Promise<void>;
};

export type FinalizeAppliedAssignmentInput = {
  jobId: string;
  jobTitle?: string | null;
  selectedApplicationId: string;
  selectedNurseUserId: string;
  patientUserId?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
};

export type FinalizeAppliedAssignmentResult =
  | { error: null; category: null; finalizedByRpc?: boolean }
  | { error: any; category: WorkflowErrorCategory; finalizedByRpc?: boolean };

export type AssignmentFinalizer = (
  deps: AssignmentCommandDeps,
  input: FinalizeAppliedAssignmentInput
) => Promise<FinalizeAppliedAssignmentResult>;

function persistenceErrorCategory(error: any): WorkflowErrorCategory {
  return error?.code === "PGRST116" ? "conflict" : "storage_or_db_error";
}

export function rpcAssignmentErrorCategory(error: any): WorkflowErrorCategory {
  const code = String(error?.code ?? "");

  if (code === "P0002") return "not_found";
  if (code === "P0001") return "invalid_transition";
  if (code === "42501") return "forbidden";
  if (code === "40001" || code.startsWith("40")) return "conflict";

  return "storage_or_db_error";
}

export async function finalizeAppliedAssignmentWithRpc(
  deps: Pick<AssignmentCommandDeps, "supabaseAdmin">,
  input: FinalizeAppliedAssignmentInput
): Promise<FinalizeAppliedAssignmentResult> {
  if (!deps.supabaseAdmin?.rpc) {
    return {
      error: { code: "RPC_CLIENT_MISSING", message: "Supabase RPC client not configured" },
      category: "storage_or_db_error"
    };
  }

  const { error } = await deps.supabaseAdmin.rpc("finalize_applied_assignment_rpc", {
    p_job_id: input.jobId,
    p_selected_application_id: input.selectedApplicationId,
    p_selected_nurse_user_id: input.selectedNurseUserId,
    p_actor_id: input.actorId ?? null,
    p_actor_role: input.actorRole ?? null
  });

  if (error) {
    return { error, category: rpcAssignmentErrorCategory(error) };
  }

  return { error: null, category: null, finalizedByRpc: true };
}

export async function finalizeAppliedAssignment(
  deps: AssignmentCommandDeps,
  input: FinalizeAppliedAssignmentInput
): Promise<FinalizeAppliedAssignmentResult> {
  const { data: appliedApplications, error: appliedApplicationsError } = await deps.supabaseAdmin
    .from("applications")
    .select("id,nurse_user_id,status")
    .eq("job_id", input.jobId)
    .eq("status", "applied");

  if (appliedApplicationsError) {
    return { error: appliedApplicationsError, category: persistenceErrorCategory(appliedApplicationsError) };
  }

  const assignmentPlan = createAssignmentCommandPlan({
    applications: appliedApplications ?? [],
    jobId: input.jobId,
    jobTitle: input.jobTitle,
    selectedNurseUserId: input.selectedNurseUserId,
    patientUserId: input.patientUserId
  });

  if (!assignmentPlan.selectedApplication || !assignmentPlan.selectedApplicationSelectable) {
    return { error: { code: "PGRST116", message: "selected application is not applied" }, category: "conflict" };
  }

  const { error: jobUpdateError } = await deps.markJobAssigned(input.jobId, input.selectedNurseUserId);
  if (jobUpdateError) {
    return { error: jobUpdateError, category: persistenceErrorCategory(jobUpdateError) };
  }

  const { error: acceptError } = await deps.supabaseAdmin
    .from("applications")
    .update({ status: "accepted" })
    .eq("id", input.selectedApplicationId)
    .eq("status", "applied")
    .select("id")
    .single();

  if (acceptError) {
    return { error: acceptError, category: persistenceErrorCategory(acceptError) };
  }

  if (assignmentPlan.rejectCompetingApplications) {
    const { error: rejectError } = await deps.supabaseAdmin
      .from("applications")
      .update({ status: "rejected" })
      .eq("job_id", input.jobId)
      .eq("status", "applied")
      .neq("nurse_user_id", input.selectedNurseUserId);

    if (rejectError) {
      return { error: rejectError, category: persistenceErrorCategory(rejectError) };
    }
  }

  await deps.createNotifications(assignmentPlan.notifications);

  return { error: null, category: null };
}
