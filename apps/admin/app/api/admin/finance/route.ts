import { NextRequest } from "next/server";
import { requireAdmin } from "../../../../lib/adminAuth";
import { writeAdminAuditLog } from "../../../../lib/auditLog";
import { adminJson } from "../../../../lib/requestId";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

const ledgerEnabled = process.env.COMMERCIAL_LEDGER_ENABLED === "true";

async function canAccessFinance(adminUserId: string) {
  const [{ count }, { data: member }] = await Promise.all([
    supabaseAdmin.from("admin_team_members").select("admin_user_id", { count: "exact", head: true }).eq("active", true),
    supabaseAdmin.from("admin_team_members").select("operations_role,active").eq("admin_user_id", adminUserId).maybeSingle()
  ]);
  return (count ?? 0) === 0 || Boolean(member?.active && ["finance", "supervisor"].includes(member.operations_role));
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return adminJson(request, { error: auth.error }, { status: auth.status });
  if (!await canAccessFinance(auth.user.id)) return adminJson(request, { error: "Active finance or supervisor role required" }, { status: 403 });
  const [quotes, earnings, requests] = await Promise.all([
    supabaseAdmin.from("care_quotes").select("id,job_id,version,currency,patient_total_cents,included_minutes,overtime_increment_minutes,overtime_increment_cents,status,patient_authorized_at,created_at").order("created_at", { ascending: false }).limit(250),
    supabaseAdmin.from("nurse_earning_records").select("id,job_id,nurse_user_id,quote_id,currency,guaranteed_cents,adjustment_cents,status,available_at,paid_at,created_at").order("created_at", { ascending: false }).limit(250),
    supabaseAdmin.from("jobs").select("id,title,status,start_time,assigned_nurse_user_id").in("status", ["open", "assigned"]).order("created_at", { ascending: false }).limit(250)
  ]);
  if (quotes.error || earnings.error || requests.error) return adminJson(request, { error: "Unable to load finance ledger" }, { status: 400 });
  return adminJson(request, { ledger_enabled: ledgerEnabled, payment_processing_enabled: false, quotes: quotes.data ?? [], earnings: earnings.data ?? [], requests: requests.data ?? [] });
}
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return adminJson(request, { error: auth.error }, { status: auth.status });
  if (!await canAccessFinance(auth.user.id)) return adminJson(request, { error: "Active finance or supervisor role required" }, { status: 403 });
  if (!ledgerEnabled) return adminJson(request, { error: "Commercial ledger writes are disabled pending legal and operational approval" }, { status: 423 });
  const body = await request.json() as Record<string, unknown>;
  const jobId = String(body.job_id ?? "");
  const patientTotalCents = Number(body.patient_total_cents);
  const includedMinutes = Number(body.included_minutes);
  const guaranteedCents = Number(body.guaranteed_cents);
  const overtimeIncrementCents = Number(body.overtime_increment_cents ?? 0);
  if (!jobId || !Number.isInteger(patientTotalCents) || patientTotalCents < 0 || !Number.isInteger(includedMinutes) || includedMinutes < 30 || !Number.isInteger(guaranteedCents) || guaranteedCents < 0 || guaranteedCents > patientTotalCents || !Number.isInteger(overtimeIncrementCents) || overtimeIncrementCents < 0) {
    return adminJson(request, { error: "Invalid quote amounts or duration" }, { status: 400 });
  }
  const { data: job } = await supabaseAdmin.from("jobs").select("id,assigned_nurse_user_id").eq("id", jobId).maybeSingle();
  if (!job) return adminJson(request, { error: "Care request not found" }, { status: 404 });
  const { data: latest } = await supabaseAdmin.from("care_quotes").select("version").eq("job_id", jobId).order("version", { ascending: false }).limit(1).maybeSingle();
  const { data: quote, error } = await supabaseAdmin.from("care_quotes").insert({
    job_id: jobId, version: (latest?.version ?? 0) + 1, patient_total_cents: patientTotalCents,
    included_minutes: includedMinutes, overtime_increment_minutes: 30,
    overtime_increment_cents: overtimeIncrementCents, status: "draft", created_by_user_id: auth.user.id
  }).select("*").single();
  if (error) return adminJson(request, { error: "Unable to create quote draft" }, { status: 400 });
  if (job.assigned_nurse_user_id) {
    await supabaseAdmin.from("nurse_earning_records").upsert({ job_id: jobId, nurse_user_id: job.assigned_nurse_user_id, quote_id: quote.id, guaranteed_cents: guaranteedCents, status: "estimated" }, { onConflict: "job_id,nurse_user_id" });
  }
  await writeAdminAuditLog({ actor_id: auth.user.id, action: "commercial_quote_drafted", entity_type: "job", entity_id: jobId, metadata: { quote_id: quote.id, version: quote.version } });
  return adminJson(request, { quote }, { status: 201 });
}
