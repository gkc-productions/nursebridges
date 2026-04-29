import { NextRequest } from "next/server";
import { adminJson } from "../../../../../../lib/requestId";
import { requireAdmin } from "../../../../../../lib/adminAuth";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return adminJson(request, { error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from("nurse_verification_documents")
    .select("id,nurse_user_id,storage_bucket,storage_path,document_type,status,reviewed_by,reviewed_at,rejection_reason,created_at")
    .eq("nurse_user_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    const code = (error as any).code;
    if (code === "PGRST205" || code === "42P01") return adminJson(request, { documents: [] });
    return adminJson(request, { error: "Unable to load verification documents" }, { status: 400 });
  }

  return adminJson(request, { documents: data ?? [] });
}
