// Stage T (supplemental queue): listing lifecycle. Two real self-approval bugs found while
// auditing the buyer/owner side of the listing and application lifecycle -- both are the same
// bug class already fixed several times this session (an INSERT/UPDATE policy or trigger checks
// row ownership but not the initial value of a status/decision column), just not yet applied to
// these two tables:
//
// 1. rehoming_reviews' INSERT policy ("owners create their own rehoming review") never restricted
//    admin_status -- an owner could insert their own review already admin_status='approved',
//    combined with animals.is_published being fully owner-controlled, making their private
//    rehoming listing publicly visible without ever going through real admin review. Fixed by
//    20260101008800_rehoming_review_self_approval_lock.sql.
// 2. buyer_applications' write-lock trigger (prevent_buyer_writes_to_org_controlled_fields) only
//    ever fired on UPDATE -- a buyer's INSERT could set status='approved' directly. Fixed by
//    20260101008900_buyer_application_insert_status_lock.sql (extends the same trigger to INSERT).
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids } from "./helpers.ts";

test("rehoming_reviews: an owner cannot self-approve their own review at insert time", async (t) => {
  const customer = await as("customer");
  const admin = await as("admin");
  let animalId: string | undefined;

  await t.test("setup: a private-rehoming animal owned by the customer", async () => {
    const animal = await customer
      .from("animals")
      .insert({
        listing_category: "private_rehoming",
        owner_profile_id: ids.customer,
        name: "Self-Approval Test Dog",
        is_published: true,
      })
      .select("id")
      .single();
    assert.equal(animal.error, null);
    animalId = animal.data!.id as string;
  });

  await t.test("the owner cannot insert their own review as already approved", async () => {
    const attempt = await customer
      .from("rehoming_reviews")
      .insert({
        animal_id: animalId!,
        owner_profile_id: ids.customer,
        reason_for_rehoming: "Self-approval attempt.",
        ownership_declaration: true,
        admin_status: "approved",
      })
      .select("id");
    assert.ok(attempt.error, "expected the self-approval attempt to be rejected");
  });

  let reviewId: string | undefined;
  await t.test("the owner can still legitimately submit a review (starts pending)", async () => {
    const review = await customer
      .from("rehoming_reviews")
      .insert({
        animal_id: animalId!,
        owner_profile_id: ids.customer,
        reason_for_rehoming: "Legitimate submission.",
        ownership_declaration: true,
      })
      .select("id, admin_status")
      .single();
    assert.equal(review.error, null);
    assert.equal(review.data?.admin_status, "pending");
    reviewId = review.data!.id as string;
  });

  await t.test("cleanup", async () => {
    if (reviewId) await admin.from("rehoming_reviews").delete().eq("id", reviewId);
    await admin.from("animals").delete().eq("id", animalId!);
  });
});

test("buyer_applications: a buyer cannot insert an already-approved application", async (t) => {
  const buyer = await as("buyer");
  const admin = await as("admin");

  await t.test("a direct insert with status='approved' is rejected", async () => {
    const attempt = await buyer
      .from("buyer_applications")
      .insert({
        animal_id: ids.animalMaja,
        buyer_id: ids.buyer,
        organization_id: ids.orgCichyLas,
        application_type: "purchase",
        status: "approved",
      })
      .select("id");
    assert.ok(attempt.error, "expected the self-approval attempt to be rejected");
  });

  let applicationId: string | undefined;
  await t.test("a normal submission (no status field) still works", async () => {
    const submitted = await buyer
      .from("buyer_applications")
      .insert({
        animal_id: ids.animalMaja,
        buyer_id: ids.buyer,
        organization_id: ids.orgCichyLas,
        application_type: "purchase",
      })
      .select("id, status")
      .single();
    assert.equal(submitted.error, null);
    assert.equal(submitted.data?.status, "submitted");
    applicationId = submitted.data!.id as string;
  });

  await t.test("cleanup", async () => {
    if (applicationId) await admin.from("buyer_applications").delete().eq("id", applicationId);
  });
});
