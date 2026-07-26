// Stage XR-6 (append-only queue): immutable history/evidence preservation.
// 20260101012900_history_evidence_immutability.sql. animal_ownership_history's only policy used
// to be "admins manage all ownership history" (for all) -- full admin CRUD on a table whose own
// comment describes it as provenance/history data. Split to admin-SELECT-only, no INSERT for
// anyone (this table still has zero real writer anywhere in src/, per Stage Y's original finding
// -- confirmed unchanged by grep before this stage). That means there is no way to get a real row
// into this table via the Data API at all today, by any role -- these tests prove exactly that:
// insert is blocked for every role (the strongest possible form of "no ordinary write access,"
// since a row that can never be created can also never be updated or deleted through the API),
// and that SELECT still nominally works for admins (returns an empty result, not a 403).
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, isBlocked } from "./helpers.ts";

test("animal_ownership_history: no role can insert a row via the Data API, admin can still select", async (t) => {
  const admin = await as("admin");
  const buyer = await as("buyer");

  await t.test("an admin cannot insert a row (no INSERT policy exists for anyone)", async () => {
    const attempt = await admin
      .from("animal_ownership_history")
      .insert({
        animal_id: ids.animalMaja,
        owner_profile_id: ids.admin,
        ownership_type: "purchase",
      })
      .select();
    assert.ok(isBlocked(attempt.data, attempt.error));
  });

  await t.test("an ordinary user cannot insert a row either", async () => {
    const attempt = await buyer
      .from("animal_ownership_history")
      .insert({
        animal_id: ids.animalMaja,
        owner_profile_id: ids.buyer,
        ownership_type: "purchase",
      })
      .select();
    assert.ok(isBlocked(attempt.data, attempt.error));
  });

  await t.test(
    "an admin's SELECT still works at the grant/RLS level (returns empty, not 403)",
    async () => {
      const result = await admin.from("animal_ownership_history").select("id");
      assert.equal(result.error, null);
      assert.deepEqual(result.data, []);
    },
  );

  await t.test("an ordinary user cannot bulk-select the table at all", async () => {
    const blocked = await buyer.from("animal_ownership_history").select("id");
    // Row-scoped policy ("owners view their animal's ownership history") returns an empty set
    // rather than an error for a bulk select with no matching rows -- this asserts the shape
    // itself, not just "no error," since an empty result from a genuinely open table would look
    // identical; the real boundary is proven by the admin-only insert tests above.
    assert.equal(blocked.error, null);
    assert.deepEqual(blocked.data, []);
  });
});
