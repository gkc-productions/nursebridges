import type { FastifyInstance } from "fastify";
import { writeAdminAuditLog } from "../audit.js";
import { requireAuth, requireRole } from "../auth.js";
import { createNotification, createNotifications } from "../notifications.js";
import { supabaseAdmin, supabaseForUser } from "../supabase.js";
import { canReceivePrivateLogistics, privateAddressForViewer } from "../jobPrivacy.js";
import { buildAssignedNurseMap } from "../jobAssignmentView.js";
import { registerJobCreateRoute } from "./jobCreateRoute.js";
import { registerJobApplyRoute } from "./jobApplyRoute.js";
import { createJobTerminalActions, registerJobTerminalRoutes } from "./jobTerminalRoute.js";
import { registerJobUpdateRoute } from "./jobUpdateRoute.js";
import { registerJobWithdrawRoute } from "./jobWithdrawRoute.js";

type JobRow = {
  id: string;
  status: string;
  patient_user_id: string | null;
  assigned_nurse_user_id?: string | null;
  title: string;
  description: string | null;
  address: string | null;
  start_time: string | null;
  hourly_rate: number | null;
  service_city: string | null;
  service_state: string | null;
  created_at: string;
};

type JobLogisticsRow = {
  job_id: string;
  [key: string]: unknown;
};

const jobSelect = "id,status,patient_user_id,title,description,address,service_city,service_state,start_time,hourly_rate,created_at";
const logisticsSelect = [
  "job_id",
  "residence_type",
  "street_address",
  "unit",
  "building_name",
  "city",
  "state",
  "postal_code",
  "stairs",
  "elevator_available",
  "meeting_point",
  "parking_notes",
  "arrival_instructions",
  "mobility_aids",
  "mobility_notes",
  "onsite_contact_name",
  "onsite_contact_relationship",
  "onsite_contact_phone",
  "transportation_mode",
  "transportation_provider",
  "pickup_time",
  "return_plan",
  "transportation_notes"
].join(",");

async function fetchPrivateLogistics(jobs: JobRow[], assigned: Map<string, string>, role: string, userId: string, jwt: string) {
  const visibleIds = jobs
    .filter((job) => canReceivePrivateLogistics(role, userId, job, assigned.get(job.id) ?? null))
    .map((job) => job.id);
  if (visibleIds.length === 0) return new Map<string, JobLogisticsRow>();

  const sb = supabaseForUser(jwt);
  const { data, error } = await sb.from("job_logistics").select(logisticsSelect).in("job_id", visibleIds);
  if (error) throw Object.assign(new Error("Unable to load private job logistics"), { statusCode: 500 });
  return new Map(((data ?? []) as unknown as JobLogisticsRow[]).map((row) => [row.job_id, row]));
}

type ApplicationRow = {
  id?: string;
  job_id: string;
  nurse_user_id: string;
  status: string;
  created_at: string;
};

async function isVerifiedNurse(userId: string, jwt: string) {
  const sb = supabaseForUser(jwt);
  const { data, error } = await sb
    .from("nurse_profiles")
    .select("verification_status")
    .eq("nurse_id", userId)
    .maybeSingle();

  if (error) {
    throw Object.assign(new Error("Unable to verify nurse status"), { statusCode: 500 });
  }

  return data?.verification_status === "approved";
}

async function requireVerifiedNurse(userId: string, jwt: string) {
  if (!(await isVerifiedNurse(userId, jwt))) {
    throw Object.assign(new Error("Nurse verification required"), { statusCode: 403 });
  }
}

async function fetchAssignedNurseMap(jobs: JobRow[], jwt: string) {
  const jobIds = jobs.map((job) => job.id);
  if (jobIds.length === 0) return { assigned: new Map<string, string>(), names: new Map<string, string>() };

  // These job IDs have already passed the requesting user's role-aware jobs query.
  // Use the service client when available so patient RLS on applications does not hide
  // the accepted nurse from the patient's own care-request response.
  const sb = supabaseAdmin ?? supabaseForUser(jwt);
  const { data: apps } = await sb
    .from("applications")
    .select("job_id,nurse_user_id,status")
    .in("job_id", jobIds)
    .eq("status", "accepted");

  const assigned = buildAssignedNurseMap(jobs, (apps ?? []) as ApplicationRow[]);

  const nurseIds = Array.from(new Set(Array.from(assigned.values())));
  const names = new Map<string, string>();

  const adminClient = supabaseAdmin;
  if (nurseIds.length > 0 && adminClient) {
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id,full_name")
      .in("id", nurseIds);

    for (const p of profiles ?? []) {
      names.set(p.id as string, (p as any).full_name ?? "");
    }

    await Promise.all(
      nurseIds.filter((id) => !names.get(id)).map(async (id) => {
        const { data } = await adminClient.auth.admin.getUserById(id);
        const email = data?.user?.email;
        if (email) names.set(id, email);
      })
    );
  }

  return { assigned, names };
}

