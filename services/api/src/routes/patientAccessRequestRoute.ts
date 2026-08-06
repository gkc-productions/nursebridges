import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const patientAccessRequestSchema = z.object({
  full_name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().min(7).max(32).optional(),
  service_area: z.string().trim().min(2).max(80),
  requester_type: z.enum(["patient", "family"]),
  contact_consent: z.literal(true),
  website: z.string().max(200).optional().default("")
});

type RateLimiter = {
  allow(key: string): boolean;
};

export function createAccessRequestRateLimiter(options: { limit?: number; windowMs?: number; now?: () => number } = {}): RateLimiter {
  const limit = options.limit ?? 3;
  const windowMs = options.windowMs ?? 60 * 60 * 1000;
  const now = options.now ?? Date.now;
  const attempts = new Map<string, number[]>();

  return {
    allow(key: string) {
      const cutoff = now() - windowMs;
      const recent = (attempts.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
      if (recent.length >= limit) {
        attempts.set(key, recent);
        return false;
      }
      recent.push(now());
      attempts.set(key, recent);
      return true;
    }
  };
}

const defaultRateLimiter = createAccessRequestRateLimiter();

type PatientAccessRequestRouteDeps = {
  supabaseAdmin: any;
  rateLimiter?: RateLimiter;
  now?: () => Date;
};

function privacySafeKey(email: string) {
  return createHash("sha256").update(email).digest("hex");
}

function acceptedResponse(requestId: string) {
  return {
    ok: true,
    message: "Request received.",
    requestId
  };
}

export async function registerPatientAccessRequestRoute(
  app: FastifyInstance,
  deps: PatientAccessRequestRouteDeps
) {
  const rateLimiter = deps.rateLimiter ?? defaultRateLimiter;
  const now = deps.now ?? (() => new Date());

  app.post("/v1/access-requests/patient", async (req, reply) => {
    const input = patientAccessRequestSchema.parse(req.body);

    // Silently accept bot-filled submissions without storing their contents.
    if (input.website) {
      return reply.code(202).send(acceptedResponse(req.id));
    }

    if (!rateLimiter.allow(privacySafeKey(input.email))) {
      return reply.code(429).send({ error: "Please wait before trying again.", requestId: req.id });
    }

    if (!deps.supabaseAdmin) {
      return reply.code(503).send({ error: "Access requests are temporarily unavailable.", requestId: req.id });
    }

    const { data, error } = await deps.supabaseAdmin
      .from("patient_access_requests")
      .insert({
        full_name: input.full_name,
        email: input.email,
        phone: input.phone || null,
        service_area: input.service_area,
        requester_type: input.requester_type,
        source: "patient_ios_app",
        contact_consent_at: now().toISOString()
      })
      .select("id")
      .single();

    if (error && error.code !== "23505") {
      req.log.error({
        event: "patient_access_request_insert_failed",
        requestId: req.id,
        code: error.code ?? "unknown"
      });
      return reply.code(503).send({ error: "Access requests are temporarily unavailable.", requestId: req.id });
    }

    req.log.info({
      event: error?.code === "23505" ? "patient_access_request_duplicate" : "patient_access_request_created",
      requestId: req.id,
      accessRequestId: data?.id ?? null
    });
    return reply.code(202).send(acceptedResponse(req.id));
  });
}
