import { writeAdminAuditLog } from "../audit.js";
import { requireAuth, requireRole } from "../auth.js";
import { createNotification, createNotifications } from "../notifications.js";
import { supabaseAdmin, supabaseForUser } from "../supabase.js";
import { applyJobSchema, createJobSchema, updateJobSchema } from "../validators.js";
function isTerminalJobStatus(status) {
    return status === "cancelled" || status === "completed";
}
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
async function fetchAcceptedNurseId(jobId) {
    if (!supabaseAdmin)
        return null;
    const { data } = await supabaseAdmin
        .from("applications")
        .select("nurse_user_id")
        .eq("job_id", jobId)
        .eq("status", "accepted")
        .maybeSingle();
    return data?.nurse_user_id ?? null;
}
async function fetchJobApplications(jobId) {
    if (!supabaseAdmin)
        return [];
    const { data } = await supabaseAdmin
        .from("applications")
        .select("nurse_user_id,status")
        .eq("job_id", jobId);
    return (data ?? []);
}
async function notifyJobStatus(job, status, nurseIds) {
    const title = job.title || "Job";
    const notificationTitle = status === "cancelled" ? "Job cancelled" : "Job completed";
    const body = `${title} is now ${status}.`;
    await createNotifications([
        {
            userId: job.patient_user_id,
            type: `job_${status}`,
            title: notificationTitle,
            body,
            entityType: "job",
            entityId: job.id
        },
        ...Array.from(new Set(nurseIds)).map((nurseId) => ({
            userId: nurseId,
            type: `assigned_job_${status}`,
            title: notificationTitle,
            body,
            entityType: "job",
            entityId: job.id
        }))
    ]);
}
async function cancelJob(jobId, actorId, actorRole) {
    if (!supabaseAdmin) {
        throw Object.assign(new Error("Admin client not configured"), { statusCode: 500 });
    }
    const { data: job, error: jobError } = await supabaseAdmin
        .from("jobs")
        .select("id,status,patient_user_id,title")
        .eq("id", jobId)
        .maybeSingle();
    if (jobError)
        throw Object.assign(new Error("Unable to update job"), { statusCode: 400 });
    if (!job)
        throw Object.assign(new Error("Job not found"), { statusCode: 404 });
    if (actorRole === "patient" && job.patient_user_id !== actorId) {
        throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
    }
    if (actorRole !== "patient" && actorRole !== "admin") {
        throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
    }
    if (job.status !== "open" && job.status !== "assigned") {
        throw Object.assign(new Error("Invalid job transition"), { statusCode: 400 });
    }
    const applications = await fetchJobApplications(jobId);
    const notifyNurseIds = applications
        .filter((application) => application.status === "accepted" || application.status === "applied")
        .map((application) => application.nurse_user_id);
    const { error: rejectError } = await supabaseAdmin
        .from("applications")
        .update({ status: "rejected" })
        .eq("job_id", jobId)
        .eq("status", "applied");
    if (rejectError)
        throw Object.assign(new Error("Unable to update job"), { statusCode: 400 });
    const { data, error } = await supabaseAdmin
        .from("jobs")
        .update({ status: "cancelled" })
        .eq("id", jobId)
        .select("*")
        .single();
    if (error)
        throw Object.assign(new Error("Unable to update job"), { statusCode: 400 });
    await notifyJobStatus(job, "cancelled", notifyNurseIds);
    if (actorRole === "admin") {
        await writeAdminAuditLog({
            actor_id: actorId,
            action: "job_cancelled",
            entity_type: "job",
            entity_id: jobId,
            metadata: { previous_status: job.status }
        });
    }
    return data;
}
async function completeJob(jobId, actorId, actorRole) {
    if (!supabaseAdmin) {
        throw Object.assign(new Error("Admin client not configured"), { statusCode: 500 });
    }
    const { data: job, error: jobError } = await supabaseAdmin
        .from("jobs")
        .select("id,status,patient_user_id,title")
        .eq("id", jobId)
        .maybeSingle();
    if (jobError)
        throw Object.assign(new Error("Unable to update job"), { statusCode: 400 });
    if (!job)
        throw Object.assign(new Error("Job not found"), { statusCode: 404 });
    if (job.status !== "assigned") {
        throw Object.assign(new Error("Invalid job transition"), { statusCode: 400 });
    }
    const acceptedNurseId = await fetchAcceptedNurseId(jobId);
    if (!acceptedNurseId) {
        throw Object.assign(new Error("Invalid job transition"), { statusCode: 400 });
    }
    if (actorRole === "patient" && job.patient_user_id !== actorId) {
        throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
    }
    if (actorRole === "nurse" && acceptedNurseId !== actorId) {
        throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
    }
    if (actorRole !== "patient" && actorRole !== "nurse" && actorRole !== "admin") {
        throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
    }
    const { data, error } = await supabaseAdmin
        .from("jobs")
        .update({ status: "completed" })
        .eq("id", jobId)
        .select("*")
        .single();
    if (error)
        throw Object.assign(new Error("Unable to update job"), { statusCode: 400 });
    await notifyJobStatus(job, "completed", [acceptedNurseId]);
    if (actorRole === "admin") {
        await writeAdminAuditLog({
            actor_id: actorId,
            action: "job_completed",
            entity_type: "job",
            entity_id: jobId,
            metadata: { previous_status: job.status, nurse_user_id: acceptedNurseId }
        });
    }
    return data;
}
export async function jobRoutes(app) {
    // Create job (patient only)
    app.post("/jobs", async (req, reply) => {
        const authed = await requireAuth(req);
        requireRole(authed, ["patient"]);
        const body = createJobSchema.parse(req.body ?? {});
        const sb = supabaseForUser(authed.jwt);
        const payload = {
            patient_user_id: authed.userId,
            title: body.title,
            description: body.description ?? null,
            address: body.address ?? null,
            start_time: body.start_time ?? null,
            hourly_rate: body.hourly_rate ?? null,
            status: "open"
        };
        const { data, error } = await sb.from("jobs").insert(payload).select("*").single();
        if (error)
            return reply.code(400).send({ error: "Unable to create job" });
        return reply.send({ job: data });
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
    app.patch("/jobs/:jobId/cancel", async (req, reply) => {
        const authed = await requireAuth(req);
        const { jobId } = req.params;
        const job = await cancelJob(jobId, authed.userId, authed.role);
        return reply.send({ job });
    });
    app.patch("/jobs/:jobId/complete", async (req, reply) => {
        const authed = await requireAuth(req);
        const { jobId } = req.params;
        const job = await completeJob(jobId, authed.userId, authed.role);
        return reply.send({ job });
    });
    // Update job (patient can cancel; admin can update fields or terminal status)
    app.patch("/jobs/:jobId", async (req, reply) => {
        const authed = await requireAuth(req);
        const { jobId } = req.params;
        const body = updateJobSchema.parse(req.body ?? {});
        let patch = {};
        if (authed.role === "patient") {
            if (!supabaseAdmin) {
                return reply.code(500).send({ error: "Admin client not configured" });
            }
            const { data: job, error: jobError } = await supabaseAdmin
                .from("jobs")
                .select("id,status,patient_user_id,title")
                .eq("id", jobId)
                .maybeSingle();
            if (jobError) {
                return reply.code(400).send({ error: "Unable to update job" });
            }
            if (!job) {
                return reply.code(404).send({ error: "Job not found" });
            }
            if (job.patient_user_id !== authed.userId) {
                return reply.code(403).send({ error: "Forbidden" });
            }
            if (body.status && body.status !== "cancelled") {
                return reply.code(400).send({ error: "Invalid job transition" });
            }
            if (!body.status || job.status !== "open" && job.status !== "assigned") {
                return reply.code(400).send({ error: "Invalid job transition" });
            }
            const data = await cancelJob(jobId, authed.userId, authed.role);
            return reply.send({ job: data });
        }
        else if (authed.role === "admin") {
            if (body.status === "cancelled") {
                const data = await cancelJob(jobId, authed.userId, authed.role);
                return reply.send({ job: data });
            }
            if (body.status === "completed") {
                const data = await completeJob(jobId, authed.userId, authed.role);
                return reply.send({ job: data });
            }
            patch = {
                ...(body.description !== undefined ? { description: body.description } : {}),
                ...(body.address !== undefined ? { address: body.address } : {}),
                ...(body.start_time !== undefined ? { start_time: body.start_time } : {}),
                ...(body.hourly_rate !== undefined ? { hourly_rate: body.hourly_rate } : {})
            };
        }
        else {
            return reply.code(403).send({ error: "Forbidden" });
        }
        const sb = supabaseForUser(authed.jwt);
        const { data, error } = await sb.from("jobs").update(patch).eq("id", jobId).select("*").single();
        if (error)
            return reply.code(400).send({ error: "Unable to update job" });
        if (authed.role === "admin" && supabaseAdmin) {
            await writeAdminAuditLog({
                actor_id: authed.userId,
                action: "job_status_update",
                entity_type: "job",
                entity_id: jobId,
                metadata: patch
            });
        }
        return reply.send({ job: data });
    });
    // Nurse applies to job
    app.post("/jobs/:jobId/apply", async (req, reply) => {
        const authed = await requireAuth(req);
        requireRole(authed, ["nurse"]);
        await requireVerifiedNurse(authed.userId, authed.jwt);
        const { jobId } = req.params;
        const body = applyJobSchema.parse(req.body ?? {});
        const sb = supabaseForUser(authed.jwt);
        const jobClient = supabaseAdmin ?? sb;
        const { data: job, error: jobErr } = await jobClient
            .from("jobs")
            .select("id,status")
            .eq("id", jobId)
            .single();
        if (jobErr || !job)
            return reply.code(404).send({ error: "Job not found" });
        if (job.status !== "open" || isTerminalJobStatus(job.status)) {
            return reply.code(400).send({ error: "Invalid job transition" });
        }
        const { data: existingApplication, error: existingApplicationError } = await sb
            .from("applications")
            .select("id,status")
            .eq("job_id", jobId)
            .eq("nurse_user_id", authed.userId)
            .maybeSingle();
        if (existingApplicationError) {
            return reply.code(400).send({ error: "Unable to apply to job" });
        }
        if (existingApplication) {
            return reply.code(409).send({ error: "Application already exists" });
        }
        const { data, error } = await sb
            .from("applications")
            .insert({
            job_id: jobId,
            nurse_user_id: authed.userId,
            status: "applied",
            note: body.note ?? ""
        })
            .select("*")
            .single();
        if (error) {
            const code = error.code;
            return reply
                .code(code === "23505" ? 409 : 400)
                .send({ error: code === "23505" ? "Application already exists" : "Unable to apply to job" });
        }
        if (supabaseAdmin) {
            const { data: jobForNotification } = await supabaseAdmin
                .from("jobs")
                .select("id,title,patient_user_id")
                .eq("id", jobId)
                .maybeSingle();
            await createNotification({
                userId: jobForNotification?.patient_user_id,
                type: "nurse_applied",
                title: "New nurse application",
                body: `${authed.email ?? "A nurse"} applied to ${jobForNotification?.title ?? "your job"}.`,
                entityType: "job",
                entityId: jobId
            });
        }
        return reply.send({ application: data });
    });
    // Nurse withdraws application
    app.post("/jobs/:jobId/withdraw", async (req, reply) => {
        const authed = await requireAuth(req);
        requireRole(authed, ["nurse"]);
        const { jobId } = req.params;
        const sb = supabaseForUser(authed.jwt);
        const { data, error } = await sb
            .from("applications")
            .update({ status: "withdrawn" })
            .eq("job_id", jobId)
            .eq("nurse_user_id", authed.userId)
            .select("*")
            .single();
        if (error)
            return reply.code(400).send({ error: "Unable to withdraw application" });
        return reply.send({ application: data });
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
