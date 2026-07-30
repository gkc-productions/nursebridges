import { NextRequest } from "next/server";
import { requireAdmin } from "../../../../../lib/adminAuth";
import { createAdminJobAssignmentActions } from "../../../../../lib/jobAssignmentActionsCore";
import { writeAdminAuditLog } from "../../../../../lib/auditLog";
import { createNotifications } from "../../../../../lib/notifications";
import { adminJson } from "../../../../../lib/requestId";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

const actions = createAdminJobAssignmentActions({
  supabaseAdmin,
  createNotifications,
  writeAdminAuditLog
});

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return adminJson(request, { error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as { job_id: string; nurse_id: string };

  try {
    const result = await actions.assignJobAsAdmin({
      jobId: body.job_id,
      nurseId: body.nurse_id,
      actorId: auth.user.id
    });

    return adminJson(request, result);
  } catch (error) {
    const statusCode = typeof (error as any)?.statusCode === "number" ? (error as any).statusCode : 500;
    const message = error instanceof Error ? error.message : "Unable to assign job";
    return adminJson(request, { error: message }, { status: statusCode });
  }
}
