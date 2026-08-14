import { NextRequest } from "next/server";
import { requireAdmin } from "../../../../../../lib/adminAuth";
import { adminJson } from "../../../../../../lib/requestId";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return adminJson(request, { error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const body = await request.json() as { mode?: string };
  const mode = body.mode === "editing" ? "editing" : "viewing";
  const expiresAt = new Date(Date.now() + 90_000).toISOString();
  const { error } = await supabaseAdmin.from("operations_case_presence").upsert({ case_id: id, admin_user_id: auth.user.id, mode, expires_at: expiresAt, updated_at: new Date().toISOString() }, { onConflict: "case_id,admin_user_id" });
  if (error) return adminJson(request, { error: "Unable to update case presence" }, { status: 400 });
  return adminJson(request, { mode, expires_at: expiresAt });
}
