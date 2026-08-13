import { NextRequest } from "next/server";
import { adminJson } from "../../../../../lib/requestId";
import { requireAdmin } from "../../../../../lib/adminAuth";
import { cancelJobAsAdmin, completeJobAsAdmin } from "../../../../../lib/jobTerminalActions";
import { buildJobTimeline, resolveAssignedNurseId } from "../../../../../lib/jobDetailView";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

type ApplicationRow = {
  job_id: string;
  nurse_user_id: string;
  status: string;
  created_at: string;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return adminJson(request, { error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  const { data: job, error } = await supabaseAdmin
    .from("jobs")
    .select("id,status,patient_user_id,title,description,address,service_city,service_state,start_time,hourly_rate,created_at,updated_at")
    .eq("id", id)
    .single();

  if (error || !job) {
    return adminJson(request, { error: "not_found" }, { status: 404 });
  }

  const { data: logistics, error: logisticsError } = await supabaseAdmin
    .from("job_logistics")
    .select("residence_type,street_address,unit,building_name,city,state,postal_code,stairs,elevator_available,meeting_point,parking_notes,arrival_instructions,mobility_aids,mobility_notes,onsite_contact_name,onsite_contact_relationship,onsite_contact_phone,transportation_mode,transportation_provider,pickup_time,return_plan,transportation_notes")
    .eq("job_id", job.id)
    .maybeSingle();

  if (logisticsError) {
    return adminJson(request, { error: "Unable to load private job logistics" }, { status: 400 });
  }

  const { data: applications, error: applicationError } = await supabaseAdmin
    .from("applications")
    .select("job_id,nurse_user_id,status,created_at")
    .eq("job_id", job.id)
    .order("created_at", { ascending: false });

  if (applicationError) {
    return adminJson(request, { error: "Unable to load job" }, { status: 400 });
  }

  const nurseId = resolveAssignedNurseId(
    job,
    (applications ?? []) as ApplicationRow[]
  );

  const applicantIds = (applications ?? []).map((application) => application.nurse_user_id).filter(Boolean);
  const profileIds = Array.from(new Set([job.patient_user_id, nurseId, ...applicantIds].filter(Boolean) as string[]));

  const { data: profiles, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name")
    .in("id", profileIds);

  if (profileError) {
    return adminJson(request, { error: "Unable to load job" }, { status: 400 });
  }

  const { data: nurseProfiles, error: nurseProfileError } =
    applicantIds.length > 0
      ? await supabaseAdmin
          .from("nurse_profiles")
          .select("nurse_id,verification_status")
          .in("nurse_id", applicantIds)
      : { data: [], error: null };

  if (nurseProfileError) {
    return adminJson(request, { error: "Unable to load job" }, { status: 400 });
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const nurseProfileMap = new Map((nurseProfiles ?? []).map((profile) => [profile.nurse_id, profile]));
  const identityLabels = new Map<string, string>();
  await Promise.all(profileIds.map(async (profileId) => {
    const profile = profileMap.get(profileId);
    if (profile?.full_name) {
      identityLabels.set(profileId, profile.full_name);
      return;
    }
    const { data } = await supabaseAdmin.auth.admin.getUserById(profileId);
    if (data?.user?.email) identityLabels.set(profileId, data.user.email);
  }));

  const [
    { data: auditEvents },
    { data: visitEvents, error: visitEventsError },
    { data: visitReport, error: visitReportError },
    { data: feedback, error: feedbackError },
    { data: careCircle, error: careCircleError }
  ] = await Promise.all([
    supabaseAdmin
      .from("admin_audit_logs")
      .select("id,action,actor_id,created_at")
      .eq("entity_type", "job")
      .eq("entity_id", job.id)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("visit_events")
      .select("id,event_type,occurred_at,patient_visible,note")
      .eq("job_id", job.id)
      .order("occurred_at", { ascending: true }),
    supabaseAdmin.from("visit_reports").select("status,visit_summary,provider_instructions,follow_up_tasks,transportation_outcome,submitted_at,updated_at").eq("job_id", job.id).maybeSingle(),
    supabaseAdmin.from("patient_visit_feedback").select("rating,comments,would_rebook,prefer_same_nurse,updated_at").eq("job_id", job.id).maybeSingle(),
    supabaseAdmin.from("care_circle_recipients").select("id,display_name,relationship,receive_milestones,receive_summary,consented_at,revoked_at").eq("patient_user_id", job.patient_user_id).is("revoked_at", null)
  ]);

  if (visitEventsError || visitReportError || feedbackError || careCircleError) {
    return adminJson(request, { error: "Unable to load visit operations" }, { status: 400 });
  }

  const patientName = identityLabels.get(job.patient_user_id ?? "") ?? null;
  const nurseName = nurseId ? identityLabels.get(nurseId) ?? null : null;

  return adminJson(request, {
    job: {
      id: job.id,
      status: job.status,
      title: job.title,
      description: job.description ?? null,
      address: job.address ?? null,
      service_city: job.service_city ?? null,
      service_state: job.service_state ?? null,
      start_time: job.start_time ?? null,
      hourly_rate: job.hourly_rate ?? null,
      created_at: job.created_at,
      updated_at: job.updated_at ?? null,
      patient_name: patientName,
      nurse_user_id: nurseId,
      nurse_name: nurseName,
      logistics: logistics ?? null
    },
    applications: (applications ?? []).map((application) => {
      const row = application as ApplicationRow;
      const profile = profileMap.get(row.nurse_user_id);
      const nurseProfile = nurseProfileMap.get(row.nurse_user_id);
      return {
        job_id: row.job_id,
        nurse_user_id: row.nurse_user_id,
        nurse_name: identityLabels.get(row.nurse_user_id) ?? null,
        status: row.status,
        verification_status: nurseProfile?.verification_status ?? "pending",
        created_at: row.created_at
      };
    }),
    events: buildJobTimeline({
      job,
      auditEvents: auditEvents ?? [],
      identityLabels,
      patientName
    }),
    visit: {
      events: visitEvents ?? [],
      report: visitReport ?? null,
      feedback: feedback ?? null,
      care_circle: careCircle ?? []
    }
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

  try {
    const job =
      nextStatus === "cancelled"
        ? await cancelJobAsAdmin(id, auth.user.id)
        : await completeJobAsAdmin(id, auth.user.id);

    return adminJson(request, { job });
  } catch (error) {
    const statusCode = typeof (error as any)?.statusCode === "number" ? (error as any).statusCode : 500;
    const message = error instanceof Error ? error.message : "Unable to update job";
    return adminJson(request, { error: message }, { status: statusCode });
  }
}
