// Stage YR-5 (event replay safety). This app has no queued-event/outbox system (confirmed
// repeatedly — XR-10/XR-11/XR-12/YR-4), so "replay" here means the one genuinely reachable analog:
// a client retrying a call after a dropped response, timeout, or double-click. Two properties are
// each already proven in isolation — RPC idempotency (Stage XR-9: `approve_rehoming_review()` and
// friends return the original success on a retry, never re-doing the write) and notification
// deduplication (Stage CJR: `create_notification_if_enabled()`'s dedup_key prevents a duplicate
// row) — but never proven *together*, which is what actually matters: every real notification call
// site (`approveRehomingReview()`, `sendQuotation()`, etc.) calls its RPC first, then unconditionally
// calls `notifyUserFromTemplate()` afterward, regardless of whether the RPC's own result was a
// genuine first success or an idempotent retry. This test proves the combination has no
// customer-visible duplicate side effect: a network retry that re-runs both calls must still leave
// exactly one notification, not two.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids } from "./helpers.ts";

test("a client retry of an idempotent RPC + its notification call produces exactly one notification", async (t) => {
  const admin = await as("admin");
  const customer = await as("customer");
  let animalId: string | undefined;
  let reviewId: string | undefined;

  await t.test("setup: a private-rehoming animal with a pending review", async () => {
    const animal = await customer
      .from("animals")
      .insert({
        listing_category: "private_rehoming",
        owner_profile_id: ids.customer,
        name: "YR-5 Replay Test Dog",
        is_published: true,
        availability_status: "draft",
      })
      .select("id")
      .single();
    assert.equal(animal.error, null);
    animalId = animal.data!.id as string;

    const review = await customer
      .from("rehoming_reviews")
      .insert({
        animal_id: animalId,
        owner_profile_id: ids.customer,
        reason_for_rehoming: "YR-5 test.",
        ownership_declaration: true,
      })
      .select("id")
      .single();
    assert.equal(review.error, null);
    reviewId = review.data!.id as string;
  });

  const dedupKey = () => `rehoming_review:${reviewId}:approved`;

  async function simulateApproveRehomingReviewCallSite() {
    // Mirrors approveRehomingReview() (rehoming.ts) exactly: call the RPC, then unconditionally
    // send the templated notification with its real dedup key.
    const rpcCall = await admin.rpc("approve_rehoming_review", { p_review_id: reviewId! });
    assert.equal(rpcCall.error, null);
    const notify = await admin.rpc("create_notification_if_enabled", {
      p_profile_id: ids.customer,
      p_category: "adoption",
      p_notification_type: "rehoming_approved",
      p_title: "Your rehoming listing was approved",
      p_body: "It's now visible to people looking to adopt on Havenpaw.",
      p_link_url: `/adoptions/${animalId}`,
      p_dedup_key: dedupKey(),
      p_template_version: 1,
    });
    assert.equal(notify.error, null);
    return notify.data as string;
  }

  await t.test("the first real call succeeds and creates one notification", async () => {
    const id = await simulateApproveRehomingReviewCallSite();
    assert.ok(id);
  });

  await t.test(
    "a full retry of both calls (as a real network retry would do) returns the same notification, no duplicate",
    async () => {
      const firstId = (
        await admin
          .from("notifications")
          .select("id")
          .eq("profile_id", ids.customer)
          .eq("dedup_key", dedupKey())
          .single()
      ).data!.id as string;

      const retryId = await simulateApproveRehomingReviewCallSite();
      assert.equal(retryId, firstId, "the retry must return the exact same notification id");

      const rows = await admin
        .from("notifications")
        .select("id")
        .eq("profile_id", ids.customer)
        .eq("dedup_key", dedupKey());
      assert.equal(rows.data?.length, 1, "exactly one notification must exist after the retry");

      const review = await admin
        .from("rehoming_reviews")
        .select("admin_status")
        .eq("id", reviewId!)
        .single();
      assert.equal(review.data?.admin_status, "approved", "the underlying state is still correct");
    },
  );

  await t.test("cleanup", async () => {
    await admin.from("notifications").delete().eq("dedup_key", dedupKey());
    await admin.from("rehoming_reviews").delete().eq("id", reviewId!);
    await admin.from("animals").delete().eq("id", animalId!);
  });
});
