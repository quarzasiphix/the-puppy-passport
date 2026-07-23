// Pure logic tests — no Supabase, no browser, no network. Run with `npm run test:unit`.
// Exercises the organisation-type → profile-route decision shared by the community feed
// (organisation-authored posts) and public user profiles (linked professional profile), so a
// kennel can never resolve to /foundations/$slug or vice versa.
import { test } from "node:test";
import assert from "node:assert/strict";
import { orgProfileRoute } from "../../src/lib/org-routing.ts";

test("orgProfileRoute", async (t) => {
  await t.test("kennel routes to the breeder profile", () => {
    assert.equal(orgProfileRoute("kennel"), "/breeders/$slug");
  });

  await t.test("foundation routes to the foundation profile", () => {
    assert.equal(orgProfileRoute("foundation"), "/foundations/$slug");
  });

  await t.test("shelter routes to the foundation profile", () => {
    assert.equal(orgProfileRoute("shelter"), "/foundations/$slug");
  });

  await t.test("rescue routes to the foundation profile", () => {
    assert.equal(orgProfileRoute("rescue"), "/foundations/$slug");
  });

  await t.test(
    "an unexpected org_type falls back to the foundation profile, never the breeder one",
    () => {
      // Defensive: org_type is a Postgres enum today, but this function takes a plain string, so a
      // future enum value (e.g. "transport_company") must not silently render as a breeder page.
      assert.equal(orgProfileRoute("transport_company"), "/foundations/$slug");
    },
  );
});
