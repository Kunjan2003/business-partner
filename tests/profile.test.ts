import { test } from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../packages/core/src/client";
import { profileDetailsSchema } from "../packages/core/src/schema";
const details = {
  display_name: "  Local Coffee ",
  username: "Local.Coffee",
  bio: "Fresh coffee",
  website: "https://coffee.example",
  role: "owner" as const,
};
test("profile validation normalizes identity and rejects unsafe links and oversized bios", () => {
  assert.equal(profileDetailsSchema.parse(details).username, "local.coffee");
  assert.equal(
    profileDetailsSchema.parse(details).display_name,
    "Local Coffee",
  );
  for (const website of [
    "javascript:alert(1)",
    "ftp://example.com",
    "example.com",
  ])
    assert.equal(
      profileDetailsSchema.safeParse({ ...details, website }).success,
      false,
    );
  assert.equal(
    profileDetailsSchema.safeParse({ ...details, bio: "a".repeat(161) })
      .success,
    false,
  );
  assert.equal(
    profileDetailsSchema.safeParse({ ...details, username: "a b" }).success,
    false,
  );
});
test("profile saves scope the update to the authenticated user and preserve omitted photos", async () => {
  let payload: any, filter: any;
  const db = {
    auth: {
      getUser: async () => ({ data: { user: { id: "self" } }, error: null }),
    },
    from: (table: string) => {
      assert.equal(table, "profiles");
      return {
        update: (value: any) => {
          payload = value;
          return {
            eq: (field: string, id: string) => {
              filter = [field, id];
              return {
                select: () => ({
                  single: async () => ({ data: { id, ...value }, error: null }),
                }),
              };
            },
          };
        },
      };
    },
  };
  await createApi(db as never).saveProfile(details);
  assert.deepEqual(filter, ["id", "self"]);
  assert.equal(payload.username, "local.coffee");
  assert.equal("avatar_url" in payload, false);
  await createApi(db as never).saveProfile({ ...details, avatar_url: "" });
  assert.equal(payload.avatar_url, "");
});
test("duplicate usernames produce an actionable error", async () => {
  const db = {
    auth: {
      getUser: async () => ({ data: { user: { id: "self" } }, error: null }),
    },
    from: () => ({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: async () => ({ data: null, error: { code: "23505" } }),
          }),
        }),
      }),
    }),
  };
  await assert.rejects(
    createApi(db as never).saveProfile(details),
    /username is already taken/,
  );
});
test("password recovery requests the supplied callback and password changes require a session", async () => {
  let request: unknown;
  const db = {
    auth: {
      resetPasswordForEmail: async (...args: unknown[]) => {
        request = args;
        return { data: {}, error: null };
      },
      getUser: async () => ({ data: { user: null }, error: null }),
      updateUser: async () => {
        throw new Error("must not run");
      },
    },
  };
  const api = createApi(db as never);
  await api.resetPassword(
    " user@example.com ",
    "https://app.example/auth/callback?recovery=1",
  );
  assert.deepEqual(request, [
    "user@example.com",
    { redirectTo: "https://app.example/auth/callback?recovery=1" },
  ]);
  await assert.rejects(api.changePassword("valid-password"), /Please sign in/);
  await assert.rejects(api.changePassword("short"));
});

test("profile website migration enforces safe links and only grants website updates", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { readFileSync } = await import("node:fs");
  const db = new PGlite();
  try {
    await db.exec(
      "create role authenticated; create table public.profiles(id text primary key, display_name text); insert into profiles values('self','Original'); grant select on profiles to authenticated;",
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/202610230001_profile_details.sql",
        "utf8",
      ),
    );
    await db.exec(
      "set role authenticated; update profiles set website='https://example.com' where id='self';",
    );
    await assert.rejects(
      db.exec(
        "update profiles set website='javascript:alert(1)' where id='self'",
      ),
      /profiles_website_valid/,
    );
    await assert.rejects(
      db.exec("update profiles set display_name='Forbidden' where id='self'"),
      /permission denied/,
    );
    const rows = await db.query<{ website: string }>(
      "select website from profiles where id='self'",
    );
    assert.equal(rows.rows[0].website, "https://example.com");
  } finally {
    await db.close();
  }
});
