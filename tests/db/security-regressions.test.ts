// Regression coverage for specific, previously-documented Havenpaw security bugs (see
// docs/MVP_TEST_REPORT.md §3) plus two additional checks this pass found were never actually
// fixed (clearly marked below as "OPEN FINDING", not "regression guard" — see
// docs/DATABASE_TESTING.md and the task report for detail). Every historical bug here was
// originally caught by testing a real write *and* read against the local Supabase API, not by
// reading SQL and assuming it was correct — these tests do the same thing, so they'll go red
// again the moment any of these regress.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, isBlocked, isForbidden } from "./helpers.ts";

test("regression: table-level grants still match RLS intent (missing-GRANT bug)", async () => {
  // 2026-07-xx: a Supabase CLI default change (auto_expose_new_tables=false) silently revoked
  // every table's implicit anon/authenticated GRANT, so even fully-correct RLS policies returned
  // "permission denied" for every request. If that regresses, this simple, RLS-allowed read fails.
  const buyer = await as("buyer");
  const { data, error } = await buyer
    .from("animals")
    .select("id")
    .eq("id", ids.animalMaja)
    .single();
  assert.equal(error, null, "a basic RLS-allowed read must not fail with a GRANT-level error");
  assert.equal(data?.id, ids.animalMaja);
});

test("regression: profiles email/phone stay locked down from bulk authenticated reads", async () => {
  const buyer = await as("buyer");
  const { data, error } = await buyer
    .from("profiles")
    .select("email, phone")
    .eq("id", ids.breeder1);
  assert.ok(isForbidden(error), "any authenticated user could once bulk-read anyone's email/phone");
  assert.equal(data, null);
});

test("regression: animals <-> rehoming_reviews RLS does not recurse (42P17)", async () => {
  const customer = await as("customer");
  const animal = await customer
    .from("animals")
    .insert({
      listing_category: "private_rehoming",
      owner_profile_id: ids.customer,
      name: "Regression Test Dog",
      is_published: true,
    })
    .select("id")
    .single();
  assert.equal(animal.error, null);
  const animalId = animal.data!.id as string;

  try {
    const review = await customer
      .from("rehoming_reviews")
      .insert({
        animal_id: animalId,
        owner_profile_id: ids.customer,
        reason_for_rehoming: "regression test",
        ownership_declaration: true,
      })
      .select("id");
    assert.equal(
      review.error,
      null,
      `expected no recursion error, got ${JSON.stringify(review.error)}`,
    );
    assert.notEqual((review.error as { code?: string } | null)?.code, "42P17");

    const reviewId = review.data![0].id as string;
    const admin = await as("admin");
    await admin.from("rehoming_reviews").delete().eq("id", reviewId);
  } finally {
    await customer.from("animals").delete().eq("id", animalId);
  }
});

test("regression: INSERT ... RETURNING for another user's notification still works (admin/moderator path)", async () => {
  // The original bug: staff code inserting a notification for someone ELSE (not auth.uid())
  // failed the moment the app requested the row back, because Postgres treats
  // INSERT ... RETURNING like a SELECT and the only SELECT policy was "your own rows only".
  const admin = await as("admin");
  const notification = await admin
    .from("notifications")
    .insert({
      profile_id: ids.buyer,
      notification_type: "application_response",
      title: "Regression test notification (admin path)",
    })
    .select("id, title");
  assert.equal(notification.error, null);
  assert.equal(notification.data?.[0]?.title, "Regression test notification (admin path)");

  const buyer = await as("buyer");
  await buyer.from("notifications").delete().eq("id", notification.data![0].id);
});

