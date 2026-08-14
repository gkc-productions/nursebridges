import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../auth.js";
import { canRecordVisitEvent, canSubmitPatientFeedback, canSubmitVisitReport, type VisitEventType } from "../jobWorkflow.js";
import { supabaseForUser } from "../supabase.js";
import { careCircleRecipientSchema, patientFeedbackSchema, visitEventSchema, visitReportSchema } from "../validators.js";

export async function visitCoordinationRoutes(app: FastifyInstance) {
  app.get("/care-circle", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["patient"]);
    const sb = supabaseForUser(authed.jwt);
    const { data, error } = await sb.from("care_circle_recipients")
      .select("id,job_id,display_name,relationship,email,phone,receive_milestones,receive_summary,consented_at,invitation_status,invitation_expires_at,accepted_at,last_invited_at,delivery_status")
      .eq("patient_user_id", authed.userId)
      .is("revoked_at", null)
      .order("created_at");
    if (error) return reply.code(400).send({ error: "Unable to load care circle" });
    const now = Date.now();
    return reply.send({
      recipients: (data ?? []).map((recipient) => ({
        ...recipient,
        invitation_status: recipient.invitation_status === "pending" && new Date(recipient.invitation_expires_at).getTime() <= now
          ? "expired"
          : recipient.invitation_status
      }))
    });
  });

  app.post("/care-circle", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["patient"]);
    const body = careCircleRecipientSchema.parse(req.body ?? {});
    const sb = supabaseForUser(authed.jwt);
    const now = new Date();
    const { data, error } = await sb.from("care_circle_recipients").insert({
      ...body,
      patient_user_id: authed.userId,
      invitation_status: "pending",
      invitation_expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      last_invited_at: now.toISOString(),
      delivery_status: "not_sent"
    }).select("id,job_id,display_name,relationship,email,phone,receive_milestones,receive_summary,consented_at,invitation_status,invitation_expires_at,accepted_at,last_invited_at,delivery_status").single();
    if (error) return reply.code(400).send({ error: "Unable to add care-circle recipient" });
    return reply.code(201).send({
      recipient: data,
      delivery: {
        status: "not_sent",
        detail: "Consent is saved. The invitation will not share updates until delivery and acceptance are enabled."
      }
    });
  });

  app.delete("/care-circle/:recipientId", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["patient"]);
    const { recipientId } = req.params as { recipientId: string };
    const sb = supabaseForUser(authed.jwt);
    const { data, error } = await sb.from("care_circle_recipients")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", recipientId)
      .eq("patient_user_id", authed.userId)
      .select("id")
      .maybeSingle();
    if (error) return reply.code(400).send({ error: "Unable to revoke recipient" });
    if (!data) return reply.code(404).send({ error: "Care-circle recipient not found" });
    return reply.code(204).send();
  });

  app.get("/jobs/:jobId/visit", async (req, reply) => {
    const authed = await requireAuth(req);
    const { jobId } = req.params as { jobId: string };
    const sb = supabaseForUser(authed.jwt);
    const [
      { data: events, error: eventsError },
      { data: report, error: reportError },
      { data: feedback, error: feedbackError }
    ] = await Promise.all([
      sb.from("visit_events").select("*").eq("job_id", jobId).order("occurred_at"),
      sb.from("visit_reports").select("*").eq("job_id", jobId).maybeSingle(),
      sb.from("patient_visit_feedback").select("*").eq("job_id", jobId).maybeSingle()
    ]);
    if (eventsError || reportError || feedbackError) {
      return reply.code(400).send({ error: "Unable to load visit coordination" });
    }
    return reply.send({ events: events ?? [], report: report ?? null, feedback: feedback ?? null });
  });

  app.post("/jobs/:jobId/visit/events", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["nurse"]);
    const { jobId } = req.params as { jobId: string };
    const body = visitEventSchema.parse(req.body ?? {});
    const sb = supabaseForUser(authed.jwt);
    const [{ data: job }, { data: previous }] = await Promise.all([
      sb.from("jobs").select("status").eq("id", jobId).single(),
      sb.from("visit_events").select("event_type").eq("job_id", jobId).neq("event_type", "escalation_requested").order("occurred_at", { ascending: false }).limit(1).maybeSingle()
    ]);
    if (!job) return reply.code(404).send({ error: "Job not found" });
    if (!canRecordVisitEvent({ jobStatus: job.status, eventType: body.event_type, previousEventType: previous?.event_type as VisitEventType | undefined })) {
      return reply.code(409).send({ error: "Visit checkpoint is out of sequence" });
    }
    const { data, error } = await sb.from("visit_events").insert({
      ...body,
      job_id: jobId,
      nurse_user_id: authed.userId,
      occurred_at: body.occurred_at ?? new Date().toISOString(),
      patient_visible: true
    }).select("*").single();
    if (error?.code === "23505") return reply.code(409).send({ error: "Visit checkpoint was already recorded" });
    if (error) return reply.code(400).send({ error: "Unable to record checkpoint" });
    return reply.code(201).send({ event: data });
  });

  app.put("/jobs/:jobId/visit/report", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["nurse"]);
    const { jobId } = req.params as { jobId: string };
    const body = visitReportSchema.parse(req.body ?? {});
    const sb = supabaseForUser(authed.jwt);
    const [{ data: job }, { data: latest }] = await Promise.all([
      sb.from("jobs").select("status").eq("id", jobId).single(),
      sb.from("visit_events").select("event_type").eq("job_id", jobId).neq("event_type", "escalation_requested").order("occurred_at", { ascending: false }).limit(1).maybeSingle()
    ]);
    if (!job) return reply.code(404).send({ error: "Job not found" });
    if (body.status === "submitted" && !canSubmitVisitReport({ jobStatus: job.status, latestEventType: latest?.event_type as VisitEventType | undefined, visitSummary: body.visit_summary })) {
      return reply.code(409).send({ error: "Complete patient handoff and add a summary before submitting" });
    }
    const { data, error } = await sb.from("visit_reports").upsert({ ...body, job_id: jobId, nurse_user_id: authed.userId, submitted_at: body.status === "submitted" ? new Date().toISOString() : null }, { onConflict: "job_id" }).select("*").single();
    if (error) return reply.code(400).send({ error: "Unable to save visit report" });
    return reply.send({ report: data });
  });

  app.put("/jobs/:jobId/feedback", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["patient"]);
    const { jobId } = req.params as { jobId: string };
    const body = patientFeedbackSchema.parse(req.body ?? {});
    const sb = supabaseForUser(authed.jwt);
    const { data: job } = await sb.from("jobs").select("status").eq("id", jobId).single();
    if (!job) return reply.code(404).send({ error: "Job not found" });
    if (!canSubmitPatientFeedback({ jobStatus: job.status, rating: body.rating })) return reply.code(409).send({ error: "Feedback is available after completion" });
    const { data, error } = await sb.from("patient_visit_feedback").upsert({ ...body, job_id: jobId, patient_user_id: authed.userId }, { onConflict: "job_id" }).select("*").single();
    if (error) return reply.code(400).send({ error: "Unable to save feedback" });
    return reply.send({ feedback: data });
  });
}
