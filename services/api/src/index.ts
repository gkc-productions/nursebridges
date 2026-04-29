import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { jobRoutes } from "./routes/jobs";
import { applicationRoutes } from "./routes/applications";
import { meRoutes } from "./routes/me";
import { adminRoutes } from "./routes/admin";

const app = Fastify({
  logger: true
});

const PORT = Number(process.env.PORT || 3000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

app.get("/health", async () => {
  return { ok: true, service: "nursebridge-api", ts: new Date().toISOString() };
});

async function main() {
  await app.register(cors, { origin: CORS_ORIGIN });

  await meRoutes(app);
  await jobRoutes(app);
  await applicationRoutes(app);
  await adminRoutes(app);

  // Error handler (consistent responses)
  app.setErrorHandler((err: any, _req, reply) => {
    const statusCode = err?.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const msg = err?.message || "Server error";
    reply.code(statusCode).send({ error: msg });
  });

  await app.listen({ port: PORT, host: "0.0.0.0" });
  app.log.info(`API listening on http://0.0.0.0:${PORT}`);
}

main().catch((e) => {
  app.log.error(e);
  process.exit(1);
});