test("org owner notifies a real applicant: allowed, correctly scoped, no inbox leak", async (t) => {
  // Fixed by 20260101006200_notifications_actor_visibility.sql. Root cause (found by reproducing
  // the exact INSERT directly against the local database with and without a RETURNING clause):
  // 20260101004900_notifications_org_owner_notify_applicants.sql's INSERT policy always evaluated
  // correctly — the row went in every time. The 42501 only appeared when the caller also asked for
  // the row back (PostgREST's default `.insert(...).select(...)`), because Postgres treats
  // INSERT ... RETURNING like a SELECT, and notifications had no SELECT policy letting an org owner
  // see a row filed under the *applicant's* profile_id. The fix added a real `actor_profile_id`
  // column (auto-stamped by a trigger) and a SELECT policy scoped to "you can see notifications you
  // personally sent" — deliberately narrower than "you can see everything your applicants ever
  // received", which would leak notifications sent by ops/admin/other unrelated senders. Every
  // sub-test below asserts one specific allowed or forbidden edge of that scope, not just the happy
  // path.
  let sentId: string | undefined;
  let systemNotificationId: string | undefined;

  await t.test("a real org-applicant relationship: insert + RETURNING succeeds", async () => {
    const breeder1 = await as("breeder1");
    const notification = await breeder1
      .from("notifications")
      .insert({
        profile_id: ids.buyer,
        notification_type: "application_response",
        title: "Should be allowed: real application relationship exists",
      })
      .select("id, title");
    assert.equal(
      notification.error,
      null,
      `expected the org-owner-notifies-applicant policy to allow this insert, got ${JSON.stringify(notification.error)}`,
    );
    assert.equal(
      notification.data?.[0]?.title,
      "Should be allowed: real application relationship exists",
    );
    sentId = notification.data?.[0]?.id as string | undefined;
    assert.notEqual(sentId, undefined);
  });

  await t.test("an unrelated org cannot notify the same applicant", async () => {
    // foundation1 owns Fundacja — buyer@ has applications with Cichy Las and Wolna Dolina
    // (seed data) but none with Fundacja, so this is a genuinely unrelated org for this applicant.
    // (breeder2's Wolna Dolina looked like a plausible "unrelated" choice at first glance, but
    // buyer@ actually does have a real under_review application there too — reusing it here would
    // have silently tested nothing. Found by checking the real seeded buyer_applications rows,
    // not by assuming.)
    const foundation1 = await as("foundation1");
    const attempt = await foundation1
      .from("notifications")
      .insert({
        profile_id: ids.buyer,
        notification_type: "application_response",
        title: "Should be blocked: no real application relationship",
      })
      .select("id");
    assert.ok(
      isBlocked(attempt.data, attempt.error),
      "an org with no application relationship to this applicant must not be able to notify them",
    );
  });

  await t.test("the sender cannot list the recipient's other notifications", async () => {
    const admin = await as("admin");
    const systemNotification = await admin
      .from("notifications")
      .insert({
        profile_id: ids.buyer,
        notification_type: "system",
        title: "Unrelated system notification, not sent by breeder1",
      })
      .select("id")
      .single();
    assert.equal(systemNotification.error, null);
    systemNotificationId = systemNotification.data!.id as string;

    const breeder1 = await as("breeder1");
    const bulkRead = await breeder1.from("notifications").select("id").eq("profile_id", ids.buyer);
    // breeder1 sees at most the ones they personally sent (sentId) — never the admin-sent one,
    // proving actor_profile_id scopes read access to "sent by me", not "sent to my applicant".
    const ids_ = (bulkRead.data ?? []).map((r: { id: string }) => r.id);
    assert.ok(
      !ids_.includes(systemNotificationId),
      "an org owner must not be able to read a notification they did not personally send",
    );
  });

  await t.test("the recipient can see their own notification", async () => {
    const buyer = await as("buyer");
    const seen = await buyer
      .from("notifications")
      .select("id, title")
      .eq("id", sentId as string);
    assert.equal(seen.error, null);
    assert.equal(
      seen.data?.length,
      1,
      "the actual recipient must see the notification sent to them",
    );
  });

  await t.test("an unrelated user cannot see the notification", async () => {
    const breeder2 = await as("breeder2");
    const blocked = await breeder2
      .from("notifications")
      .select("id")
      .eq("id", sentId as string);
    assert.ok(
      isBlocked(blocked.data, blocked.error),
      "a third party (neither sender nor recipient) must not see the notification",
    );
  });

  const buyer = await as("buyer");
  if (sentId) await buyer.from("notifications").delete().eq("id", sentId);
  if (systemNotificationId)
    await buyer.from("notifications").delete().eq("id", systemNotificationId);
});

test("regression: conversation_participants self-referential policy does not recurse (42P17)", async () => {
  const buyer = await as("buyer");
  const conversationId = await buyer.rpc("start_application_conversation", {
    p_animal_id: ids.animalFabian,
  });
  assert.equal(conversationId.error, null);
  const id = conversationId.data as string;

  const participants = await buyer
    .from("conversation_participants")
    .select("profile_id")
    .eq("conversation_id", id);
  assert.equal(
    participants.error,
    null,
    `expected no recursion error, got ${JSON.stringify(participants.error)}`,
  );
  assert.notEqual((participants.error as { code?: string } | null)?.code, "42P17");
  // The buyer should see BOTH participant rows (themselves and the breeder), proving the fixed
  // is_conversation_participant() helper resolves correctly, not just their own row.
  assert.equal(participants.data?.length, 2);
});

