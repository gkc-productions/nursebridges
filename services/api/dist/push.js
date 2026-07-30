import { supabaseAdmin } from "./supabase.js";
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_BATCH_SIZE = 100;
function chunk(items, size) {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}
function isMissingPushTokensTable(error) {
    const code = error?.code;
    return code === "PGRST205" || code === "42P01";
}
export function looksLikeExpoPushToken(token) {
    return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
}
export async function sendExpoPushToUser(input) {
    if (!supabaseAdmin || !input.userId)
        return;
    const { data: tokenRows, error } = await supabaseAdmin
        .from("push_tokens")
        .select("expo_push_token")
        .eq("user_id", input.userId);
    if (error) {
        if (!isMissingPushTokensTable(error)) {
            console.error("push destination lookup failed", { user_id: input.userId, code: error.code });
        }
        return;
    }
    const tokens = Array.from(new Set((tokenRows ?? []).map((row) => row.expo_push_token).filter(looksLikeExpoPushToken)));
    if (tokens.length === 0)
        return;
    const messages = tokens.map((token) => ({
        to: token,
        title: input.title,
        body: input.body ?? undefined,
        data: {
            entity_type: input.entityType ?? null,
            entity_id: input.entityId ?? null,
            notification_type: input.notificationType ?? null
        }
    }));
    for (const batch of chunk(messages, EXPO_PUSH_BATCH_SIZE)) {
        try {
            const res = await fetch(EXPO_PUSH_URL, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(batch)
            });
            const text = await res.text();
            if (!res.ok) {
                console.error("expo push send failed", { status: res.status });
                continue;
            }
            let payload = null;
            try {
                payload = text ? JSON.parse(text) : null;
            }
            catch {
                payload = null;
            }
            const tickets = Array.isArray(payload?.data) ? payload.data : payload?.data ? [payload.data] : [];
            const failedTickets = tickets.filter((ticket) => ticket?.status === "error");
            if (failedTickets.length > 0) {
                console.error("expo push tickets returned errors", {
                    count: failedTickets.length,
                    errors: failedTickets.map((ticket) => ticket?.details?.error ?? ticket?.message).slice(0, 5)
                });
            }
        }
        catch (error) {
            console.error("expo push send threw", { message: error instanceof Error ? error.message : "unknown" });
        }
    }
}