export async function jobRoutes(app: FastifyInstance) {
  const terminalActions = createJobTerminalActions({
    supabaseAdmin,
    createNotifications,
    writeAdminAuditLog
  });

  await registerJobCreateRoute(app, {
    requireAuth,
    requireRole,
    supabaseForUser
  });

  // List jobs (role-aware)
  app.get("/jobs", async (req, reply) => {
    const authed = await requireAuth(req);
    const sb = supabaseForUser(authed.jwt);

    let query = sb
      .from("jobs")
      .select(jobSelect);

    if (authed.role === "patient") {
      query = query.eq("patient_user_id", authed.userId);
    } else if (authed.role === "nurse") {
      await requireVerifiedNurse(authed.userId, authed.jwt);
    } else if (authed.role !== "admin") {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const { data, error } = await query.order("created_at", { ascending: false }).limit(100);

    if (error) return reply.code(400).send({ error: "Unable to load jobs" });

    const jobs = (data ?? []) as JobRow[];
    const { assigned, names } = await fetchAssignedNurseMap(jobs, authed.jwt);
    const logistics = await fetchPrivateLogistics(jobs, assigned, authed.role, authed.userId, authed.jwt);

    const merged = jobs.map((job) => {
      const nurseId = assigned.get(job.id) ?? null;
      return {
        ...job,
        address: privateAddressForViewer(job.address, authed.role, authed.userId, job, nurseId),
        assigned_nurse_user_id: nurseId,
        assigned_nurse_name: nurseId ? names.get(nurseId) ?? null : null,
        logistics: logistics.get(job.id) ?? null
      };
    });

    return reply.send({ jobs: merged });
  });

  // Job detail (role-aware)
  app.get("/jobs/:jobId", async (req, reply) => {
    const authed = await requireAuth(req);
    const { jobId } = req.params as any;
    const sb = supabaseForUser(authed.jwt);

    const { data: job, error } = await sb
      .from("jobs")
      .select(jobSelect)
      .eq("id", jobId)
      .single();

    if (error || !job) return reply.code(404).send({ error: "Job not found" });

    const { assigned, names } = await fetchAssignedNurseMap([job as JobRow], authed.jwt);
    const nurseId = assigned.get(jobId) ?? null;
    const logistics = await fetchPrivateLogistics([job as JobRow], assigned, authed.role, authed.userId, authed.jwt);

    return reply.send({
      job: {
        ...(job as JobRow),
        address: privateAddressForViewer((job as JobRow).address, authed.role, authed.userId, job as JobRow, nurseId),
        assigned_nurse_user_id: nurseId,
        assigned_nurse_name: nurseId ? names.get(nurseId) ?? null : null,
        logistics: logistics.get(jobId) ?? null
      }
    });
  });

  await registerJobTerminalRoutes(app, {
    requireAuth,
    actions: terminalActions
  });

  await registerJobUpdateRoute(app, {
    requireAuth,
    terminalActions,
    supabaseForUser,
    writeAdminAuditLog
  });

  await registerJobApplyRoute(app, {
    requireAuth,
    requireRole,
    requireVerifiedNurse,
    supabaseAdmin,
    supabaseForUser,
    createNotification
  });

  await registerJobWithdrawRoute(app, {
    requireAuth,
    requireRole,
    supabaseForUser
  });

  // Patient/admin list applications for job
  app.get("/jobs/:jobId/applications", async (req, reply) => {
    const authed = await requireAuth(req);
    const { jobId } = req.params as any;

    if (authed.role !== "patient" && authed.role !== "admin") {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const sb = supabaseForUser(authed.jwt);
    const { data, error } = await sb
      .from("applications")
      .select("id,job_id,nurse_user_id,status,created_at")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });

    if (error) return reply.code(400).send({ error: "Unable to load applications" });

    return reply.send({ applications: data ?? [] });
  });
}
