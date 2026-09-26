import assert from "node:assert/strict";
import test from "node:test";

import { getPublicOrigin, shouldUseSecureCookies } from "../lib/request-origin";
import { createPublicIdentity } from "../lib/session";

test("concurrent anonymous clients receive different principals", () => {
  const identities = Array.from({ length: 1000 }, () => createPublicIdentity().email);
  assert.equal(new Set(identities).size, identities.length);
  assert.ok(identities.every((email) => email.startsWith("guest+") && email.endsWith("@public.local")));
});

test("configured public origin controls redirects and cookie security", () => {
  const previousWebOrigin = process.env.WEB_ORIGIN;
  const previousNextAuthUrl = process.env.NEXTAUTH_URL;

  try {
    process.env.WEB_ORIGIN = "https://civis.example";
    delete process.env.NEXTAUTH_URL;
    const request = new Request("http://0.0.0.0:3000/api/session/public/bootstrap");
    assert.equal(getPublicOrigin(request), "https://civis.example");
    assert.equal(shouldUseSecureCookies(request), true);

    process.env.WEB_ORIGIN = "http://127.0.0.1:3000";
    assert.equal(shouldUseSecureCookies(request), false);
  } finally {
    if (previousWebOrigin === undefined) delete process.env.WEB_ORIGIN;
    else process.env.WEB_ORIGIN = previousWebOrigin;
    if (previousNextAuthUrl === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = previousNextAuthUrl;
  }
});
