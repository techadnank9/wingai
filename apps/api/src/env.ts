import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

function loadDotEnv() {
  // Minimal .env loader (no dependencies).
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const EnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  VAPI_API_KEY: z.string().min(10),
  VAPI_PHONE_NUMBER_ID: z.string().min(3),
  VAPI_ASSISTANT_ID: z.string().min(3),

  // Recommended: configure Vapi webhook auth as a bearer token and verify it here.
  VAPI_WEBHOOK_BEARER: z.string().min(10),

  PUBLIC_DASHBOARD_ORIGIN: z.string().url().optional(),
  PORT: z.coerce.number().int().positive().default(4000)
});

export type Env = z.infer<typeof EnvSchema>;

export function getEnv(): Env {
  loadDotEnv();
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Keep it obvious and fail-fast in dev/prod.
    // eslint-disable-next-line no-console
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables for API");
  }
  return parsed.data;
}
