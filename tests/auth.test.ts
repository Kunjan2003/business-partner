import { test } from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../packages/core/src/client";

test("email/password registration requests verification before giving access", async () => {
  let payload: any;
  const db = {
    auth: { signUp: async (request: any) => {
      payload = request;
      return { data: { user: { id: "pending" }, session: null }, error: null };
    } },
  };
  await createApi(db as never).register(" person@example.com ", "secure-password-123", "https://app.example/auth/callback");
  assert.equal(payload.email, "person@example.com");
  assert.equal(payload.options.emailRedirectTo, "https://app.example/auth/callback");
  assert.equal(payload.options.data.signup_flow, "verified_onboarding");
});

test("registration refuses accidental immediate login when email confirmation is off", async () => {
  let signedOut = false;
  const db = { auth: {
    signUp: async () => ({ data: { user: { id: "unverified" }, session: { access_token: "x" } }, error: null }),
    signOut: async () => { signedOut = true; return { error: null }; },
  } };
  await assert.rejects(createApi(db as never).register("person@example.com", "secure-password-123", "https://app.example/auth/callback"), /Enable Confirm email/);
  assert.equal(signedOut, true);
});

test("magic-link sign-in never registers unknown users", async () => {
  let payload: any;
  const db = { auth: { signInWithOtp: async (request: any) => {
    payload = request;
    return { data: {}, error: null };
  } } };
  await createApi(db as never).magicLink("person@example.com", "https://app.example/auth/callback");
  assert.equal(payload.options.shouldCreateUser, false);
});

test("unverified sessions cannot complete profile setup", async () => {
  const db = { auth: { getUser: async () => ({
    data: { user: { id: "pending", email_confirmed_at: null, phone_confirmed_at: null } },
    error: null,
  }) } };
  await assert.rejects(createApi(db as never).finishOnboarding({
    display_name: "Business User", username: "business.user", role: "owner",
  }), /Verify your email/);
});

test("verified onboarding lowercases usernames and persists chosen account type", async () => {
  let change: Record<string, unknown> = {};
  const db = {
    auth: { getUser: async () => ({
      data: { user: { id: "verified-user", email_confirmed_at: "2026-10-15T01:00:00Z" } },
      error: null,
    }) },
    from: () => ({ update: (input: Record<string, unknown>) => {
      change = input;
      return { eq: () => ({ select: () => ({ single: async () => ({
        data: { id: "verified-user", ...input }, error: null,
      }) }) }) };
    } }),
  };
  const profile = await createApi(db as never).finishOnboarding({
    display_name: "  Local Shop ", username: "Local.Shop", role: "owner", bio: "Coffee and more",
  });
  assert.equal(change.username, "local.shop");
  assert.equal(change.role, "owner");
  assert.equal(change.onboarding_completed, true);
  assert.equal(profile.display_name, "Local Shop");
});
