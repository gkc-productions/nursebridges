import { NextRequest } from "next/server";
import { adminJson } from "../../../../../lib/requestId";
import { writeAdminAuditLog } from "../../../../../lib/auditLog";
import { requireAdmin } from "../../../../../lib/adminAuth";
import { createNotifications } from "../../../../../lib/notifications";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

async function isApprovedNurse(nurseId: string) {
  const { data } = await supabaseAdmin
    .from("nurse_profiles")
    .select("verification_status")
    .eq("nurse_id", nurseId)
    .maybeSingle();

  return data?.verification_status === "approved";
}

function isTerminalJobStatus(status: string) {
  return status === "cancelled" || status === "completed";
}

async function markJobAssigned(jobId: string, nurseId: string) {
  const withAssignedColumn = await supabaseAdmin
    .from("jobs")
    .update({ status: "assigned", assigned_nurse_user_id: nurseId })
    .eq("id", jobId);

  if (!withAssignedColumn.error) return { error: null };

  const code = (withAssignedColumn.error as any).code;
  if (code !== "PGRST204" && code !== "42703") {
    return { error: withAssignedColumn.error };
  }

  const statusOnly = await supabaseAdmin.from("jobs").update({ status: "assigned" }).eq("id", jobId);
  return { error: statusOnly.error };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return adminJson(request, { error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as { job_id: string; nurse_id: string };

  const { data: job, error: jobError } = await supabaseAdmin
    .from("jobs")
    .select("id,status,title")
    .eq("id", body.job_id)
    .single();

  if (jobError || !job) {
    return adminJson(request, { error: "job_not_found" }, { status: 404 });
  }
  if (isTerminalJobStatus(job.status)) {
    return adminJson(request, { error: "Invalid job transition" }, { status: 400 });
  }
  if (!(await isApprovedNurse(body.nurse_id))) {
    return adminJson(request, { error: "Nurse verification required" }, { status: 403 });
  }

  const { data: applications, error: applicationsError } = await supabaseAdmin
    .from("applications")
    .select("id,status,nurse_user_id")
    .eq("job_id", body.job_id);

  if (applicationsError) {
    return adminJson(request, { error: "Unable to assign job" }, { status: 400 });
  }

  const application = (applications ?? []).find((row) => row.nurse_user_id === body.nurse_id);
  if (!application) {
    return adminJson(request, { error: "Nurse has not applied to this job" }, { status: 400 });
  }

  const rejectedNurseIds = (applications ?? [])
    .filter((row) => row.nurse_user_id !== body.nurse_id && row.status !== "rejected")
    .map((row) => row.nurse_user_id as string)
    .filter(Boolean);

  const { error: acceptError } = await supabaseAdmin
    .from("applications")
    .update({ status: "accepted" })
    .eq("job_id", body.job_id)
    .eq("nurse_user_id", body.nurse_id);

  if (acceptError) {
    return adminJson(request, { error: "Unable to assign job" }, { status: 400 });
  }

  const { error: rejectError } = await supabaseAdmin
    .from("applications")
    .update({ status: "rejected" })
    .eq("job_id", body.job_id)
    .neq("nurse_user_id", body.nurse_id);

  if (rejectError) {
    return adminJson(request, { error: "Unable to assign job" }, { status: 400 });
  }

  const { error: jobUpdateError } = await markJobAssigned(body.job_id, body.nurse_id);

  if (jobUpdateError) {
    return adminJson(request, { error: "Unable to assign job" }, { status: 400 });
  }

  const jobTitle = job.title || "Job";
  await createNotifications([
    {
      userId: body.nurse_id,
      type: "job_assigned",
      title: "Job assigned",
      body: `${jobTitle} has been assigned to you.`,
      entityType: "job",
      entityId: body.job_id
    },
    ...rejectedNurseIds.map((nurseId) => ({
      userId: nurseId,
      type: "application_rejected",
      title: "Application not selected",
      body: `${jobTitle} was assigned to another nurse.`,
      entityType: "job",
      entityId: body.job_id
    }))
  ]);

  await writeAdminAuditLog({
    actor_id: auth.user.id,
    action: "job_assigned",
    entity_type: "job",
    entity_id: body.job_id,
    metadata: { nurse_user_id: body.nurse_id }
  });

  return adminJson(request, { ok: true });
}
