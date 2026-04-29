import { requireAuth } from "../auth.js";
import { supabaseForUser } from "../supabase.js";
function isMissingNotificationsTable(error) {
    const code = error?.code;
    return code === "PGRST205" || code === "42P01";
}
export async function notificationRoutes(app) {
    app.get("/notifications", async (req, reply) => {
        const authed = await requireAuth(req);
        const sb = supabaseForUser(authed.jwt);
        const { data, error } = await sb
            .from("notifications")
            .select("id,type,title,body,entity_type,entity_id,read_at,created_at")
            .eq("user_id", authed.userId)
            .order("created_at", { ascending: false })
            .limit(100);
        if (error) {
            if (isMissingNotificationsTable(error))
                return reply.send({ notifications: [] });
            return reply.code(400).send({ error: "Unable to load notifications" });
        }
        return reply.send({ notifications: data ?? [] });
    });
    app.post("/notifications/:id/read", async (req, reply) => {
        const authed = await requireAuth(req);
        const { id } = req.params;
        const sb = supabaseForUser(authed.jwt);
        const { data, error } = await sb
            .from("notifications")
            .update({ read_at: new Date().toISOString() })
            .eq("id", id)
            .eq("user_id", authed.userId)
            .select("id,type,title,body,entity_type,entity_id,read_at,created_at")
            .maybeSingle();
        if (error) {
            if (isMissingNotificationsTable(error))
                return reply.code(404).send({ error: "Notification not found" });
            return reply.code(400).send({ error: "Unable to update notification" });
        }
        if (!data)
            return reply.code(404).send({ error: "Notification not found" });
        return reply.send({ notification: data });
    });
    app.post("/notifications/read-all", async (req, reply) => {
        const authed = await requireAuth(req);
        const sb = supabaseForUser(authed.jwt);
        const { error } = await sb
            .from("notifications")
            .update({ read_at: new Date().toISOString() })
            .eq("user_id", authed.userId)
            .is("read_at", null);
        if (error) {
            if (isMissingNotificationsTable(error))
                return reply.send({ ok: true });
            return reply.code(400).send({ error: "Unable to update notifications" });
        }
        return reply.send({ ok: true });
    });
}
