import { test } from "node:test";
import assert from "node:assert/strict";
import { createBrowserCallback } from "../apps/web/app/auth/callback/complete";

test("web callback exchanges a single-use code once across repeated effects", async () => {
  let calls = 0;
  const complete = createBrowserCallback(async () => {
    calls++;
  });
  assert.deepEqual(
    await Promise.all([
      complete("?code=single-use"),
      complete("?code=single-use"),
    ]),
    ["/", "/"],
  );
  assert.equal(calls, 1);
  assert.equal(await complete("?code=single-use"), "/");
  assert.equal(calls, 1);
});
test("web callback preserves recovery routing and never accepts an external redirect", async () => {
  const complete = createBrowserCallback(async () => {});
  assert.equal(
    await complete("?code=recover&recovery=1&next=https://evil.example"),
    "/?recovery=1",
  );
  assert.equal(await complete("?code=login&next=https://evil.example"), "/");
});
test("web callback displays missing-code, provider and exchange errors", async () => {
  let calls = 0;
  const complete = createBrowserCallback(async () => {
    calls++;
    throw new Error("This link has expired");
  });
  await assert.rejects(
    complete("?error_description=Access%20denied"),
    /Access denied/,
  );
  await assert.rejects(complete(""), /No sign-in code/);
  assert.equal(calls, 0);
  await assert.rejects(complete("?code=expired"), /link has expired/);
  await assert.rejects(complete("?code=expired"), /link has expired/);
  assert.equal(calls, 1);
});
