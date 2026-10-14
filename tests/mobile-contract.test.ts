import { test } from "node:test";
import assert from "node:assert/strict";
import { createCallbackHandler } from "../apps/mobile/src/auth-callback";
import { createApi, explainError } from "../packages/core/src";
test("native OAuth exchanges duplicate Linking/browser callbacks only once", async () => {
  let calls = 0;
  const complete = createCallbackHandler(async () => {
    calls++;
  });
  await Promise.all([
    complete("businesspartner://auth/callback?code=test-code"),
    complete("businesspartner://auth/callback?code=test-code"),
  ]);
  assert.equal(calls, 1);
  assert.equal(
    await complete("https://unrelated.example/auth/callback?code=another"),
    false,
  );
  assert.equal(calls, 1);
});
test("provider errors remain visible and cannot be mistaken for success", async () => {
  const complete = createCallbackHandler(async () => {});
  await assert.rejects(
    complete(
      "businesspartner://auth/callback?error_description=Login%20denied",
    ),
    /Login denied/,
  );
});
test("login accepts existing valid passwords rather than enforcing new-signup strength", async () => {
  let called = false;
  const api = createApi({
    auth: {
      signInWithPassword: () => {
        called = true;
        return Promise.resolve({ data: {}, error: null });
      },
    },
  } as never);
  await api.signIn("user@example.com", "old123");
  assert.equal(called, true);
});
test("missing RPC and network errors produce actionable messages", () => {
  assert.match(explainError({ code: "PGRST202" }), /migrations/);
  assert.match(
    explainError({ message: "Network request failed" }),
    /connection/,
  );
});
test("empty native files are rejected before storage upload", async () => {
  await assert.rejects(
    createApi({} as never).uploadImage(new ArrayBuffer(0), "image/jpeg"),
    /empty/,
  );
});

test("chat response mapping includes customer/owner names and normalizes unread counts", async () => {
  const requests: URL[] = [];
  const { makeClient } = await import("../packages/core/src");
  const db = makeClient("https://backend.example", "public-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input) => {
        const url = new URL(String(input));
        requests.push(url);
        const body = url.pathname.endsWith("/chats")
          ? [
              {
                id: "chat",
                customer_id: "customer",
                business_id: "business",
                businesses: {
                  name: "Coffee",
                  owner: { display_name: "Owner" },
                },
                customer: { display_name: "Asha" },
              },
            ]
          : [{ chat_id: "chat", unread: "2" }];
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  });
  const rows = await createApi(db).chats();
  assert.equal(rows[0].customer?.display_name, "Asha");
  assert.equal(rows[0].unread, 2);
  assert.match(
    requests[0].searchParams.get("select")!,
    /chats_customer_id_fkey/,
  );
  assert.match(
    requests[0].searchParams.get("select")!,
    /businesses_owner_id_fkey/,
  );
});
test("profile repair requests a singular RPC response instead of misreading a row array", async () => {
  let accept = "";
  const { makeClient } = await import("../packages/core/src");
  const db = makeClient("https://backend.example", "public-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (_input, init) => {
        accept = new Headers(init?.headers).get("Accept") ?? "";
        return new Response(
          JSON.stringify({
            id: "member",
            display_name: "Member",
            role: "customer",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  });
  const profile = await createApi(db).ensureProfile();
  assert.equal(profile.display_name, "Member");
  assert.match(accept, /vnd.pgrst.object/);
});
