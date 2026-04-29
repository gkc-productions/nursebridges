import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/adminAuth";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as { nurse_id: string; status: "approved" | "rejected" };

  const { error } = await supabaseAdmin
    .from("nurse_profiles")
    .update({
      verification_status: body.status,
      verified_at: body.status === "approved" ? new Date().toISOString() : null,
      is_active: body.status === "approved"
    })
    .eq("nurse_id", body.nurse_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await supabaseAdmin.from("admin_audit_logs").insert({
    actor_id: auth.user.id,
    action: "nurse_verification",
    entity_type: "nurse_profile",
    entity_id: body.nurse_id,
    metadata: { status: body.status }
  });

  return NextResponse.json({ ok: true });
}
