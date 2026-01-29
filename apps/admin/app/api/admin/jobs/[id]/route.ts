import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/adminAuth";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

type ApplicationRow = {
  job_id: string;
  nurse_user_id: string;
  status: string;
};

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: job, error } = await supabaseAdmin
    .from("jobs")
    .select("id,status,patient_user_id,title,description,created_at")
    .eq("id", params.id)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: applications, error: applicationError } = await supabaseAdmin
    .from("applications")
    .select("job_id,nurse_user_id,status,created_at")
    .eq("job_id", job.id)
    .order("created_at", { ascending: false });

  if (applicationError) {
    return NextResponse.json({ error: applicationError.message }, { status: 400 });
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
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return NextResponse.json({
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
