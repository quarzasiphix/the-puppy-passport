// Stage CJS (third/fourth supplemental queue): notification and email template versioning
// (20260101012200_notification_template_versioning.sql, src/lib/notification-templates.ts). No
// email provider exists in this app (Stage AC/CJO), so the real scope is versioning the 4 existing
// notification types: template_version is recorded on the row as a pure audit trail of which
// version of the (pure, deterministic) render logic produced the stored text -- never re-resolved
// at read time, so nothing can fail to "render" an old notification. The database enforces the one
// thing it honestly can: a stored version must be a positive integer, never null-but-garbage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids } from "./helpers.ts";
import { notificationTemplates } from "../../src/lib/notification-templates.ts";

test("notification templates: rendering is a pure, deterministic function of the payload", () => {
  // No database round trip needed for this property -- render() must be a pure function, so
  // calling it twice with the same payload must produce byte-identical output every time.
  const payload = { animalId: "11111111-1111-1111-1111-111111111111" };
  const first = notificationTemplates.rehoming_approved.render(payload);
  const second = notificationTemplates.rehoming_approved.render(payload);
  assert.deepEqual(first, second);
  assert.ok(first.title.length > 0);
  assert.equal(notificationTemplates.rehoming_approved.version, 1);
});

test("notification templates: moderation_appeal_decision renders distinctly per decision", () => {
  const payload = { caseId: "11111111-1111-1111-1111-111111111111" } as const;
  const overturned = notificationTemplates.moderation_appeal_decision.render({
    ...payload,
    decision: "overturned",
  });
  const upheld = notificationTemplates.moderation_appeal_decision.render({
    ...payload,
    decision: "upheld",
  });
  assert.notEqual(overturned.title, upheld.title);
  assert.notEqual(overturned.body, upheld.body);
  assert.equal(overturned.linkUrl, `/moderation/${payload.caseId}`);
});

test("notifications.template_version: stored alongside the rendered text, and validated", async (t) => {
  const buyer = await as("buyer");

  await t.test("a real call stamps the template version", async () => {
    const call = await buyer.rpc("create_notification_if_enabled", {
      p_profile_id: ids.buyer,
      p_category: "applications",
      p_notification_type: "application_status_change",
      p_title: "Update on your application for Fabian",
      p_body: "Approved.",
      p_template_version: 1,
    });
    assert.equal(call.error, null);
    const id = call.data as string;

    const row = await buyer.from("notifications").select("template_version").eq("id", id).single();
    assert.equal(row.error, null);
    assert.equal(row.data?.template_version, 1);

    await buyer.from("notifications").delete().eq("id", id);
  });

  await t.test(
    "omitting a template_version is still accepted (untemplated notifications stay valid)",
    async () => {
      const call = await buyer.rpc("create_notification_if_enabled", {
        p_profile_id: ids.buyer,
        p_category: "applications",
        p_notification_type: "test_notification",
        p_title: "No template",
      });
      assert.equal(call.error, null);
      const id = call.data as string;

      const row = await buyer
        .from("notifications")
        .select("template_version")
        .eq("id", id)
        .single();
      assert.equal(row.data?.template_version, null);

      await buyer.from("notifications").delete().eq("id", id);
    },
  );

  await t.test(
    "a non-positive template_version is rejected -- fails safely, never stored as garbage",
    async () => {
      const attempt = await buyer.rpc("create_notification_if_enabled", {
        p_profile_id: ids.buyer,
        p_category: "applications",
        p_notification_type: "test_notification",
        p_title: "Invalid version",
        p_template_version: 0,
      });
      assert.ok(attempt.error, "expected the check constraint to reject a non-positive version");
    },
  );
});

test("a retry with the same dedup_key never changes the stored, already-rendered text", async (t) => {
  // Ties CJR's dedup key together with CJS's versioning: a "replay" of the same event must never
  // silently alter a notification's wording, even if it were called again with different args by
  // mistake (e.g. an updated template version, a typo fix) -- the original row wins, untouched.
  const buyer = await as("buyer");
  const dedupKey = `cjs-replay-test-${Date.now()}`;
  let firstId: string | undefined;

  await t.test("first call, version 1", async () => {
    const call = await buyer.rpc("create_notification_if_enabled", {
      p_profile_id: ids.buyer,
      p_category: "applications",
      p_notification_type: "test_notification",
      p_title: "Original wording",
      p_dedup_key: dedupKey,
      p_template_version: 1,
    });
    assert.equal(call.error, null);
    firstId = call.data as string;
  });

  await t.test(
    "a 'replay' with different title/body and a bumped version is silently ignored",
    async () => {
      const call = await buyer.rpc("create_notification_if_enabled", {
        p_profile_id: ids.buyer,
        p_category: "applications",
        p_notification_type: "test_notification",
        p_title: "A completely different wording, as if from template v2",
        p_dedup_key: dedupKey,
        p_template_version: 2,
      });
      assert.equal(call.error, null);
      assert.equal(
        call.data,
        firstId,
        "the replay must resolve to the original row, not a new one",
      );

      const row = await buyer
        .from("notifications")
        .select("title, template_version")
        .eq("id", firstId!)
        .single();
      assert.equal(row.error, null);
      assert.equal(row.data?.title, "Original wording", "the original text must survive untouched");
      assert.equal(row.data?.template_version, 1, "the original version must survive untouched");
    },
  );

  await t.test("cleanup", async () => {
    const deleted = await buyer.from("notifications").delete().eq("id", firstId!);
    assert.equal(deleted.error, null);
  });
});

// Stage XR-13 (template revalidation): revalidates CJS's own core safety claim directly, rather
// than trusting the code comment -- an "unknown" template_version (higher than anything current
// code defines) or a notification_type no longer present in notificationTemplates (e.g. from a
// future deploy, or a template later retired) must still create and read back cleanly, since
// nothing ever re-resolves the stored text against the template at read time.
test("a notification with an unknown future template_version/type is created and read back safely", async (t) => {
  const buyer = await as("buyer");
  let id: string | undefined;

  await t.test(
    "create_notification_if_enabled accepts a version far ahead of any current template",
    async () => {
      const call = await buyer.rpc("create_notification_if_enabled", {
        p_profile_id: ids.buyer,
        p_category: "applications",
        // Deliberately not a key of notificationTemplates -- simulates a notification_type from
        // a future deploy this current code has never heard of.
        p_notification_type: "a_future_template_this_code_does_not_know_about",
        p_title: "From a future template version",
        p_body: "Rendered by code that doesn't exist yet.",
        p_template_version: 9999,
      });
      assert.equal(call.error, null, "an unrecognized future version/type must not be rejected");
      assert.ok(call.data);
      id = call.data as string;
    },
  );

  await t.test("reading it back succeeds cleanly, with the stored text untouched", async () => {
    const row = await buyer
      .from("notifications")
      .select("notification_type, title, body, template_version")
      .eq("id", id!)
      .single();
    assert.equal(row.error, null, "reading an unknown-version notification must never fail");
    assert.equal(row.data?.notification_type, "a_future_template_this_code_does_not_know_about");
    assert.equal(row.data?.title, "From a future template version");
    assert.equal(row.data?.template_version, 9999);
  });

  await t.test(
    "confirms notificationTemplates genuinely has no entry for this type -- proving the scenario is real, not vacuous",
    () => {
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          notificationTemplates,
          "a_future_template_this_code_does_not_know_about",
        ),
        false,
      );
    },
  );

  await t.test("cleanup", async () => {
    const deleted = await buyer.from("notifications").delete().eq("id", id!);
    assert.equal(deleted.error, null);
  });
});
