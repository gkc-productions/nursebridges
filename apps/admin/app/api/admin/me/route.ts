import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/adminAuth";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({
    id: auth.user.id,
    email: auth.user.email,
    role: auth.profile.role,
    full_name: auth.profile.full_name
  });
}
