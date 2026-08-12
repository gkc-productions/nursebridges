import { NextRequest } from "next/server";
import { adminJson } from "../../../../lib/requestId";
import { requireAdmin } from "../../../../lib/adminAuth";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type JobRow = Record<string, any>;

type ApplicationRow = {
  job_id: string;
  nurse_user_id: string;
  status: string;
};

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return adminJson(request, { error: auth.error }, { status: auth.status });
  }

  const { data: jobs, error } = await supabaseAdmin
    .from("jobs")
    .select("id,status,patient_user_id,title,description,address,service_city,service_state,start_time,hourly_rate,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return adminJson(request, { error: "Unable to load jobs" }, { status: 400 });
  }

  const jobIds = (jobs ?? []).map((job: JobRow) => job.id);
  if (jobIds.length === 0) {
    return adminJson(request, []);
  }

  const { data: applications, error: applicationError } = await supabaseAdmin
    .from("applications")
    .select("job_id,nurse_user_id,status")
    .in("job_id", jobIds);

  if (applicationError) {
    return adminJson(request, { error: "Unable to load jobs" }, { status: 400 });
  }

  const acceptedNurseByJob = new Map<string, string>();
  const applicantCountByJob = new Map<string, number>();
  for (const application of applications ?? []) {
    const row = application as ApplicationRow;
    if (row.status === "applied" || row.status === "accepted") {
      applicantCountByJob.set(row.job_id, (applicantCountByJob.get(row.job_id) ?? 0) + 1);
    }
    if (row.status === "accepted" && !acceptedNurseByJob.has(row.job_id)) {
      acceptedNurseByJob.set(row.job_id, row.nurse_user_id);
    }
  }

  const patientIds = (jobs ?? [])
    .map((job: JobRow) => job.patient_user_id)
    .filter(Boolean) as string[];
  const nurseIds = Array.from(new Set(Array.from(acceptedNurseByJob.values()).filter(Boolean)));
  const allIds = Array.from(new Set([...patientIds, ...nurseIds]));

  const { data: profiles, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name")
    .in("id", allIds);

  if (profileError) {
    return adminJson(request, { error: "Unable to load jobs" }, { status: 400 });
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const identityLabels = new Map<string, string>();
  await Promise.all(allIds.map(async (profileId) => {
    const profile = profileMap.get(profileId);
    if (profile?.full_name) {
      identityLabels.set(profileId, profile.full_name);
      return;
    }
    const { data } = await supabaseAdmin.auth.admin.getUserById(profileId);
    if (data?.user?.email) identityLabels.set(profileId, data.user.email);
  }));

  const merged = (jobs ?? []).map((job: JobRow) => {
    const nurseId = acceptedNurseByJob.get(job.id) ?? null;
    return {
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
      applicant_count: applicantCountByJob.get(job.id) ?? 0,
      patient_name: identityLabels.get(job.patient_user_id ?? "") ?? null,
      nurse_name: nurseId ? identityLabels.get(nurseId) ?? null : null
    };
  });

  return adminJson(request, merged);
}
