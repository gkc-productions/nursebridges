import { NextRequest } from "next/server";
import { adminJson } from "../../../../../lib/requestId";
import { writeAdminAuditLog } from "../../../../../lib/auditLog";
import { requireAdmin } from "../../../../../lib/adminAuth";
import { createNotifications } from "../../../../../lib/notifications";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

type ApplicationRow = {
  job_id: string;
  nurse_user_id: string;
  status: string;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function notifyJobStatus(
  job: { id: string; title?: string | null; patient_user_id?: string | null },
  status: "cancelled" | "completed",
  nurseIds: string[]
) {
  const title = job.title || "Job";
  const notificationTitle = status === "cancelled" ? "Job cancelled" : "Job completed";
  const body = `${title} is now ${status}.`;

  await createNotifications([
    {
      userId: job.patient_user_id,
      type: `job_${status}`,
      title: notificationTitle,
      body,
      entityType: "job",
      entityId: job.id
    },
    ...Array.from(new Set(nurseIds)).map((nurseId) => ({
      userId: nurseId,
      type: `assigned_job_${status}`,
      title: notificationTitle,
      body,
      entityType: "job",
      entityId: job.id
    }))
  ]);
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return adminJson(request, { error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  const { data: job, error } = await supabaseAdmin
    .from("jobs")
    .select("id,status,patient_user_id,title,description,created_at")
    .eq("id", id)
    .single();

  if (error || !job) {
    return adminJson(request, { error: "not_found" }, { status: 404 });
  }

  const { data: applications, error: applicationError } = await supabaseAdmin
    .from("applications")
    .select("job_id,nurse_user_id,status,created_at")
    .eq("job_id", job.id)
    .order("created_at", { ascending: false });

  if (applicationError) {
    return adminJson(request, { error: "Unable to load job" }, { status: 400 });
  }

  const acceptedApplication = (applications ?? []).find(
    (application) => (application as ApplicationRow).status === "accepted"
  ) as ApplicationRow | undefined;
  const nurseId = acceptedApplication?.nurse_user_id ?? null;

  const { data: profiles, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name")
    .in("id", [job.patient_user_id, nurseId].filter(Boolean) as string[]);

  if (profileError) {
    return adminJson(request, { error: "Unable to load job" }, { status: 400 });
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return adminJson(request, {
    job: {
      id: job.id,
      status: job.status,
      title: job.title,
      description: job.description ?? null,
      created_at: job.created_at,
      patient_name: profileMap.get(job.patient_user_id ?? "")?.full_name ?? null,
      nurse_name: nurseId ? profileMap.get(nurseId)?.full_name ?? null : null
    },
    events: []
  });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return adminJson(request, { error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const body = (await request.json()) as { status?: string; action?: string };
  const nextStatus = body.status ?? body.action;
  if (nextStatus !== "cancelled" && nextStatus !== "completed") {
    return adminJson(request, { error: "Invalid job transition" }, { status: 400 });
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from("jobs")
    .select("id,status,patient_user_id,title")
    .eq("id", id)
    .maybeSingle();

  if (jobError) {
    return adminJson(request, { error: "Unable to update job" }, { status: 400 });
  }
  if (!job) {
    return adminJson(request, { error: "not_found" }, { status: 404 });
  }

  const { data: applications, error: applicationsError } = await supabaseAdmin
    .from("applications")
    .select("nurse_user_id,status")
    .eq("job_id", id);

  if (applicationsError) {
    return adminJson(request, { error: "Unable to update job" }, { status: 400 });
  }

  const acceptedNurseId =
    (applications ?? []).find((application) => application.status === "accepted")?.nurse_user_id ?? null;

  if (nextStatus === "cancelled") {
    if (job.status !== "open" && job.status !== "assigned") {
      return adminJson(request, { error: "Invalid job transition" }, { status: 400 });
    }

    const notifyNurseIds = (applications ?? [])
      .filter((application) => application.status === "accepted" || application.status === "applied")
      .map((application) => application.nurse_user_id as string);

    const { error: rejectError } = await supabaseAdmin
      .from("applications")
      .update({ status: "rejected" })
      .eq("job_id", id)
      .eq("status", "applied");

    if (rejectError) {
      return adminJson(request, { error: "Unable to update job" }, { status: 400 });
    }

    const { data: updatedJob, error } = await supabaseAdmin
      .from("jobs")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return adminJson(request, { error: "Unable to update job" }, { status: 400 });
    }

    await notifyJobStatus(job, "cancelled", notifyNurseIds);
    await writeAdminAuditLog({
      actor_id: auth.user.id,
      action: "job_cancelled",
      entity_type: "job",
      entity_id: id,
      metadata: { previous_status: job.status }
    });

    return adminJson(request, { job: updatedJob });
  }

  if (job.status !== "assigned" || !acceptedNurseId) {
    return adminJson(request, { error: "Invalid job transition" }, { status: 400 });
  }

  const { data: updatedJob, error } = await supabaseAdmin
    .from("jobs")
    .update({ status: "completed" })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return adminJson(request, { error: "Unable to update job" }, { status: 400 });
  }

  await notifyJobStatus(job, "completed", [acceptedNurseId as string]);
  await writeAdminAuditLog({
    actor_id: auth.user.id,
    action: "job_completed",
    entity_type: "job",
    entity_id: id,
    metadata: { previous_status: job.status, nurse_user_id: acceptedNurseId }
  });

  return adminJson(request, { job: updatedJob });
}
