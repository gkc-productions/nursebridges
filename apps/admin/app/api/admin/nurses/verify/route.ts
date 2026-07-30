import { NextRequest } from "next/server";
import { requireAdmin } from "../../../../../lib/adminAuth";
import { writeAdminAuditLog } from "../../../../../lib/auditLog";
import { createNotification } from "../../../../../lib/notifications";
import { createNurseVerificationActions } from "../../../../../lib/nurseVerificationActionsCore";
import { adminJson } from "../../../../../lib/requestId";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

const actions = createNurseVerificationActions({
  supabaseAdmin,
  createNotification,
  writeAdminAuditLog,
  now: () => new Date().toISOString()
});

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return adminJson(request, { error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as {
    nurse_id: string;
    status?: "approved" | "rejected";
    decision?: "approved" | "rejected";
    rejection_reason?: string;
  };
  const decision = body.decision ?? body.status;
  if (decision !== "approved" && decision !== "rejected") {
    return adminJson(request, { error: "Invalid verification decision" }, { status: 400 });
  }

  try {
    const result = await actions.decideNurseVerification({
      nurseId: body.nurse_id,
      actorId: auth.user.id,
      decision,
      rejectionReason: body.rejection_reason
    });

    return adminJson(request, result);
  } catch (error) {
    const statusCode = typeof (error as any)?.statusCode === "number" ? (error as any).statusCode : 500;
    const message = error instanceof Error ? error.message : "Unable to update nurse verification";
    return adminJson(request, { error: message }, { status: statusCode });
  }
}