test("regression: conversations SELECT column-shadowing bug stays fixed", async () => {
  // The original bug: a correlated subquery aliased `cp` on conversation_participants (which also
  // has an `id` column) wrote `cp.conversation_id = id`, and Postgres resolved the bare `id` to
  // the subquery's own table — so the policy silently returned [] for every conversation,
  // including to its own participants. No error, just empty — the worst kind of RLS bug.
  const buyer = await as("buyer");
  const conversationId = await buyer.rpc("start_application_conversation", {
    p_animal_id: ids.animalFabian,
  });
  assert.equal(conversationId.error, null);

  const conversation = await buyer
    .from("conversations")
    .select("id")
    .eq("id", conversationId.data as string);
  assert.equal(conversation.error, null);
  assert.equal(
    conversation.data?.length,
    1,
    "a participant must be able to see their own conversation",
  );
});

test("regression: conversations cannot be created without a real relationship", async () => {
  const breeder2 = await as("breeder2");

  // breeder2 owns Wolna Dolina, not Cichy Las (Maja's kennel) — and has no application from
  // buyer@ for Maja, so neither branch of start_application_conversation should succeed.
  const viaRpc = await breeder2.rpc("start_application_conversation", {
    p_animal_id: ids.animalMaja,
    p_buyer_id: ids.buyer,
  });
  assert.notEqual(viaRpc.error, null, "the RPC must reject a caller with no real relationship");

  // Bypassing the RPC entirely: a regular authenticated user has no direct INSERT policy on
  // conversations at all (only ops staff do) — confirms the "narrow RPC, not a broad INSERT
  // policy" design decision actually holds at the table level, not just in application code.
  const rawInsert = await breeder2
    .from("conversations")
    .insert({ conversation_type: "marketplace", linked_animal_id: ids.animalMaja })
    .select();
  assert.ok(
    isBlocked(rawInsert.data, rawInsert.error),
    "raw INSERT into conversations must be blocked for non-ops users",
  );
});

// Custom trigger exceptions (P0001) are not RLS permission-denied (42501) or a silently-empty
// result, so isBlocked()/isForbidden() don't recognize them — same established convention as
// tests/db/fundraising.test.ts's purpose-lock trigger assertions. Check explicitly instead.
function isTriggerBlocked(error: { code?: string } | null): boolean {
  return error?.code === "P0001";
}

