import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth.js";
import { createNotifications } from "../notifications.js";
import { supabaseAdmin, supabaseForUser } from "../supabase.js";
import { jobMessageSchema } from "../validators.js";

type Participant = { userId: string; role: string };

async function loadMessageParticipants(jobId: string): Promise<Participant[]> {
  if (!supabaseAdmin) return [];
  const [{ data: job }, { data: accepted }] = await Promise.all([
    supabaseAdmin.from("jobs").select("patient_user_id").eq("id", jobId).maybeSingle(),
    supabaseAdmin.from("applications").select("nurse_user_id").eq("job_id", jobId).eq("status", "accepted").maybeSingle()
  ]);
  return [
    job?.patient_user_id ? { userId: job.patient_user_id as string, role: "patient" } : null,
    accepted?.nurse_user_id ? { userId: accepted.nurse_user_id as string, role: "nurse" } : null
  ].filter((participant): participant is Participant => Boolean(participant));
}

async function labelMessageSenders(rows: Array<Record<string, unknown>>, requestingUserId: string) {
  const ids = Array.from(new Set(rows.map((row) => String(row.sender_user_id))));
  const names = new Map<string, string>();
  if (supabaseAdmin && ids.length > 0) {
    const { data } = await supabaseAdmin.from("profiles").select("id,full_name").in("id", ids);
    for (const profile of data ?? []) {
      if (profile.full_name) names.set(profile.id as string, profile.full_name as string);
    }
  }
  return rows.map((row) => ({
    ...row,
    sender_label: row.sender_user_id === requestingUserId ? "You" : names.get(String(row.sender_user_id)) ?? "Care team"
  }));
}

export async function patientJourneyRoutes(app: FastifyInstance) {
  app.get("/jobs/:jobId/messages", async (req, reply) => {
    const authed = await requireAuth(req);
    const { jobId } = req.params as { jobId: string };
    const sb = supabaseForUser(authed.jwt);
    const { data, error } = await sb
      .from("job_messages")
      .select("id,job_id,sender_user_id,body,created_at")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(200);
    if (error) return reply.code(400).send({ error: "Unable to load request messages" });
    return reply.send({ messages: await labelMessageSenders((data ?? []) as Array<Record<string, unknown>>, authed.userId) });
  });

  app.post("/jobs/:jobId/messages", async (req, reply) => {
    const authed = await requireAuth(req);
    const { jobId } = req.params as { jobId: string };
    const body = jobMessageSchema.parse(req.body ?? {});
    const sb = supabaseForUser(authed.jwt);
    const { data, error } = await sb.from("job_messages").insert({
      job_id: jobId,
      sender_user_id: authed.userId,
      body: body.body,
      ...(body.client_message_id ? { client_message_id: body.client_message_id } : {})
    }).select("id,job_id,sender_user_id,body,created_at").single();
    if (error?.code === "23505") return reply.code(409).send({ error: "Message was already sent" });
    if (error) return reply.code(400).send({ error: "Unable to send request message" });

    const recipients = (await loadMessageParticipants(jobId)).filter((participant) => participant.userId !== authed.userId);
    void createNotifications(recipients.map((participant) => ({
      userId: participant.userId,
      type: "job_message",
      title: "New care request message",
      body: participant.role === "patient" ? "Your care team sent an update." : "The patient sent a coordination update.",
      entityType: "job",
      entityId: jobId
    })));

    return reply.code(201).send({ message: (await labelMessageSenders([data as Record<string, unknown>], authed.userId))[0] });
  });

  app.get("/jobs/:jobId/trusted-nurse", async (req, reply) => {
    const authed = await requireAuth(req);
    const { jobId } = req.params as { jobId: string };
    const sb = supabaseForUser(authed.jwt);
    const { data: visibleJob, error: visibleJobError } = await sb.from("jobs").select("id").eq("id", jobId).maybeSingle();
    if (visibleJobError || !visibleJob) return reply.code(404).send({ error: "Care request not found" });
    if (!supabaseAdmin) return reply.code(503).send({ error: "Nurse profile is temporarily unavailable" });

    const { data: accepted } = await supabaseAdmin
      .from("applications")
      .select("nurse_user_id")
      .eq("job_id", jobId)
      .eq("status", "accepted")
      .maybeSingle();
    if (!accepted?.nurse_user_id) return reply.send({ nurse: null });

    const [{ data: profile }, { data: nurseProfile }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,full_name").eq("id", accepted.nurse_user_id).maybeSingle(),
      supabaseAdmin.from("nurse_profiles")
        .select("nurse_id,specialty,years_experience,bio,license_state,verification_status,verified_at")
        .eq("nurse_id", accepted.nurse_user_id)
        .maybeSingle()
    ]);
    if (!nurseProfile || nurseProfile.verification_status !== "approved") {
      return reply.code(409).send({ error: "Assigned nurse verification is incomplete" });
    }
    return reply.send({
      nurse: {
        id: nurseProfile.nurse_id,
        display_name: profile?.full_name ?? "Your assigned nurse",
        specialty: nurseProfile.specialty,
        years_experience: nurseProfile.years_experience,
        bio: nurseProfile.bio,
        license_state: nurseProfile.license_state,
        verification_status: nurseProfile.verification_status,
        verified_at: nurseProfile.verified_at
      }
    });
  });
}
