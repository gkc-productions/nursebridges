import { NextRequest } from "next/server";
import { adminJson } from "../../../../lib/requestId";
import { requireAdmin } from "../../../../lib/adminAuth";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return adminJson(request, { error: auth.error }, { status: auth.status });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name,phone,role,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return adminJson(request, { error: "Unable to load users" }, { status: 400 });
  }

  return adminJson(request, data ?? []);
}
