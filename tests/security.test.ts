/** Relational/RLS tests against PostgreSQL WASM. PostGIS/search are explicitly excluded;
 * the unmodified migration and real geospatial functions run in the Supabase CI job. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
test("database enforces business ownership, chat privacy, blocks and admin boundaries", async (t) => {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`create role anon; create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;grant select on storage.objects to anon;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 create publication supabase_realtime;`);
  let sql = readFileSync(
    "supabase/migrations/202610140001_initial.sql",
    "utf8",
  );
  sql = sql
    .replace(
      "create extension if not exists postgis with schema extensions;",
      "",
    )
    .replace(
      /location geography\(point,4326\) generated always as \([^\n]+ stored,/,
      "location text,",
    )
    .replace(
      "create index businesses_location_idx on businesses using gist(location);",
      "",
    )
    .replace(/create function public.search_market\([\s\S]+?\$\$;\n/, "")
    .replace(/grant execute on function public.search_market[^\n]+\n/, "");
  await db.exec(sql);
  await db.exec(
    readFileSync(
      "supabase/migrations/202610140002_mobile_integration.sql",
      "utf8",
    ),
  );
  const owner = "11111111-1111-4111-8111-111111111111",
    customer = "22222222-2222-4222-8222-222222222222",
    stranger = "33333333-3333-4333-8333-333333333333";
  await db.query(
    `insert into auth.users values ($1,'{"display_name":"Owner","role":"owner"}'),($2,'{"display_name":"Customer","role":"customer"}'),($3,'{"display_name":"Stranger","role":"admin"}')`,
    [owner, customer, stranger],
  );
  async function as(id: string) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role authenticated");
  }
  async function count(sql: string) {
    return Number((await db.query<{ n: number }>(sql)).rows[0].n);
  }
  await t.test("untrusted signup metadata cannot create an admin", async () => {
    await as(stranger);
    assert.equal(
      (
        await db.query<{ role: string }>(
          "select role from profiles where id=auth.uid()",
        )
      ).rows[0].role,
      "customer",
    );
    assert.equal(
      (await db.query<{ v: boolean }>("select is_admin() v")).rows[0].v,
      false,
    );
    await assert.rejects(
      db.query("insert into admins values($1)", [stranger]),
      /permission denied/,
    );
  });
  await t.test(
    "profile repair is self-only and cannot assign admin",
    async () => {
      await as(stranger);
      await db.exec("reset role");
      await db.query("delete from profiles where id=$1", [stranger]);
      await as(stranger);
      const p = (
        await db.query<{ role: string }>("select (ensure_profile()).role")
      ).rows[0];
      assert.equal(p.role, "customer");
      assert.equal(
        (await db.query<{ v: boolean }>("select is_admin() v")).rows[0].v,
        false,
      );
    },
  );
  await t.test(
    "Google full_name metadata maps to a usable public profile",
    async () => {
      await db.exec("reset role");
      await db.query(
        "insert into auth.users(id,raw_user_meta_data) values('44444444-4444-4444-8444-444444444444','{\"full_name\":\"Google Member\"}')",
      );
      assert.equal(
        (
          await db.query<{ display_name: string }>(
            "select display_name from profiles where id='44444444-4444-4444-8444-444444444444'",
          )
        ).rows[0].display_name,
        "Google Member",
      );
    },
  );
  await as(owner);
  const business = (
    await db.query<{ id: string }>(
      "insert into businesses(owner_id,name,category,address,latitude,longitude) values(auth.uid(),'Coffee House','Food','12 Main Road',23.1,72.5) returning id",
    )
  ).rows[0].id;
  const post = (
    await db.query<{ id: string }>(
      "insert into posts(business_id,caption) values($1,'Fresh coffee') returning id",
      [business],
    )
  ).rows[0].id;
  await t.test("customers cannot create or edit business content", async () => {
    await as(customer);
    await assert.rejects(
      db.query(
        "insert into businesses(owner_id,name,category,address,latitude,longitude) values(auth.uid(),'Fake shop','Food','12 Main Road',0,0)",
      ),
      /row-level security/,
    );
    await db.query("update businesses set name='Hijacked' where id=$1", [
      business,
    ]);
    assert.equal(
      (
        await db.query<{ name: string }>(
          "select name from businesses where id=$1",
          [business],
        )
      ).rows[0].name,
      "Coffee House",
    );
    await assert.rejects(
      db.query("insert into posts(business_id,caption) values($1,'Hijacked')", [
        business,
      ]),
      /row-level security/,
    );
  });
  await t.test(
    "owners cannot reassign ownership or unhide moderated content",
    async () => {
      await as(owner);
      await assert.rejects(
        db.query("update businesses set owner_id=$1 where id=$2", [
          customer,
          business,
        ]),
        /permission denied/,
      );
      await assert.rejects(
        db.query("update posts set hidden=false where id=$1", [post]),
        /permission denied/,
      );
    },
  );
  await as(customer);
  const chat = (
    await db.query<{ id: string }>("select start_chat($1) id", [business])
  ).rows[0].id;
  await db.query(
    "insert into messages(chat_id,sender_id,body) values($1,auth.uid(),'Hello')",
    [chat],
  );
  await t.test(
    "a third user cannot read, forge or join a conversation",
    async () => {
      await as(stranger);
      assert.equal(await count("select count(*) n from messages"), 0);
      assert.equal(await count("select count(*) n from chats"), 0);
      await assert.rejects(
        db.query(
          "insert into messages(chat_id,sender_id,body) values($1,auth.uid(),'Intrusion')",
          [chat],
        ),
        /row-level security/,
      );
      await assert.rejects(
        db.query("select mark_chat_read($1)", [chat]),
        /Forbidden/,
      );
    },
  );
  await t.test("only the sender can author their own message", async () => {
    await as(customer);
    await assert.rejects(
      db.query(
        "insert into messages(chat_id,sender_id,body) values($1,$2,'Forged')",
        [chat, owner],
      ),
      /row-level security/,
    );
  });
  await t.test(
    "owner receives notifications and unread counts but cannot rewrite them",
    async () => {
      await as(owner);
      assert.equal(await count("select count(*) n from notifications"), 1);
      assert.equal(
        Number(
          (await db.query<{ unread: number }>("select * from unread_counts()"))
            .rows[0].unread,
        ),
        1,
      );
      await assert.rejects(
        db.query("update notifications set body='forged'"),
        /permission denied/,
      );
      await db.query("select mark_chat_read($1)", [chat]);
      assert.equal(
        (await db.query("select * from unread_counts()")).rows.length,
        0,
      );
    },
  );
  await t.test("private chat images enforce participant access", async () => {
    await as(customer);
    await db.query(
      "insert into storage.objects(bucket_id,name) values('chat-images',$1)",
      [`${chat}/${customer}/photo.jpg`],
    );
    assert.equal(
      await count(
        "select count(*) n from storage.objects where bucket_id='chat-images'",
      ),
      1,
    );
    await as(stranger);
    assert.equal(
      await count(
        "select count(*) n from storage.objects where bucket_id='chat-images'",
      ),
      0,
    );
    await assert.rejects(
      db.query(
        "insert into storage.objects(bucket_id,name) values('chat-images',$1)",
        [`${chat}/${stranger}/photo.jpg`],
      ),
      /row-level security/,
    );
  });
  await t.test(
    "message image cannot reference another sender’s private path",
    async () => {
      await as(owner);
      await assert.rejects(
        db.query(
          "insert into messages(chat_id,sender_id,body,image_path) values($1,auth.uid(),'',$2)",
          [chat, `${chat}/${customer}/photo.jpg`],
        ),
        /row-level security/,
      );
    },
  );
  await t.test("reporting does not confer moderation privileges", async () => {
    await as(customer);
    const report = (
      await db.query<{ id: string }>(
        "insert into reports(reporter_id,target_type,target_id,reason) values(auth.uid(),'post',$1,'Inappropriate listing') returning id",
        [post],
      )
    ).rows[0].id;
    await assert.rejects(
      db.query("select moderate_report($1,true)", [report]),
      /Admin access required/,
    );
  });
  await t.test("blocking revokes messaging in both directions", async () => {
    await as(owner);
    await db.query("insert into blocks values(auth.uid(),$1)", [customer]);
    assert.equal(await count("select count(*) n from messages"), 0);
    await as(customer);
    assert.equal(await count("select count(*) n from messages"), 0);
    assert.equal(await count("select count(*) n from businesses"), 0);
    await assert.rejects(
      db.query("select start_chat($1)", [business]),
      /Cannot start/,
    );
  });
  await t.test("write rate limits are enforced by the database", async () => {
    await as(stranger);
    for (let i = 0; i < 20; i++)
      await db.query(
        "insert into reports(reporter_id,target_type,target_id,reason) values(auth.uid(),'post',$1,'Testing rate limits')",
        [post],
      );
    await assert.rejects(
      db.query(
        "insert into reports(reporter_id,target_type,target_id,reason) values(auth.uid(),'post',$1,'Testing rate limits')",
        [post],
      ),
      /Rate limit exceeded/,
    );
  });
  await db.close();
});
