import { supabaseAdmin } from "./supabaseAdmin";
import { sendExpoPushToUser } from "./push";

type NotificationInput = {
  userId: string | null | undefined;
  type: string;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
};

export async function createNotification(input: NotificationInput) {
  if (!input.userId) return;

  try {
    const { error } = await supabaseAdmin.from("notifications").insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null
    });

    if (error) {
      console.error("notification insert failed", { type: input.type, entity_type: input.entityType });
      return;
    }

    void sendExpoPushToUser({
      userId: input.userId,
      title: input.title,
      body: input.body,
      entityType: input.entityType,
      entityId: input.entityId,
      notificationType: input.type
    }).catch((error) => {
      console.error("push notification send threw", {
        type: input.type,
        entity_type: input.entityType,
        message: error instanceof Error ? error.message : "unknown"
      });
    });
  } catch {
    console.error("notification insert threw", { type: input.type, entity_type: input.entityType });
  }
}

export async function createNotifications(inputs: NotificationInput[]) {
  await Promise.all(inputs.map((input) => createNotification(input)));
}
