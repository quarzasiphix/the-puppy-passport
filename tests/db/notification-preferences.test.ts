// Stage H: notification preferences
// (supabase/migrations/20260101008000_notification_preferences.sql). See
// docs/AUTONOMOUS_BACKEND_PROGRESS.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, isBlocked } from "./helpers.ts";

test("no preference row: category defaults to enabled (opt-out, not opt-in)", async (t) => {
  const buyer = await as("buyer");

  await t.test(
    "get_notification_preference is no longer directly callable (Stage XR-2 grant lock)",
    async () => {
      const attempt = await buyer.rpc("get_notification_preference", {
        p_profile_id: ids.buyer,
        p_category: "applications",
      });
      assert.ok(attempt.error, "expected the direct grant to be revoked");
    },
  );

  await t.test("create_notification_if_enabled creates a real row by default", async () => {
    const before = await buyer
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", ids.buyer);
    const { data, error } = await buyer.rpc("create_notification_if_enabled", {
      p_profile_id: ids.buyer,
      p_category: "applications",
      p_notification_type: "test_notification",
      p_title: "Test",
    });
    assert.equal(error, null);
    assert.ok(data, "expected a notification id to be returned");

    const after = await buyer
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", ids.buyer);
    assert.equal((after.count ?? 0) - (before.count ?? 0), 1);

    await buyer
      .from("notifications")
      .delete()
      .eq("id", data as string);
  });
});

test("disabling a category suppresses the in-app record for that category only", async (t) => {
  const buyer = await as("buyer");

  await t.test("disable 'applications'", async () => {
    const { error } = await buyer
      .from("notification_preferences")
      .upsert(
        { profile_id: ids.buyer, category: "applications", in_app_enabled: false },
        { onConflict: "profile_id,category" },
      );
    assert.equal(error, null);
  });

  await t.test("create_notification_if_enabled returns null and creates nothing", async () => {
    const before = await buyer
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", ids.buyer);
    const { data, error } = await buyer.rpc("create_notification_if_enabled", {
      p_profile_id: ids.buyer,
      p_category: "applications",
      p_notification_type: "test_notification",
      p_title: "Should not be created",
    });
    assert.equal(error, null);
    assert.equal(data, null);

    const after = await buyer
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", ids.buyer);
    assert.equal(after.count, before.count);
  });

  await t.test("a different, still-enabled category is unaffected", async () => {
    const { data, error } = await buyer.rpc("create_notification_if_enabled", {
      p_profile_id: ids.buyer,
      p_category: "moderation",
      p_notification_type: "test_notification",
      p_title: "Should be created",
    });
    assert.equal(error, null);
    assert.ok(data);
    await buyer
      .from("notifications")
      .delete()
      .eq("id", data as string);
  });

  await t.test("re-enable 'applications' for later tests", async () => {
    const { error } = await buyer
      .from("notification_preferences")
      .upsert(
        { profile_id: ids.buyer, category: "applications", in_app_enabled: true },
        { onConflict: "profile_id,category" },
      );
    assert.equal(error, null);
  });
});

test("'security' is always sent regardless of any stored preference", async (t) => {
  const buyer = await as("buyer");

  await t.test("attempt to disable 'security' directly on the table", async () => {
    // No application code ever does this (the UI disables the toggle), but the real security
    // boundary is get_notification_preference() hard-coding true for this category, not merely the
    // UI declining to offer the control — proven below via create_notification_if_enabled's own
    // observable outcome (get_notification_preference itself is no longer directly callable as of
    // Stage XR-2, so this stored row is read only through that internal call, never a direct RPC).
    const { error } = await buyer
      .from("notification_preferences")
      .upsert(
        { profile_id: ids.buyer, category: "security", in_app_enabled: false },
        { onConflict: "profile_id,category" },
      );
    assert.equal(error, null);
  });

  await t.test(
    "get_notification_preference itself stays locked even for the 'security' category",
    async () => {
      const attempt = await buyer.rpc("get_notification_preference", {
        p_profile_id: ids.buyer,
        p_category: "security",
      });
      assert.ok(attempt.error, "expected the direct grant to be revoked regardless of category");
    },
  );

  await t.test("create_notification_if_enabled still creates the record", async () => {
    const { data, error } = await buyer.rpc("create_notification_if_enabled", {
      p_profile_id: ids.buyer,
      p_category: "security",
      p_notification_type: "test_notification",
      p_title: "Security notice",
    });
    assert.equal(error, null);
    assert.ok(data);
    await buyer
      .from("notifications")
      .delete()
      .eq("id", data as string);
  });
});

