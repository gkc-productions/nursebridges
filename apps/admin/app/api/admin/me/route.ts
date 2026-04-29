import { NextRequest } from "next/server";
import { adminJson } from "../../../../lib/requestId";
import { requireAdmin } from "../../../../lib/adminAuth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return adminJson(request, { error: auth.error }, { status: auth.status });
  }

  return adminJson(request, {
    id: auth.user.id,
    email: auth.user.email,
    role: auth.profile.role,
    full_name: auth.profile.full_name
  });
}
