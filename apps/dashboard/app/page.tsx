"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseBrowser";
import { apiPost } from "../lib/api";
import { useRouter } from "next/navigation";

type CallRow = {
  id: string;
  created_at: string;
  direction: "outbound" | "inbound";
  customer_name: string | null;
  customer_phone: string | null;
  status: "queued" | "dialing" | "in_progress" | "processing" | "completed" | "failed";
  vapi_call_id: string | null;
  error_code: string | null;
  error_message: string | null;
};

type OrderRow = {
  id: string;
  created_at: string;
  call_id: string;
  status: "completed" | "failed";
  total_cents: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  payload: any;
};

function pillClass(status: string) {
  if (status === "completed") return "pill ok";
  if (status === "failed") return "pill bad";
  return "pill";
}

export default function HomePage() {
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [customerPhone, setCustomerPhone] = useState("+1");
  const [customerName, setCustomerName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const sortedCalls = useMemo(
    () => [...calls].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [calls]
  );
  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [orders]
  );

  useEffect(() => {
    let mounted = true;

    async function load() {
      setErr(null);
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        router.replace("/auth");
        return;
      }

      const [c, o] = await Promise.all([
        supabase.from("calls").select("*").limit(50),
        supabase.from("orders").select("*").limit(50)
      ]);
      if (!mounted) return;
      if (c.error) setErr(c.error.message);
      else setCalls((c.data ?? []) as any);
      if (o.error) setErr(o.error.message);
      else setOrders((o.data ?? []) as any);
    }

    load();

    const callsCh = supabase
      .channel("realtime:calls")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls" },
        (payload) => {
          const row = (payload.new ?? payload.old) as any as CallRow;
          setCalls((prev) => {
            const next = prev.filter((x) => x.id !== row.id);
            return [row, ...next].slice(0, 200);
          });
        }
      )
      .subscribe();

    const ordersCh = supabase
      .channel("realtime:orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          const row = (payload.new ?? payload.old) as any as OrderRow;
          setOrders((prev) => {
            const next = prev.filter((x) => x.id !== row.id);
            return [row, ...next].slice(0, 200);
          });
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(callsCh);
      supabase.removeChannel(ordersCh);
    };
  }, []);

  async function triggerCall() {
    setBusy(true);
    setErr(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not signed in");

      await apiPost<{ callId: string; status: string }>("/calls", {
        customerPhone,
        customerName: customerName || undefined
      }, token);
      setCustomerPhone("");
      setCustomerName("");
    } catch (e: any) {
      setErr(e?.message ?? "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid">
      <section className="card">
        <h2>Orders</h2>
        <table className="table">
          <thead>
            <tr>
              <th>created</th>
              <th>status</th>
              <th>customer</th>
              <th>total</th>
              <th>id</th>
            </tr>
          </thead>
          <tbody>
            {sortedOrders.map((o) => (
              <tr key={o.id}>
                <td className="muted">{new Date(o.created_at).toLocaleString()}</td>
                <td>
                  <span className={pillClass(o.status)}>{o.status}</span>
                </td>
                <td>
                  <div>{o.customer_name ?? "-"}</div>
                  <div className="muted">{o.customer_phone ?? "-"}</div>
                </td>
                <td className="mono">{typeof o.total_cents === "number" ? `$${(o.total_cents / 100).toFixed(2)}` : "-"}</td>
                <td className="mono">{o.id.slice(0, 8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <aside className="card">
        <h2>Call Customer</h2>
        <div className="row" style={{ marginBottom: 10 }}>
          <input
            className="input"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="Customer phone"
          />
        </div>
        <div className="row" style={{ marginBottom: 10 }}>
          <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name (optional)" />
        </div>
        <button className="btn" onClick={triggerCall} disabled={busy || !customerPhone}>
          {busy ? "Calling..." : "Call customer"}
        </button>

        {err ? (
          <div style={{ marginTop: 10 }} className="mono">
            {err}
          </div>
        ) : null}

        <div style={{ marginTop: 14 }}>
          <h2>Recent Calls</h2>
          <table className="table">
            <thead>
              <tr>
                <th>created</th>
                <th>dir</th>
                <th>status</th>
                <th>phone</th>
              </tr>
            </thead>
            <tbody>
              {sortedCalls.slice(0, 20).map((c) => (
                <tr key={c.id}>
                  <td className="muted">{new Date(c.created_at).toLocaleString()}</td>
                  <td className="mono">{c.direction}</td>
                  <td>
                    <span className={pillClass(c.status)}>{c.status}</span>
                  </td>
                  <td className="mono">{c.customer_phone ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  );
}
