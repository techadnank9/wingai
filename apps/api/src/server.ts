import Fastify from "fastify";
import { getEnv, type Env } from "./env.js";
import { supabaseAdmin } from "./lib/supabaseAdmin.js";
import { callsRoutes } from "./routes/calls.js";
import { webhooksVapiRoutes } from "./routes/webhooksVapi.js";

declare module "fastify" {
  interface FastifyInstance {
    env: Env;
    sb: ReturnType<typeof supabaseAdmin>;
  }
}

const env = getEnv();
const app = Fastify({ logger: true });

app.decorate("env", env);
app.decorate("sb", supabaseAdmin(env));

// CORS (minimal): allow dashboard origin in dev.
app.addHook("onRequest", async (req, reply) => {
  const origin = req.headers.origin;
  if (origin && env.PUBLIC_DASHBOARD_ORIGIN && origin === env.PUBLIC_DASHBOARD_ORIGIN) {
    reply.header("access-control-allow-origin", origin);
    reply.header("access-control-allow-credentials", "true");
    reply.header("access-control-allow-headers", "content-type, authorization");
    reply.header("access-control-allow-methods", "GET,POST,OPTIONS");
  }
  if (req.method === "OPTIONS") return reply.code(204).send();
});

app.get("/health", async () => ({ ok: true }));

await app.register(callsRoutes);
await app.register(webhooksVapiRoutes);

app.setErrorHandler((err, _req, reply) => {
  app.log.error(err);
  reply.code(500).send({ error: "internal_error" });
});

await app.listen({ port: env.PORT, host: "0.0.0.0" });
