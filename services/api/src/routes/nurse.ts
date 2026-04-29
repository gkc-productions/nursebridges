import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../auth.js";
import { supabaseAdmin, supabaseForUser } from "../supabase.js";
import { createVerificationDocumentSchema, createVerificationDocumentUploadUrlSchema } from "../validators.js";

function isMissingVerificationDocumentsTable(error: unknown) {
  const code = (error as any)?.code;
  return code === "PGRST205" || code === "42P01";
}

function isValidOwnStoragePath(userId: string, storagePath: string) {
  return storagePath.startsWith(`${userId}/`) && !storagePath.includes("..") && !storagePath.endsWith("/");
}

export async function nurseRoutes(app: FastifyInstance) {
  app.post("/nurse/verification-documents/upload-url", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["nurse"]);

    if (!supabaseAdmin) {
      return reply.code(500).send({ error: "Admin client not configured" });
    }

    const body = createVerificationDocumentUploadUrlSchema.parse(req.body ?? {});
    if (!isValidOwnStoragePath(authed.userId, body.storage_path)) {
      return reply.code(400).send({ error: "Invalid storage path" });
    }

    const { data, error } = await supabaseAdmin.storage
      .from("nurse-verification")
      .createSignedUploadUrl(body.storage_path);

    if (error || !data?.token) {
      return reply.code(400).send({ error: "Unable to create upload URL" });
    }

    return reply.send({
      bucket: "nurse-verification",
      path: data.path,
      token: data.token
    });
  });

  app.post("/nurse/verification-documents", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["nurse"]);

    const body = createVerificationDocumentSchema.parse(req.body ?? {});
    if (!isValidOwnStoragePath(authed.userId, body.storage_path)) {
      return reply.code(400).send({ error: "Invalid storage path" });
    }

    const sb = supabaseForUser(authed.jwt);
    const { data, error } = await sb
      .from("nurse_verification_documents")
      .insert({
        nurse_user_id: authed.userId,
        storage_bucket: "nurse-verification",
        storage_path: body.storage_path,
        document_type: body.document_type,
        status: "pending"
      })
      .select("id,nurse_user_id,storage_bucket,storage_path,document_type,status,reviewed_at,rejection_reason,created_at")
      .single();

    if (error) {
      if (isMissingVerificationDocumentsTable(error)) {
        return reply.code(503).send({ error: "Verification documents unavailable" });
      }
      const code = (error as any).code;
      return reply
        .code(code === "23505" ? 409 : 400)
        .send({ error: code === "23505" ? "Verification document already exists" : "Unable to save document" });
    }

    return reply.send({ document: data });
  });

  app.get("/nurse/verification-documents", async (req, reply) => {
    const authed = await requireAuth(req);
    requireRole(authed, ["nurse"]);

    const sb = supabaseForUser(authed.jwt);
    const { data, error } = await sb
      .from("nurse_verification_documents")
      .select("id,nurse_user_id,storage_bucket,storage_path,document_type,status,reviewed_at,rejection_reason,created_at")
      .eq("nurse_user_id", authed.userId)
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingVerificationDocumentsTable(error)) return reply.send({ documents: [] });
      return reply.code(400).send({ error: "Unable to load documents" });
    }

    return reply.send({ documents: data ?? [] });
  });
}
