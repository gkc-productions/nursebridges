import { NextRequest } from "next/server";
import { adminJson } from "../../../../lib/requestId";
import { requireAdmin } from "../../../../lib/adminAuth";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type NurseRow = {
  nurse_id: string;
  license_number: string | null;
  verification_status: string | null;
  verified_at: string | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return adminJson(request, { error: auth.error }, { status: auth.status });
  }

  const { data: nurseRows, error } = await supabaseAdmin
    .from("nurse_profiles")
    .select("nurse_id,license_number,verification_status,verified_at,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return adminJson(request, { error: "Unable to load nurses" }, { status: 400 });
  }

  const nurseIds = (nurseRows ?? []).map((row) => row.nurse_id).filter(Boolean);

  const { data: profiles, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name,phone")
    .in("id", nurseIds);

  if (profileError) {
    return adminJson(request, { error: "Unable to load nurses" }, { status: 400 });
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const merged = (nurseRows ?? []).map((row: NurseRow) => {
    const profile = profileMap.get(row.nurse_id);
    return {
      id: row.nurse_id,
      license_number: row.license_number ?? null,
      verified: row.verification_status === "approved",
      verification_status: row.verification_status ?? "pending",
      verified_at: row.verified_at,
      profile_name: profile?.full_name ?? null,
      profile_phone: profile?.phone ?? null,
      created_at: row.created_at
    };
  });

  return adminJson(request, merged);
}
