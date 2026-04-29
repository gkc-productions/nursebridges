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

  const { error: acceptError } = await supabaseAdmin
    .from("applications")
    .update({ status: "accepted" })
    .eq("job_id", body.job_id)
    .eq("nurse_user_id", body.nurse_id);

  if (acceptError) {
    return NextResponse.json({ error: acceptError.message }, { status: 400 });
  }

  const { error: rejectError } = await supabaseAdmin
    .from("applications")
    .update({ status: "rejected" })
    .eq("job_id", body.job_id)
    .neq("nurse_user_id", body.nurse_id);

  if (rejectError) {
    return NextResponse.json({ error: rejectError.message }, { status: 400 });
  }

  const { error: jobUpdateError } = await supabaseAdmin
    .from("jobs")
    .update({ status: "assigned" })
    .eq("id", body.job_id);

  if (jobUpdateError) {
    return NextResponse.json({ error: jobUpdateError.message }, { status: 400 });
  }

  await supabaseAdmin.from("admin_audit_logs").insert({
    actor_id: auth.user.id,
    action: "job_assigned",
    entity_type: "job",
    entity_id: body.job_id,
    metadata: { nurse_user_id: body.nurse_id }
  });

  return NextResponse.json({ ok: true });
}
