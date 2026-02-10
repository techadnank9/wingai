"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseBrowser";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Prefill for quick local testing.
    setEmail("mdadnan456@gmail.com");
    setPassword("wingai");
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const email = session?.user?.email ?? null;
      setUserEmail(email);
      if (email) {
        setTimeout(() => router.replace("/"), 5000);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr(error.message);
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setErr(error.message);
  }

  async function signOut() {
    setErr(null);
    const { error } = await supabase.auth.signOut();
    if (error) setErr(error.message);
  }

  return (
    <div className="card">
      <h2>Supabase Auth</h2>
      {userEmail ? (
        <>
          <div className="row">
            <div className="mono">Signed in as: {userEmail}</div>
            <button className="btn btnDanger" onClick={signOut}>
              Sign out
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={signIn} className="grid" style={{ gridTemplateColumns: "1fr", gap: 10 }}>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
          />
          <div className="row" style={{ justifyContent: "flex-start" }}>
            <button className="btn" type="submit">
              Sign in
            </button>
            <button className="btn" type="button" onClick={signUp}>
              Sign up
            </button>
          </div>
        </form>
      )}
      {err ? <div style={{ marginTop: 10 }} className="mono">{err}</div> : null}
      <div style={{ marginTop: 10 }} className="muted">
        Redirecting to home shortly after sign-in.
      </div>
    </div>
  );
}
