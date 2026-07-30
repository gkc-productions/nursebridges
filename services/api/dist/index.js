import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { jobRoutes } from "./routes/jobs.js";
import { applicationRoutes } from "./routes/applications.js";
import { meRoutes } from "./routes/me.js";
import { adminRoutes } from "./routes/admin.js";
import { notificationRoutes } from "./routes/notifications.js";
import { pushRoutes } from "./routes/push.js";
import { nurseRoutes } from "./routes/nurse.js";
const requestStartTimes = new WeakMap();
const app = Fastify({
    disableRequestLogging: true,
    genReqId: (req) => {
        const requestId = req.headers["x-request-id"];
        return Array.isArray(requestId) ? requestId[0] : requestId || randomUUID();
    },
    logger: {
        redact: [
            "req.headers.authorization",
            "req.headers.cookie",
            "req.headers['x-supabase-auth']",
            "headers.authorization",
            "headers.cookie",
            "password",
            "token",
            "service_role_key",
            "SUPABASE_SERVICE_ROLE_KEY"
        ]
    }
});
const PORT = Number(process.env.PORT || 3000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
app.get("/health", async () => {
    return { ok: true, service: "nursebridge-api", ts: new Date().toISOString() };
});
async function main() {
    await app.register(cors, { origin: CORS_ORIGIN });
    app.addHook("onRequest", async (req, reply) => {
        requestStartTimes.set(req, Date.now());
        reply.header("x-request-id", req.id);
    });
    app.addHook("onResponse", async (req, reply) => {
        const startedAt = requestStartTimes.get(req) ?? Date.now();
        req.log.info({
            event: "request_completed",
            requestId: req.id,
            method: req.method,
            path: req.url.split("?")[0],
            statusCode: reply.statusCode,
            durationMs: Date.now() - startedAt
        });
    });
    await meRoutes(app);
    await jobRoutes(app);
    await applicationRoutes(app);
    await notificationRoutes(app);
    await pushRoutes(app);
    await nurseRoutes(app);
    await adminRoutes(app);
    // Error handler (consistent responses)
    app.setErrorHandler((err, req, reply) => {
        const isValidationError = err instanceof ZodError;
        const path = req.url.split("?")[0];
        const statusCode = isValidationError
            ? 400
            : err?.statusCode && Number.isInteger(err.statusCode)
                ? err.statusCode
                : 500;
        if (isValidationError) {
            req.log.warn({
                event: "request_validation_failed",
                requestId: req.id,
                method: req.method,
                path,
                statusCode,
                issues: err.issues.map((issue) => ({
                    path: issue.path.join("."),
                    message: issue.message
                }))
            });
        }
        if (statusCode >= 500) {
            req.log.error({
                event: "request_error",
                requestId: req.id,
                method: req.method,
                path,
                statusCode,
                err
            });
        }
        const msg = statusCode === 401 || statusCode === 403 || statusCode === 404
            ? err?.message || "Request failed"
            : statusCode === 400
                ? "Invalid request"
                : "Internal server error";
        const issues = isValidationError
            ? err.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message
            }))
            : undefined;
        reply.code(statusCode).send({ error: msg, issues, requestId: req.id });
    });
    await app.listen({ port: PORT, host: "0.0.0.0" });
    app.log.info(`API listening on http://0.0.0.0:${PORT}`);
}
main().catch((e) => {
    app.log.error(e);
    process.exit(1);
});
