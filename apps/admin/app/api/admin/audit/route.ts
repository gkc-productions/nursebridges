import { NextRequest } from "next/server";
import { requireAdmin } from "../../../../lib/adminAuth";
import { adminJson } from "../../../../lib/requestId";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return adminJson(request, { error: auth.error }, { status: auth.status });
  const url = new URL(request.url);
  const entityType = url.searchParams.get("entity_type");
  let query = supabaseAdmin.from("admin_audit_logs")
    .select("id,actor_id,action,entity_type,entity_id,metadata,created_at")
    .order("created_at", { ascending: false }).limit(250);
  if (entityType) query = query.eq("entity_type", entityType);
  const { data, error } = await query;
  if (error) return adminJson(request, { error: "Unable to load audit trail" }, { status: 400 });
  return adminJson(request, { events: data ?? [] });
}
