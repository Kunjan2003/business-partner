"use client";
import { useEffect, useState } from "react";
import { makeClient } from "@bp/core";
export default function Callback() {
  const [status, setStatus] = useState("Completing sign in…");
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setStatus("Missing Supabase configuration");
      return;
    }
    const db = makeClient(url, key, { auth: { flowType: "pkce" } });
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) {
      setStatus(
        params.get("error_description") ??
          "No sign-in code. Please try signing in again.",
      );
      return;
    }
    db.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) setStatus(error.message);
      else window.location.replace("/");
    });
  }, []);
  return (
    <main className="setup">
      <h1>Business Partner</h1>
      <p role="status">{status}</p>
      <a href="/">Back to home</a>
    </main>
  );
}
