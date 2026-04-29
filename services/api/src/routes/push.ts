import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { looksLikeExpoPushToken } from "../push.js";
import { supabaseForUser } from "../supabase.js";

const registerPushSchema = z.object({
  expo_push_token: z.string().min(10).max(512),
  platform: z.string().max(80).optional(),
  device_name: z.string().max(160).optional()
});

function isMissingPushTokensTable(error: unknown) {
  const code = (error as any)?.code;
  return code === "PGRST205" || code === "42P01";
}

export async function pushRoutes(app: FastifyInstance) {
  app.post("/push/register", async (req, reply) => {
    const authed = await requireAuth(req);
    const body = registerPushSchema.parse(req.body ?? {});

    if (!looksLikeExpoPushToken(body.expo_push_token)) {
      return reply.code(400).send({ error: "Invalid Expo push token" });
    }

    const sb = supabaseForUser(authed.jwt);
    const { data, error } = await sb
      .from("push_tokens")
      .upsert(
        {
          user_id: authed.userId,
          expo_push_token: body.expo_push_token,
          platform: body.platform ?? null,
          device_name: body.device_name ?? null,
          last_seen_at: new Date().toISOString()
        },
        { onConflict: "user_id,expo_push_token" }
      )
      .select("id,user_id,expo_push_token,platform,device_name,last_seen_at,created_at")
      .single();

    if (error) {
      if (isMissingPushTokensTable(error)) return reply.code(503).send({ error: "Push registration unavailable" });
      return reply.code(400).send({ error: "Unable to register push token" });
    }

    return reply.send({ push_token: data });
  });

  app.get("/push/tokens", async (req, reply) => {
    const authed = await requireAuth(req);
    const sb = supabaseForUser(authed.jwt);

    const { data, error } = await sb
      .from("push_tokens")
      .select("id,expo_push_token,platform,device_name,last_seen_at,created_at")
      .eq("user_id", authed.userId)
      .order("last_seen_at", { ascending: false });

    if (error) {
      if (isMissingPushTokensTable(error)) return reply.send({ push_tokens: [] });
      return reply.code(400).send({ error: "Unable to load push tokens" });
    }

    return reply.send({ push_tokens: data ?? [] });
  });

  app.delete("/push/:token", async (req, reply) => {
    const authed = await requireAuth(req);
    const { token } = req.params as any;
    const decodedToken = decodeURIComponent(String(token ?? ""));
    const sb = supabaseForUser(authed.jwt);

    const { error } = await sb
      .from("push_tokens")
      .delete()
      .eq("user_id", authed.userId)
      .eq("expo_push_token", decodedToken);

    if (error) {
      if (isMissingPushTokensTable(error)) return reply.send({ ok: true });
      return reply.code(400).send({ error: "Unable to delete push token" });
    }

    return reply.send({ ok: true });
  });
}
