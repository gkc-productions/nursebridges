import { NextRequest } from "next/server";
import { requireAdmin } from "../../../../lib/adminAuth";
import { adminJson } from "../../../../lib/requestId";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return adminJson(request, { error: auth.error }, { status: auth.status });
  const { data: plans, error } = await supabaseAdmin.from("recurring_care_plans")
    .select("id,patient_user_id,source_job_id,preferred_nurse_user_id,cadence,starts_on,ends_on,local_time,timezone,status,occurrences_limit,created_at,updated_at")
    .order("created_at", { ascending: false }).limit(250);
  if (error) return adminJson(request, { error: "Unable to load recurring care plans" }, { status: 400 });
  const userIds = Array.from(new Set((plans ?? []).flatMap((plan) => [plan.patient_user_id, plan.preferred_nurse_user_id].filter(Boolean)))) as string[];
  const { data: profiles } = userIds.length ? await supabaseAdmin.from("profiles").select("id,full_name").in("id", userIds) : { data: [] };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  return adminJson(request, {
    plans: (plans ?? []).map((plan) => ({
      ...plan,
      patient_name: names.get(plan.patient_user_id) ?? "Patient",
      preferred_nurse_name: plan.preferred_nurse_user_id ? names.get(plan.preferred_nurse_user_id) ?? "Preferred nurse" : null
    }))
  });
}
