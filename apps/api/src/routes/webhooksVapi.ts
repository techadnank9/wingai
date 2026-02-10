import type { FastifyPluginAsync } from "fastify";
import { assertBearerAuth } from "../lib/http.js";

function mapStatusFromEvent(current: string, event: any): string | null {
  // Keep this permissive; Vapi event shapes vary by configuration.
  const type = event?.type ?? event?.message?.type ?? event?.event ?? null;
  const status = event?.status ?? event?.message?.status ?? null;

  // If Vapi sends explicit status updates, prefer them.
  if (typeof status === "string") {
    if (["queued", "dialing", "in_progress", "processing", "completed", "failed"].includes(status)) return status;
  }

  if (type === "call.connected" || type === "call-connected" || type === "connected") return "in_progress";
  if (type === "call.started" || type === "call-started" || type === "call_started") return current === "queued" ? "dialing" : current;
  if (type === "call.ended" || type === "call-ended" || type === "call_ended") return "processing";
  if (type === "call.failed" || type === "call-failed" || type === "call_failed") return "failed";

  // Vapi commonly sends an "end-of-call-report" server message.
  if (type === "end-of-call-report" || type === "end_of_call_report") return "processing";

  return null;
}

function extractVapiCallId(payload: any): string | null {
  return (
    payload?.call?.id ??
    payload?.callId ??
    payload?.id ??
    payload?.data?.call?.id ??
    payload?.data?.callId ??
    null
  );
}

function extractOrderJson(payload: any): any | null {
  // You should make your Vapi assistant put the final order JSON in one stable place.
  // Common patterns:
  // - payload.order
  // - payload.data.order
  // - payload.artifact.order
  // - payload.message?.analysis?.order
  return payload?.order ?? payload?.data?.order ?? payload?.artifact?.order ?? null;
}

export const webhooksVapiRoutes: FastifyPluginAsync = async (app) => {
  let lastWebhook: any = null;

  app.post("/webhooks/vapi", async (req, reply) => {
    const env = app.env;
    lastWebhook = req.body;
    app.log.info({ payload: req.body }, "vapi webhook");
    const ok = assertBearerAuth(req.headers.authorization, env.VAPI_WEBHOOK_BEARER);
    if (!ok) return reply.code(401).send({ error: "unauthorized" });

    const payload = req.body as any;
    const vapiCallId = extractVapiCallId(payload);
    if (!vapiCallId) return reply.code(400).send({ error: "missing_vapi_call_id" });

    // Find the call (created for outbound), or create for inbound.
    const { data: existing, error: findErr } = await app.sb
      .from("calls")
      .select("*")
      .eq("vapi_call_id", vapiCallId)
      .maybeSingle();

    if (findErr) {
      app.log.error({ findErr }, "failed to query call");
      return reply.code(500).send({ error: "db_error" });
    }

    let callId: string;
    let currentStatus: string;

    if (!existing) {
      // Inbound flow: create a call row on first webhook.
      const { data: created, error: insErr } = await app.sb
        .from("calls")
        .insert({
          created_by: null,
          direction: "inbound",
          status: "dialing",
          vapi_call_id: vapiCallId,
          last_event_at: new Date().toISOString(),
          raw: payload
        })
        .select("*")
        .single();

      if (insErr) {
        app.log.error({ insErr }, "failed to insert inbound call");
        return reply.code(500).send({ error: "db_error" });
      }
      callId = created.id;
      currentStatus = created.status;
    } else {
      callId = existing.id;
      currentStatus = existing.status;
    }

    const nextStatus = mapStatusFromEvent(currentStatus, payload);
    if (nextStatus) {
      const { error: updErr } = await app.sb
        .from("calls")
        .update({
          status: nextStatus,
          last_event_at: new Date().toISOString(),
          raw: payload
        })
        .eq("id", callId);
      if (updErr) app.log.error({ updErr }, "failed to update call status");
    } else {
      // Still store last seen payload for debugging.
      const { error: updErr } = await app.sb
        .from("calls")
        .update({
          last_event_at: new Date().toISOString(),
          raw: payload
        })
        .eq("id", callId);
      if (updErr) app.log.error({ updErr }, "failed to update call raw");
    }

    const order = extractOrderJson(payload);
    if (order) {
      // Idempotent: one order per call.
      const { data: orderRow, error: upsertErr } = await app.sb
        .from("orders")
        .upsert(
          {
            call_id: callId,
            status: "completed",
            customer_name: order?.customer?.name ?? null,
            customer_phone: order?.customer?.phone ?? null,
            total_cents: typeof order?.total_cents === "number" ? order.total_cents : null,
            payload: order,
            raw: payload
          },
          { onConflict: "call_id" }
        )
        .select("*")
        .single();

      if (upsertErr) {
        app.log.error({ upsertErr }, "failed to upsert order");
        await app.sb
          .from("calls")
          .update({
            status: "failed",
            error_code: "parse_error",
            error_message: "Order present but failed to save",
            last_event_at: new Date().toISOString()
          })
          .eq("id", callId);
        return reply.code(500).send({ error: "failed_to_save_order" });
      }

      // Mark call completed after order saved.
      await app.sb
        .from("calls")
        .update({
          status: "completed",
          last_event_at: new Date().toISOString()
        })
        .eq("id", callId);

      return reply.send({ ok: true, callId, orderId: orderRow.id });
    }

    return reply.send({ ok: true, callId });
  });

  // Debug-only helper for local dev. Remove after you paste a payload.
  app.get("/debug/last-webhook", async (_req, reply) => {
    if (!lastWebhook) return reply.code(404).send({ error: "no_webhook_seen" });
    return reply.send(lastWebhook);
  });
};
