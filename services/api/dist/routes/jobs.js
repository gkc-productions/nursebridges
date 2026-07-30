import { writeAdminAuditLog } from "../audit.js";
import { requireAuth, requireRole } from "../auth.js";
import { createNotification, createNotifications } from "../notifications.js";
import { supabaseAdmin, supabaseForUser } from "../supabase.js";
import { registerJobCreateRoute } from "./jobCreateRoute.js";
import { registerJobApplyRoute } from "./jobApplyRoute.js";
import { createJobTerminalActions, registerJobTerminalRoutes } from "./jobTerminalRoute.js";
import { registerJobUpdateRoute } from "./jobUpdateRoute.js";
import { registerJobWithdrawRoute } from "./jobWithdrawRoute.js";
async function isVerifiedNurse(userId, jwt) {
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
async function requireVerifiedNurse(userId, jwt) {
    if (!(await isVerifiedNurse(userId, jwt))) {
        throw Object.assign(new Error("Nurse verification required"), { statusCode: 403 });
    }
}
async function fetchAssignedNurseMap(jobIds, jwt) {
    if (jobIds.length === 0)
        return { assigned: new Map(), names: new Map() };
    const sb = supabaseForUser(jwt);
    const { data: apps } = await sb
        .from("applications")
        .select("job_id,nurse_user_id,status")
        .in("job_id", jobIds)
        .eq("status", "accepted");
    const assigned = new Map();
    for (const row of apps ?? []) {
        const app = row;
        if (!assigned.has(app.job_id))
            assigned.set(app.job_id, app.nurse_user_id);
    }
    const nurseIds = Array.from(new Set(Array.from(assigned.values())));
    const names = new Map();
    if (nurseIds.length > 0 && supabaseAdmin) {
        const { data: profiles } = await supabaseAdmin
            .from("profiles")
            .select("id,full_name")
            .in("id", nurseIds);
        for (const p of profiles ?? []) {
            names.set(p.id, p.full_name ?? "");
        }
    }
    return { assigned, names };
}
export async function jobRoutes(app) {
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
            .select("id,status,patient_user_id,title,description,address,start_time,hourly_rate,created_at");
        if (authed.role === "patient") {
            query = query.eq("patient_user_id", authed.userId);
        }
        else if (authed.role === "nurse") {
            await requireVerifiedNurse(authed.userId, authed.jwt);
        }
        else if (authed.role !== "admin") {
            return reply.code(403).send({ error: "Forbidden" });
        }
        const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
        if (error)
            return reply.code(400).send({ error: "Unable to load jobs" });
        const jobs = (data ?? []);
        const jobIds = jobs.map((job) => job.id);
        const { assigned, names } = await fetchAssignedNurseMap(jobIds, authed.jwt);
        const merged = jobs.map((job) => {
            const nurseId = assigned.get(job.id) ?? null;
            return {
                ...job,
                assigned_nurse_user_id: nurseId,
                assigned_nurse_name: nurseId ? names.get(nurseId) ?? null : null
            };
        });
        return reply.send({ jobs: merged });
    });
    // Job detail (role-aware)
    app.get("/jobs/:jobId", async (req, reply) => {
        const authed = await requireAuth(req);
        const { jobId } = req.params;
        const sb = supabaseForUser(authed.jwt);
        const { data: job, error } = await sb
            .from("jobs")
            .select("id,status,patient_user_id,title,description,address,start_time,hourly_rate,created_at")
            .eq("id", jobId)
            .single();
        if (error || !job)
            return reply.code(404).send({ error: "Job not found" });
        const { assigned, names } = await fetchAssignedNurseMap([jobId], authed.jwt);
        const nurseId = assigned.get(jobId) ?? null;
        return reply.send({
            job: {
                ...job,
                assigned_nurse_user_id: nurseId,
                assigned_nurse_name: nurseId ? names.get(nurseId) ?? null : null
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
        const { jobId } = req.params;
        if (authed.role !== "patient" && authed.role !== "admin") {
            return reply.code(403).send({ error: "Forbidden" });
        }
        const sb = supabaseForUser(authed.jwt);
        const { data, error } = await sb
            .from("applications")
            .select("id,job_id,nurse_user_id,status,created_at")
            .eq("job_id", jobId)
            .order("created_at", { ascending: false });
        if (error)
            return reply.code(400).send({ error: "Unable to load applications" });
        return reply.send({ applications: data ?? [] });
    });
}
