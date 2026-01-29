import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/adminAuth";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as { job_id: string; nurse_id: string };

  const { data: job, error: jobError } = await supabaseAdmin
    .from("jobs")
    .select("id")
    .eq("id", body.job_id)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: jobError?.message ?? "job_not_found" }, { status: 400 });
  }

  const { error: applicationError } = await supabaseAdmin
    .from("applications")
    .upsert(
      {
        job_id: body.job_id,
        nurse_user_id: body.nurse_id,
        status: "accepted"
      },
      { onConflict: "job_id,nurse_user_id" }
    );

  if (applicationError) {
    return NextResponse.json({ error: applicationError.message }, { status: 400 });
  }

  const { error: jobUpdateError } = await supabaseAdmin
    .from("jobs")
    .update({ status: "assigned" })
    .eq("id", body.job_id);

  if (jobUpdateError) {
    return NextResponse.json({ error: jobUpdateError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
