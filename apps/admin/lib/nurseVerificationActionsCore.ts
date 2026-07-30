type VerificationDecision = "approved" | "rejected";

type NurseVerificationDeps = {
  supabaseAdmin: any;
  createNotification(notification: any): Promise<void>;
  writeAdminAuditLog(row: any): Promise<void>;
  now(): string;
};

function routeError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

export function createNurseVerificationActions(deps: NurseVerificationDeps) {
  async function decideNurseVerification(input: {
    nurseId: string;
    actorId: string;
    decision: VerificationDecision;
    rejectionReason?: string | null;
  }) {
    const reviewedAt = deps.now();
    const { error } = await deps.supabaseAdmin
      .from("nurse_profiles")
      .update({
        verification_status: input.decision,
        verified_at: input.decision === "approved" ? reviewedAt : null,
        is_active: input.decision === "approved"
      })
      .eq("nurse_id", input.nurseId);

    if (error) {
      throw routeError("Unable to update nurse verification", 400);
    }

    await deps.supabaseAdmin
      .from("nurse_verification_documents")
      .update({
        status: input.decision,
        reviewed_by: input.actorId,
        reviewed_at: reviewedAt,
        rejection_reason: input.decision === "rejected" ? input.rejectionReason ?? null : null
      })
      .eq("nurse_user_id", input.nurseId)
      .eq("status", "pending");

    await deps.createNotification({
      userId: input.nurseId,
      type: input.decision === "approved" ? "nurse_verification_approved" : "nurse_verification_rejected",
      title: input.decision === "approved" ? "Verification approved" : "Verification rejected",
      body:
        input.decision === "approved"
          ? "Your nurse verification has been approved."
          : input.rejectionReason
            ? `Your nurse verification was rejected: ${input.rejectionReason}`
            : "Your nurse verification was rejected.",
      entityType: "nurse_profile",
      entityId: input.nurseId
    });

    await deps.writeAdminAuditLog({
      actor_id: input.actorId,
      action: "nurse_verification",
      entity_type: "nurse_profile",
      entity_id: input.nurseId,
      metadata: { status: input.decision }
    });

    return { ok: true };
  }

  return { decideNurseVerification };
}
