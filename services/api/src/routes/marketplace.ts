import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../auth.js";
import { arrivalLockAfterFailure, createArrivalPin, hashArrivalPin, verifyArrivalPin } from "../arrivalVerification.js";
import { supabaseAdmin, supabaseForUser } from "../supabase.js";
import { arrivalPinSchema, nurseAvailabilitySchema, nurseWorkspaceProfileSchema, preferredNurseSchema, recurringCarePlanSchema, supportCaseSchema } from "../validators.js";

const profileFields = "nurse_id,verification_status,verified_at,onboarding_step,onboarding_completed_at,professional_summary,years_experience,service_radius_miles,availability_status,updated_at";

function adminClient() {
  if (!supabaseAdmin) throw Object.assign(new Error("Admin client not configured"), { statusCode: 503 });
  return supabaseAdmin;
}

async function ownedJob(userId: string, jobId: string, jwt: string) {
  const { data } = await supabaseForUser(jwt).from("jobs")
    .select("id,status,assigned_nurse_user_id,start_time")
    .eq("id", jobId).eq("patient_user_id", userId).maybeSingle();
  return data;
}

export async function marketplaceRoutes(app: FastifyInstance) {
  app.get("/nurse/workspace", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["nurse"]);
    const sb = supabaseForUser(authed.jwt);
    const [profileResult, availabilityResult, earningsResult] = await Promise.all([
      sb.from("nurse_profiles").select(profileFields).eq("nurse_id", authed.userId).maybeSingle(),
      sb.from("nurse_availability_windows").select("id,starts_at,ends_at,timezone,recurrence").eq("nurse_user_id", authed.userId).gte("ends_at", new Date().toISOString()).order("starts_at"),
      sb.from("nurse_earning_records").select("id,job_id,currency,guaranteed_cents,adjustment_cents,status,available_at,paid_at").eq("nurse_user_id", authed.userId).order("created_at", { ascending: false }).limit(100)
    ]);
    if (profileResult.error || availabilityResult.error || earningsResult.error) return reply.code(400).send({ error: "Unable to load nurse workspace" });
    return reply.send({
      profile: profileResult.data ?? null,
      availability: availabilityResult.data ?? [],
      earnings: earningsResult.data ?? [],
      payments_enabled: false,
      payments_message: "Earnings are estimates only until NurseBridges enables an approved payout program."
    });
  });

  app.put("/nurse/workspace/profile", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["nurse"]);
    const body = nurseWorkspaceProfileSchema.parse(req.body ?? {});
    // Existing RLS intentionally allows nurses to update, but not create, their
    // verification record. The API owns first-time creation and limits writes
    // to the self-service fields parsed above.
    const { data, error } = await adminClient().from("nurse_profiles").upsert({
      nurse_id: authed.userId,
      ...body,
      onboarding_completed_at: body.onboarding_step === "complete" ? new Date().toISOString() : null
    }, { onConflict: "nurse_id" }).select(profileFields).single();
    if (error) return reply.code(400).send({ error: "Unable to save nurse profile" });
    return reply.send({ profile: data });
  });

  app.put("/nurse/workspace/availability", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["nurse"]);
    const body = nurseAvailabilitySchema.parse(req.body ?? {});
    const sb = supabaseForUser(authed.jwt);
    const { error: deleteError } = await sb.from("nurse_availability_windows").delete().eq("nurse_user_id", authed.userId);
    if (deleteError) return reply.code(400).send({ error: "Unable to update availability" });
    if (body.windows.length === 0) return reply.send({ availability: [] });
    const { data, error } = await sb.from("nurse_availability_windows")
      .insert(body.windows.map((window) => ({ ...window, nurse_user_id: authed.userId })))
      .select("id,starts_at,ends_at,timezone,recurrence").order("starts_at");
    if (error) return reply.code(400).send({ error: "Unable to update availability" });
    return reply.send({ availability: data ?? [] });
  });

  app.get("/support-cases", async (req, reply) => {
    const authed = await requireAuth(req);
    const { data, error } = await supabaseForUser(authed.jwt).from("operations_cases")
      .select("id,case_type,subject_type,subject_id,title,status,priority,due_at,last_activity_at,resolved_at,created_at")
      .eq("reported_by_user_id", authed.userId).order("created_at", { ascending: false });
    if (error) return reply.code(400).send({ error: "Unable to load support cases" });
    return reply.send({ cases: data ?? [] });
  });

  app.post("/support-cases", async (req, reply) => {
    const authed = await requireAuth(req);
    const body = supportCaseSchema.parse(req.body ?? {});
    if (body.subject_type === "job" && body.subject_id) {
      let query = adminClient().from("jobs").select("id").eq("id", body.subject_id);
      if (authed.role === "patient") query = query.eq("patient_user_id", authed.userId);
      else if (authed.role === "nurse") query = query.eq("assigned_nurse_user_id", authed.userId);
      else if (authed.role !== "admin") return reply.code(403).send({ error: "Forbidden" });
      const { data: job } = await query.maybeSingle();
      if (!job) return reply.code(404).send({ error: "Care request not found" });
    }
    const { data, error } = await supabaseForUser(authed.jwt).from("operations_cases")
      .insert({ ...body, reported_by_user_id: authed.userId })
      .select("id,case_type,subject_type,subject_id,title,status,priority,due_at,last_activity_at,created_at").single();
    if (error) return reply.code(400).send({ error: "Unable to create support case" });
    return reply.code(201).send({ case: data });
  });

  app.get("/marketplace/preferences", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["patient"]);
    const { data, error } = await supabaseForUser(authed.jwt).from("preferred_nurses")
      .select("nurse_user_id,source_job_id,status,created_at,updated_at").eq("patient_user_id", authed.userId).order("updated_at", { ascending: false });
    if (error) return reply.code(400).send({ error: "Unable to load nurse preferences" });
    return reply.send({ preferences: data ?? [] });
  });

  app.put("/marketplace/preferences", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["patient"]);
    const body = preferredNurseSchema.parse(req.body ?? {});
    if (!body.source_job_id) return reply.code(400).send({ error: "A completed care request is required to set a nurse preference" });
    const job = await ownedJob(authed.userId, body.source_job_id, authed.jwt);
    if (!job || job.status !== "completed" || job.assigned_nurse_user_id !== body.nurse_user_id) {
      return reply.code(409).send({ error: "Nurse preference is available after completed care with that nurse" });
    }
    const { data, error } = await supabaseForUser(authed.jwt).from("preferred_nurses")
      .upsert({ patient_user_id: authed.userId, ...body }, { onConflict: "patient_user_id,nurse_user_id" })
      .select("nurse_user_id,source_job_id,status,created_at,updated_at").single();
    if (error) return reply.code(400).send({ error: "Unable to save nurse preference" });
    return reply.send({ preference: data });
  });

  app.get("/marketplace/recurring-care", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["patient"]);
    const { data, error } = await supabaseForUser(authed.jwt).from("recurring_care_plans").select("*")
      .eq("patient_user_id", authed.userId).order("created_at", { ascending: false });
    if (error) return reply.code(400).send({ error: "Unable to load recurring care plans" });
    return reply.send({ plans: data ?? [] });
  });

  app.post("/marketplace/recurring-care", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["patient"]);
    const body = recurringCarePlanSchema.parse(req.body ?? {});
    const sourceJob = body.source_job_id ? await ownedJob(authed.userId, body.source_job_id, authed.jwt) : null;
    if (body.source_job_id && !sourceJob) return reply.code(404).send({ error: "Source care request not found" });
    if (body.preferred_nurse_user_id) {
      const sourceRelationshipMatches = sourceJob?.status === "completed" && sourceJob.assigned_nurse_user_id === body.preferred_nurse_user_id;
      const { data: existingPreference } = await supabaseForUser(authed.jwt).from("preferred_nurses")
        .select("nurse_user_id").eq("patient_user_id", authed.userId).eq("nurse_user_id", body.preferred_nurse_user_id).eq("status", "preferred").maybeSingle();
      if (!sourceRelationshipMatches && !existingPreference) return reply.code(409).send({ error: "Select a nurse from your completed care history" });
    }
    const { data, error } = await supabaseForUser(authed.jwt).from("recurring_care_plans")
      .insert({ ...body, patient_user_id: authed.userId, status: "pending_review" }).select("*").single();
    if (error) return reply.code(400).send({ error: "Unable to request recurring care" });
    if (supabaseAdmin) {
      await supabaseAdmin.from("operations_cases").insert({
        case_type: "intake",
        subject_type: "recurring_care_plan",
        subject_id: data.id,
        title: "Recurring care request needs review",
        description: `${body.cadence} request beginning ${body.starts_on}. Confirm scope, occurrence dates, availability, and pricing before activation.`,
        priority: "normal",
        reported_by_user_id: authed.userId,
        due_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
      });
    }
    return reply.code(201).send({ plan: data, message: "The care team will review each occurrence before assignment or pricing." });
  });

  app.post("/jobs/:jobId/arrival-pin", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["patient"]);
    const { jobId } = req.params as { jobId: string };
    const job = await ownedJob(authed.userId, jobId, authed.jwt);
    if (!job || !["assigned", "in_progress"].includes(job.status) || !job.assigned_nurse_user_id) return reply.code(409).send({ error: "Arrival verification is available after nurse assignment" });
    const pin = createArrivalPin();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error } = await adminClient().from("visit_arrival_verifications").upsert({
      job_id: jobId, pin_digest: hashArrivalPin(pin), expires_at: expiresAt, failed_attempts: 0, locked_until: null,
      verified_by_nurse_user_id: null, verified_at: null, created_by_user_id: authed.userId
    }, { onConflict: "job_id" });
    if (error) return reply.code(400).send({ error: "Unable to create arrival PIN" });
    return reply.send({ pin, expires_at: expiresAt, message: "Share this PIN with the assigned nurse in person. It expires after 24 hours." });
  });

  app.post("/jobs/:jobId/arrival-pin/verify", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["nurse"]);
    const { jobId } = req.params as { jobId: string };
    const body = arrivalPinSchema.parse(req.body ?? {});
    const admin = adminClient();
    const [jobResult, recordResult] = await Promise.all([
      admin.from("jobs").select("id,status,assigned_nurse_user_id,patient_user_id").eq("id", jobId).maybeSingle(),
      admin.from("visit_arrival_verifications").select("*").eq("job_id", jobId).maybeSingle()
    ]);
    const job = jobResult.data;
    const record = recordResult.data;
    if (!job || job.assigned_nurse_user_id !== authed.userId || !["assigned", "in_progress"].includes(job.status)) return reply.code(404).send({ error: "Active assigned visit not found" });
    if (!record) return reply.code(409).send({ error: "The patient has not created an arrival PIN" });
    if (record.verified_at) return reply.send({ verified_at: record.verified_at, already_verified: true });
    if (new Date(record.expires_at).getTime() <= Date.now()) return reply.code(410).send({ error: "Arrival PIN expired" });
    if (record.locked_until && new Date(record.locked_until).getTime() > Date.now()) return reply.code(423).send({ error: "Arrival verification is temporarily locked" });
    if (!verifyArrivalPin(body.pin, record.pin_digest)) {
      const lock = arrivalLockAfterFailure(record.failed_attempts);
      await admin.from("visit_arrival_verifications").update({ failed_attempts: lock.failedAttempts, locked_until: lock.lockedUntil?.toISOString() ?? null }).eq("job_id", jobId);
      return reply.code(400).send({ error: "Arrival PIN is incorrect" });
    }
    const verifiedAt = new Date().toISOString();
    const { error } = await admin.from("visit_arrival_verifications").update({ verified_by_nurse_user_id: authed.userId, verified_at: verifiedAt, failed_attempts: 0, locked_until: null }).eq("job_id", jobId);
    if (error) return reply.code(400).send({ error: "Unable to confirm arrival" });
    await admin.from("marketplace_quality_signals").insert({ job_id: jobId, nurse_user_id: authed.userId, patient_user_id: job.patient_user_id, signal_type: "arrival_verified", severity: "info", metadata: { source: "visit_pin" } });
    return reply.send({ verified_at: verifiedAt, already_verified: false });
  });
}
