import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { vapiCreateCall } from "../lib/vapi.js";

const CreateCallBody = z.object({
  customerPhone: z.string().min(7),
  customerName: z.string().min(1).optional(),
  metadata: z.record(z.any()).optional()
});

export const callsRoutes: FastifyPluginAsync = async (app) => {
  app.post("/calls", async (req, reply) => {
    const env = app.env;
    const body = CreateCallBody.parse(req.body ?? {});

    // Require Supabase Auth for staff-triggered outbound calls.
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return reply.code(401).send({ error: "missing_auth" });
    const token = auth.slice("Bearer ".length);
    const { data: userData, error: userErr } = await app.sb.auth.getUser(token);
    if (userErr || !userData.user) return reply.code(401).send({ error: "invalid_auth" });

    // Create a call row first for traceability.
    const { data: callRow, error: callErr } = await app.sb
      .from("calls")
      .insert({
        created_by: userData.user.id,
        direction: "outbound",
        customer_name: body.customerName ?? null,
        customer_phone: body.customerPhone,
        status: "queued",
        metadata: body.metadata ?? {}
      })
      .select("*")
      .single();

    if (callErr) {
      app.log.error({ callErr }, "failed to insert call");
      return reply.code(500).send({ error: "failed_to_create_call" });
    }

    try {
      const vapi = await vapiCreateCall(env, {
        assistantId: env.VAPI_ASSISTANT_ID,
        phoneNumberId: env.VAPI_PHONE_NUMBER_ID,
        customer: { number: body.customerPhone, name: body.customerName },
        metadata: {
          callId: callRow.id,
          ...(body.metadata ?? {})
        }
      });

      const { error: updErr } = await app.sb
        .from("calls")
        .update({
          status: "dialing",
          vapi_call_id: vapi.id,
          last_event_at: new Date().toISOString()
        })
        .eq("id", callRow.id);

      if (updErr) {
        app.log.error({ updErr }, "failed to update call with vapi id");
      }

      return reply.send({ callId: callRow.id, vapiCallId: vapi.id, status: "dialing" });
    } catch (e: any) {
      const msg = e?.message ?? "unknown";
      await app.sb
        .from("calls")
        .update({
          status: "failed",
          error_code: "dial_failed",
          error_message: msg,
          last_event_at: new Date().toISOString()
        })
        .eq("id", callRow.id);

      return reply.code(502).send({ error: "vapi_create_call_failed", message: msg, callId: callRow.id });
    }
  });
};
