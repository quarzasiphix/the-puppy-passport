// Stage CJR (third/fourth supplemental queue): notification deduplication
// (20260101012100_notification_deduplication.sql). create_notification_if_enabled() (Stage H) is
// the one real producer every notifyUser() call routes through, but had no dedup concept -- a
// retry, a double-click on an unguarded action (e.g. approveRehomingReview() has no status guard),
// or a genuine concurrent race could each independently create a duplicate notification for the
// same real-world event. New p_dedup_key parameter, enforced by a real partial unique index
// (profile_id, dedup_key) where dedup_key is not null -- these tests prove the DB constraint
// itself, not just the happy path.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids } from "./helpers.ts";

test("create_notification_if_enabled: same dedup_key does not duplicate", async (t) => {
  const buyer = await as("buyer");
  const dedupKey = `cjr-test-${Date.now()}`;
  let firstId: string | undefined;

  await t.test("the first call creates a real notification", async () => {
    const call = await buyer.rpc("create_notification_if_enabled", {
      p_profile_id: ids.buyer,
      p_category: "applications",
      p_notification_type: "test_notification",
      p_title: "First call",
      p_dedup_key: dedupKey,
    });
    assert.equal(call.error, null);
    assert.ok(call.data, "expected a notification id");
    firstId = call.data as string;
  });

  await t.test(
    "a second call with the same dedup_key returns the same id, creates nothing new",
    async () => {
      const before = await buyer
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", ids.buyer);

      const call = await buyer.rpc("create_notification_if_enabled", {
        p_profile_id: ids.buyer,
        p_category: "applications",
        p_notification_type: "test_notification",
        p_title: "Retry of the same event (should be deduped)",
        p_dedup_key: dedupKey,
      });
      assert.equal(call.error, null);
      assert.equal(
        call.data,
        firstId,
        "expected the original notification's id back, not a new one",
      );

      const after = await buyer
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", ids.buyer);
      assert.equal(
        (after.count ?? 0) - (before.count ?? 0),
        0,
        "a retried call with the same dedup_key must not create a second row",
      );
    },
  );

  await t.test(
    "a genuinely different dedup_key for the same recipient is not deduped",
    async () => {
      const call = await buyer.rpc("create_notification_if_enabled", {
        p_profile_id: ids.buyer,
        p_category: "applications",
        p_notification_type: "test_notification",
        p_title: "A distinct event",
        p_dedup_key: `${dedupKey}-other`,
      });
      assert.equal(call.error, null);
      assert.notEqual(call.data, firstId, "a different real event must get its own notification");

      await buyer
        .from("notifications")
        .delete()
        .eq("id", call.data as string);
    },
  );

  await t.test("cleanup", async () => {
    const deleted = await buyer.from("notifications").delete().eq("id", firstId!);
    assert.equal(deleted.error, null);
  });
});

test("create_notification_if_enabled: a genuine concurrent race resolves to exactly one row", async (t) => {
  const buyer = await as("buyer");
  const dedupKey = `cjr-race-test-${Date.now()}`;

  await t.test(
    "10 simultaneous calls with the same dedup_key produce exactly one notification",
    async () => {
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          buyer.rpc("create_notification_if_enabled", {
            p_profile_id: ids.buyer,
            p_category: "applications",
            p_notification_type: "test_notification",
            p_title: "Concurrent race",
            p_dedup_key: dedupKey,
          }),
        ),
      );

      for (const r of results) {
        assert.equal(r.error, null);
        assert.ok(r.data, "every concurrent call must return a real id, never fail outright");
      }

      const distinctIds = new Set(results.map((r) => r.data));
      assert.equal(distinctIds.size, 1, "every concurrent call must resolve to the exact same id");

      const rows = await buyer
        .from("notifications")
        .select("id")
        .eq("profile_id", ids.buyer)
        .eq("dedup_key", dedupKey);
      assert.equal(rows.error, null);
      assert.equal(rows.data?.length, 1, "the race must never leave more than one row behind");
    },
  );

  await t.test("cleanup", async () => {
    const deleted = await buyer.from("notifications").delete().eq("dedup_key", dedupKey);
    assert.equal(deleted.error, null);
  });
});

test("create_notification_if_enabled: a muted category never records a dedup collision", async (t) => {
  const buyer = await as("buyer");
  const dedupKey = `cjr-muted-test-${Date.now()}`;

  await t.test("setup: mute the moderation category", async () => {
    const upsert = await buyer
      .from("notification_preferences")
      .upsert(
        { profile_id: ids.buyer, category: "moderation", in_app_enabled: false },
        { onConflict: "profile_id,category" },
      );
    assert.equal(upsert.error, null);
  });

  await t.test(
    "a muted call returns null and creates nothing, even with a dedup_key set",
    async () => {
      const call = await buyer.rpc("create_notification_if_enabled", {
        p_profile_id: ids.buyer,
        p_category: "moderation",
        p_notification_type: "moderation_decision",
        p_title: "Should be muted",
        p_dedup_key: dedupKey,
      });
      assert.equal(call.error, null);
      assert.equal(call.data, null, "a muted category must return null, not create a row");
    },
  );

  await t.test("cleanup: restore the default (enabled)", async () => {
    const deleted = await buyer
      .from("notification_preferences")
      .delete()
      .eq("profile_id", ids.buyer)
      .eq("category", "moderation");
    assert.equal(deleted.error, null);
  });
});
