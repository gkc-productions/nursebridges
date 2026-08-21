import { NextRequest } from "next/server";
import { requireAdmin } from "../../../../lib/adminAuth";
import { adminJson } from "../../../../lib/requestId";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return adminJson(request, { error: auth.error }, { status: auth.status });

  const [{ data: signals, error }, { data: openRecovery, error: recoveryError }] = await Promise.all([
    supabaseAdmin.from("marketplace_quality_signals")
      .select("id,job_id,signal_type,severity,value_numeric,created_at")
      .order("created_at", { ascending: false }).limit(250),
    supabaseAdmin.from("operations_cases")
      .select("id,subject_id,status,priority,title,due_at")
      .eq("case_type", "service_recovery")
      .not("status", "in", "(resolved,closed)")
      .order("created_at", { ascending: false }).limit(100)
  ]);
  if (error || recoveryError) return adminJson(request, { error: "Unable to load quality operations" }, { status: 400 });
  return adminJson(request, { signals: signals ?? [], recovery_cases: openRecovery ?? [] });
}
