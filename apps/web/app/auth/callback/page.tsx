"use client";
import { useEffect, useState } from "react";
import { makeClient } from "@bp/core";
import { createBrowserCallback } from "./complete";
const complete = createBrowserCallback(async (code) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase configuration");
  // This page owns the exchange; automatic URL detection would consume the code first.
  const db = makeClient(url, key, {
    auth: { flowType: "pkce", detectSessionInUrl: false },
  });
  const { error } = await db.auth.exchangeCodeForSession(code);
  if (error) throw error;
});
export default function Callback() {
  const [status, setStatus] = useState("Completing sign in…");
  useEffect(() => {
    let active = true;
    void complete(window.location.search).then(
      (destination) => {
        if (active) window.location.replace(destination);
      },
      (error) => {
        if (active)
          setStatus(
            error instanceof Error
              ? error.message
              : "Could not complete sign in. Please request a new link.",
          );
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className="setup">
      <h1>Business Partner</h1>
      <p role="status">{status}</p>
      <a href="/">Back to home</a>
    </main>
  );
}
