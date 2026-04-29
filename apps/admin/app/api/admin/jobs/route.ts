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
    .select("id,status,patient_user_id,title,description,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return adminJson(request, { error: "Unable to load jobs" }, { status: 400 });
  }

  const jobIds = (jobs ?? []).map((job: JobRow) => job.id);
  const { data: applications, error: applicationError } = await supabaseAdmin
    .from("applications")
    .select("job_id,nurse_user_id,status")
    .in("job_id", jobIds);

  if (applicationError) {
    return adminJson(request, { error: "Unable to load jobs" }, { status: 400 });
  }

  const acceptedNurseByJob = new Map<string, string>();
  for (const application of applications ?? []) {
    const row = application as ApplicationRow;
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

  const merged = (jobs ?? []).map((job: JobRow) => {
    const nurseId = acceptedNurseByJob.get(job.id) ?? null;
    const patientProfile = profileMap.get(job.patient_user_id ?? "");
    const nurseProfile = nurseId ? profileMap.get(nurseId) : undefined;
    return {
      id: job.id,
      status: job.status,
      title: job.title,
      description: job.description ?? null,
      created_at: job.created_at,
      patient_name: patientProfile?.full_name ?? null,
      nurse_name: nurseProfile?.full_name ?? null
    };
  });

  return adminJson(request, merged);
}
