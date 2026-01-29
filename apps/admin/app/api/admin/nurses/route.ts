import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/adminAuth";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type NurseRow = {
  nurse_id: string;
  license_number: string | null;
  verified: boolean | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: nurseRows, error } = await supabaseAdmin
    .from("nurse_profiles")
    .select("nurse_id,license_number,verified,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const nurseIds = (nurseRows ?? []).map((row) => row.nurse_id).filter(Boolean);

  const { data: profiles, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name,phone")
    .in("id", nurseIds);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const merged = (nurseRows ?? []).map((row: NurseRow) => {
    const profile = profileMap.get(row.nurse_id);
    return {
      id: row.nurse_id,
      license_number: row.license_number ?? null,
      verified: row.verified ?? false,
      profile_name: profile?.full_name ?? null,
      profile_phone: profile?.phone ?? null,
      created_at: row.created_at
    };
  });

  return NextResponse.json(merged);
}