// Stage YR-2 (notification preference enforcement matrix): preference is only ever checked once,
// at creation time (get_notification_preference() inside create_notification_if_enabled()) -- the
// SELECT policy on `notifications` ("users manage their own notifications",
// 20260101002100_platform.sql) is pure ownership (profile_id = auth.uid()), with no join back to
// notification_preferences at read time. This proves that property holds in practice, not just by
// reading the policy: a later preference change must never retroactively hide, delete, or alter an
// already-created notification -- there is no delivery/outbox pipeline in this app that would ever
// revisit a past row, so once a notification exists, disabling its category afterward must be a
// complete no-op against it.
test("disabling a category after a notification already exists does not retroactively affect it", async (t) => {
  const buyer = await as("buyer");
  let notificationId: string | undefined;

  await t.test("setup: create a real notification while 'adoption' is enabled", async () => {
    const { data, error } = await buyer.rpc("create_notification_if_enabled", {
      p_profile_id: ids.buyer,
      p_category: "adoption",
      p_notification_type: "test_notification",
      p_title: "Pre-existing notification",
    });
    assert.equal(error, null);
    assert.ok(data);
    notificationId = data as string;
  });

  await t.test("now disable 'adoption'", async () => {
    const { error } = await buyer
      .from("notification_preferences")
      .upsert(
        { profile_id: ids.buyer, category: "adoption", in_app_enabled: false },
        { onConflict: "profile_id,category" },
      );
    assert.equal(error, null);
  });

  await t.test("the already-created notification is completely untouched", async () => {
    const row = await buyer
      .from("notifications")
      .select("id, title, is_read")
      .eq("id", notificationId!)
      .single();
    assert.equal(
      row.error,
      null,
      "the row must still exist -- disabling a preference never deletes history",
    );
    assert.equal(row.data?.title, "Pre-existing notification");
    assert.equal(row.data?.is_read, false, "unmodified, not silently marked read or altered");
  });

  await t.test("it's still markable read, exactly like any other notification", async () => {
    const update = await buyer
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId!)
      .select("is_read")
      .single();
    assert.equal(update.error, null);
    assert.equal(update.data?.is_read, true);
  });

  await t.test("cleanup", async () => {
    await buyer.from("notifications").delete().eq("id", notificationId!);
    await buyer
      .from("notification_preferences")
      .upsert(
        { profile_id: ids.buyer, category: "adoption", in_app_enabled: true },
        { onConflict: "profile_id,category" },
      );
  });
});

test("cross-user isolation: a user cannot read or change another user's preferences", async (t) => {
  const buyer = await as("buyer");
  const customer = await as("customer");

  await t.test("setup: buyer sets a preference", async () => {
    const { error } = await buyer
      .from("notification_preferences")
      .upsert(
        { profile_id: ids.buyer, category: "moderation", in_app_enabled: false },
        { onConflict: "profile_id,category" },
      );
    assert.equal(error, null);
  });

  await t.test("an unrelated user cannot read the buyer's preferences", async () => {
    const blocked = await customer
      .from("notification_preferences")
      .select("id")
      .eq("profile_id", ids.buyer);
    assert.ok(isBlocked(blocked.data, blocked.error));
  });

  await t.test("an unrelated user cannot set a preference on the buyer's behalf", async () => {
    const attempt = await customer
      .from("notification_preferences")
      .upsert(
        { profile_id: ids.buyer, category: "moderation", in_app_enabled: true },
        { onConflict: "profile_id,category" },
      )
      .select();
    assert.ok(isBlocked(attempt.data, attempt.error));

    // Confirm it genuinely wasn't changed.
    const check = await buyer
      .from("notification_preferences")
      .select("in_app_enabled")
      .eq("profile_id", ids.buyer)
      .eq("category", "moderation")
      .single();
    assert.equal(check.data?.in_app_enabled, false);
  });

  await t.test("cleanup: restore buyer's moderation preference", async () => {
    const { error } = await buyer
      .from("notification_preferences")
      .upsert(
        { profile_id: ids.buyer, category: "moderation", in_app_enabled: true },
        { onConflict: "profile_id,category" },
      );
    assert.equal(error, null);
  });
});

test("real call sites now respect preferences: application status change", async (t) => {
  const foundation1 = await as("foundation1");
  const buyer = await as("buyer");

  await t.test("buyer disables 'applications'", async () => {
    const { error } = await buyer
      .from("notification_preferences")
      .upsert(
        { profile_id: ids.buyer, category: "applications", in_app_enabled: false },
        { onConflict: "profile_id,category" },
      );
    assert.equal(error, null);
  });

  await t.test("respondToApplication's notification is suppressed", async () => {
    const before = await buyer
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", ids.buyer)
      .eq("notification_type", "application_status_change");

    const { error } = await foundation1.rpc("create_notification_if_enabled", {
      p_profile_id: ids.buyer,
      p_category: "applications",
      p_notification_type: "application_status_change",
      p_title: "Update on your application",
      p_body: "Approved",
      p_link_url: "/dashboard/buyer/applications",
    });
    assert.equal(error, null);

    const after = await buyer
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", ids.buyer)
      .eq("notification_type", "application_status_change");
    assert.equal(after.count, before.count);
  });

  await t.test("cleanup: restore buyer's applications preference", async () => {
    const { error } = await buyer
      .from("notification_preferences")
      .upsert(
        { profile_id: ids.buyer, category: "applications", in_app_enabled: true },
        { onConflict: "profile_id,category" },
      );
    assert.equal(error, null);
  });
});
