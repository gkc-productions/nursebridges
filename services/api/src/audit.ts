import { supabaseAdmin } from "./supabase.js";

type AuditEvent = {
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAdminAuditLog(event: AuditEvent) {
  if (!supabaseAdmin) return;

  try {
    const { error } = await supabaseAdmin.from("admin_audit_logs").insert({
      actor_id: event.actor_id,
      action: event.action,
      entity_type: event.entity_type,
      entity_id: event.entity_id ?? null,
      metadata: event.metadata ?? {}
    });

    if (error) {
      console.error("admin audit log insert failed", { action: event.action, entity_type: event.entity_type });
    }
  } catch {
    console.error("admin audit log insert threw", { action: event.action, entity_type: event.entity_type });
  }
}
