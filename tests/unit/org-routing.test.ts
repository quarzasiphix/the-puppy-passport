// Pure logic tests — no Supabase, no browser, no network. Run with `npm run test:unit`.
// Exercises the organisation-type → profile-route decision shared by the community feed
// (organisation-authored posts) and public user profiles (linked professional profile), so a
// kennel can never resolve to /foundations/$slug or vice versa.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isFoundationOrgType,
  orgProfileRoute,
  toFoundationOrgType,
} from "../../src/lib/org-routing.ts";

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

test("isFoundationOrgType", async (t) => {
  await t.test("foundation, shelter and rescue are foundation org types", () => {
    assert.equal(isFoundationOrgType("foundation"), true);
    assert.equal(isFoundationOrgType("shelter"), true);
    assert.equal(isFoundationOrgType("rescue"), true);
  });

  await t.test("kennel is not a foundation org type", () => {
    assert.equal(isFoundationOrgType("kennel"), false);
  });

  await t.test("an unknown org_type is not a foundation org type", () => {
    assert.equal(isFoundationOrgType("transport_company"), false);
  });
});

test("toFoundationOrgType", async (t) => {
  await t.test("passes through each real foundation org type unchanged", () => {
    assert.equal(toFoundationOrgType("foundation"), "foundation");
    assert.equal(toFoundationOrgType("shelter"), "shelter");
    assert.equal(toFoundationOrgType("rescue"), "rescue");
  });

  await t.test("an unexpected org_type defensively falls back to 'foundation'", () => {
    // mapOrgToFoundation only ever calls this for rows already filtered to org_type in
    // (foundation, shelter, rescue), so this branch shouldn't be reachable today — but the
    // function takes a plain string, so it must resolve to a valid value, not throw.
    assert.equal(toFoundationOrgType("kennel"), "foundation");
    assert.equal(toFoundationOrgType("something_new"), "foundation");
  });
});
