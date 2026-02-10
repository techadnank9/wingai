import type { Env } from "../env.js";

export type VapiCreateCallRequest = {
  assistantId: string;
  phoneNumberId: string;
  customer: {
    number: string;
    name?: string;
  };
  metadata?: Record<string, any>;
};

export type VapiCreateCallResponse = {
  id: string;
};

export async function vapiCreateCall(env: Env, input: VapiCreateCallRequest): Promise<VapiCreateCallResponse> {
  const res = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.VAPI_API_KEY}`
    },
    body: JSON.stringify(input)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Vapi create-call failed: ${res.status} ${text}`);
  }
  return (await res.json()) as VapiCreateCallResponse;
}

