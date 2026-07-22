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

test("OPEN FINDING: an org owner notifying an applicant currently fails", async () => {
  // migration 20260101004900_notifications_org_owner_notify_applicants.sql added a narrowly-scoped
  // policy so a breeder/foundation can notify a buyer who has a real application with their org
  // (this is exactly what src/lib/queries/applications.ts's respondToApplication() ->
  // notifyUser() calls in production). The policy reads correctly and matches this exact scenario
  // (buyer@ has an approved application with breeder1's Cichy Las, application id
  // ids.applicationFabian) — but reproduced here, and independently via a raw authenticated curl
  // call with a real bearer token before this test was written, the INSERT is rejected with 42501
  // regardless. This test asserts the CORRECT (documented, intended) behaviour and is expected to
  // currently FAIL. Left in, unfixed and undeleted, so it stays visible — see the task report for
  // full detail. Do not weaken this policy's condition to make the test pass; find out why the
  // existing condition doesn't evaluate as written instead.
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
  if (notification.data?.[0]?.id) {
    const buyer = await as("buyer");
    await buyer.from("notifications").delete().eq("id", notification.data[0].id);
  }
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

test("OPEN FINDING: customers can currently change their own request's operational status", async () => {
  // Found while building this suite (2026-07-22), reproduced against the real local API before
  // writing this test: "requesters update their own transport requests" only checks row
  // ownership (requester_profile_id = auth.uid()), not which columns change or what value
  // `status`/`compliance_review_result`/assigned_* are set to. A signed-in customer can currently
  // PATCH their own request's `status` straight to e.g. 'completed', bypassing the entire ops
  // workflow. This test asserts the CORRECT behaviour and is expected to currently FAIL — it is
  // intentionally included, unfixed, so this stays visible until a deliberate fix (e.g. a
  // trigger or a narrower column-scoped policy) lands. Do not delete or weaken this test to make
  // it pass; fix the RLS/trigger instead. See the task report for full detail.
  const customer = await as("customer");
  const before = await customer
    .from("transport_requests")
    .select("status")
    .eq("id", ids.transportBerlin)
    .single();
  const originalStatus = before.data?.status;
  assert.notEqual(originalStatus, undefined);

  try {
    const attempt = await customer
      .from("transport_requests")
      .update({ status: "completed" })
      .eq("id", ids.transportBerlin)
      .select("status");
    assert.ok(
      isBlocked(attempt.data, attempt.error),
      "a customer must not be able to set their own request's operational status directly",
    );
  } finally {
    const ops = await as("ops");
    await ops
      .from("transport_requests")
      .update({ status: originalStatus })
      .eq("id", ids.transportBerlin);
  }
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