test("transport_requests: operational-field locking (fixed by 20260101006000)", async (t) => {
  // Root cause: "requesters update their own transport requests" (20260101001300) only ever
  // checked row ownership (requester_profile_id = auth.uid()), never which columns changed — a
  // signed-in customer could PATCH their own request's `status`, `compliance_review_result`,
  // `visibility` or any `assigned_*` column straight to any value, bypassing the entire ops
  // workflow. RLS is row-level, not column-level, so the fix is a BEFORE UPDATE trigger
  // (prevent_non_staff_operational_field_changes) layered on top of the existing row-level
  // policies. Two customer-initiated transitions are genuinely legitimate product features and
  // must stay allowed — draft -> submitted (the one-time initial submission every request goes
  // through) and -> cancelled_by_customer (self-cancel) — everything else stays staff/driver-only.
  // Each sub-test below is one specific allowed or forbidden transition, not one broad assertion.

  await t.test("a customer may submit their own draft (draft -> submitted)", async () => {
    const customer = await as("customer");
    const requestNumber = `TR-SECTEST-${Date.now()}`;
    const draft = await customer
      .from("transport_requests")
      .insert({
        requester_profile_id: ids.customer,
        request_number: requestNumber,
        request_purpose: "own_dog",
        animal_name: "Security Regression Test Dog",
        pickup_country: "Poland",
        pickup_city: "Warsaw",
        destination_country: "Germany",
        destination_city: "Berlin",
        status: "draft",
      })
      .select("id")
      .single();
    assert.equal(draft.error, null);
    const requestId = draft.data!.id as string;

    try {
      const submitted = await customer
        .from("transport_requests")
        .update({ status: "submitted" })
        .eq("id", requestId)
        .select("status")
        .single();
      assert.equal(submitted.error, null, "draft -> submitted is a legitimate customer action");
      assert.equal(submitted.data?.status, "submitted");
    } finally {
      const admin = await as("admin");
      await admin.from("transport_requests").delete().eq("id", requestId);
    }
  });

  await t.test("a customer may cancel their own request (-> cancelled_by_customer)", async () => {
    const customer = await as("customer");
    const requestNumber = `TR-SECTEST-CANCEL-${Date.now()}`;
    const created = await customer
      .from("transport_requests")
      .insert({
        requester_profile_id: ids.customer,
        request_number: requestNumber,
        request_purpose: "own_dog",
        animal_name: "Security Regression Test Dog 2",
        pickup_country: "Poland",
        pickup_city: "Warsaw",
        destination_country: "Germany",
        destination_city: "Berlin",
        status: "submitted",
      })
      .select("id")
      .single();
    assert.equal(created.error, null);
    const requestId = created.data!.id as string;

    try {
      const cancelled = await customer
        .from("transport_requests")
        .update({ status: "cancelled_by_customer" })
        .eq("id", requestId)
        .select("status")
        .single();
      assert.equal(cancelled.error, null, "self-cancel is a legitimate customer action");
      assert.equal(cancelled.data?.status, "cancelled_by_customer");
    } finally {
      const admin = await as("admin");
      await admin.from("transport_requests").delete().eq("id", requestId);
    }
  });

  await t.test("a customer may NOT set an arbitrary operational status", async () => {
    const customer = await as("customer");
    const attempt = await customer
      .from("transport_requests")
      .update({ status: "completed" })
      .eq("id", ids.transportBerlin)
      .select("status");
    assert.ok(
      isTriggerBlocked(attempt.error),
      `expected a P0001 trigger rejection, got ${JSON.stringify(attempt.error)}`,
    );
  });

  await t.test("a customer may NOT change compliance_review_result", async () => {
    const customer = await as("customer");
    const attempt = await customer
      .from("transport_requests")
      .update({ compliance_review_result: "manually_approved" })
      .eq("id", ids.transportBerlin)
      .select();
    assert.ok(isTriggerBlocked(attempt.error));
  });

  await t.test("a customer may NOT change visibility", async () => {
    const customer = await as("customer");
    const attempt = await customer
      .from("transport_requests")
      .update({ visibility: "community_visible" })
      .eq("id", ids.transportBerlin)
      .select();
    assert.ok(isTriggerBlocked(attempt.error));
  });

  await t.test("a customer may NOT set assigned_route_id/vehicle_id/driver_id", async () => {
    const customer = await as("customer");
    const attempt = await customer
      .from("transport_requests")
      .update({ assigned_driver_id: ids.driverRecord })
      .eq("id", ids.transportBerlin)
      .select();
    assert.ok(isTriggerBlocked(attempt.error));
  });

  await t.test("ops staff retain full operational-field management", async () => {
    const ops = await as("ops");
    const before = await ops
      .from("transport_requests")
      .select("compliance_review_result")
      .eq("id", ids.transportBerlin)
      .single();
    const original = before.data?.compliance_review_result;

    const attempt = await ops
      .from("transport_requests")
      .update({ compliance_review_result: "manually_approved" })
      .eq("id", ids.transportBerlin)
      .select("compliance_review_result")
      .single();
    assert.equal(
      attempt.error,
      null,
      "ops staff must be unaffected by the customer-scoped trigger",
    );
    assert.equal(attempt.data?.compliance_review_result, "manually_approved");

    await ops
      .from("transport_requests")
      .update({ compliance_review_result: original })
      .eq("id", ids.transportBerlin);
  });

  await t.test(
    "an unrelated (unassigned) driver cannot update someone else's request at all",
    async () => {
      // Row-level policy alone should already block this (driver's UPDATE policy requires
      // assigned_driver_id = their own driver row) — confirms the new trigger didn't accidentally
      // widen driver access, since drivers must stay scoped to only their own assigned work.
      const driver = await as("driver");
      const attempt = await driver
        .from("transport_requests")
        .update({ status: "in_transport" })
        .eq("id", ids.transportBerlin)
        .select();
      assert.ok(
        isBlocked(attempt.data, attempt.error),
        "a driver not assigned to this request must have zero write access to it",
      );
    },
  );
});

test("regression: drivers cannot see routes or fleet records they're not assigned to", async () => {
  const ops = await as("ops");
  const unrelatedRoute = await ops
    .from("routes")
    .insert({ route_name: "Regression test route — unassigned", status: "planning" })
    .select("id")
    .single();
  assert.equal(unrelatedRoute.error, null);
  const routeId = unrelatedRoute.data!.id as string;

  try {
    const driver = await as("driver");

    const ownRoute = await driver.from("routes").select("id").eq("id", ids.routeWarsawAmsterdam);
    assert.equal(ownRoute.error, null);
    assert.equal(
      ownRoute.data?.length,
      1,
      "a driver must still see the route actually assigned to them",
    );

    const otherRoute = await driver.from("routes").select("id").eq("id", routeId);
    assert.ok(
      isBlocked(otherRoute.data, otherRoute.error),
      "a driver must not see an unrelated route",
    );

    const fleet = await driver.from("vehicles").select("id");
    assert.ok(
      isBlocked(fleet.data, fleet.error),
      "drivers have no table-wide access to internal fleet records",
    );
  } finally {
    await ops.from("routes").delete().eq("id", routeId);
  }
});
