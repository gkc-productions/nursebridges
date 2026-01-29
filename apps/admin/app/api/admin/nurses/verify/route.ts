import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/adminAuth";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as { nurse_id: string; verified: boolean };

  const { error } = await supabaseAdmin
    .from("nurse_profiles")
    .update({ verified: body.verified })
    .eq("nurse_id", body.nurse_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
