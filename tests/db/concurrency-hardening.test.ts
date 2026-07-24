// Stage AG (supplemental queue): idempotency/concurrency audit
// (20260101009400_concurrency_hardening.sql). Each test fires genuinely concurrent requests via
// Promise.all (not sequential calls) and checks the race resolves safely: exactly one winner for
// a real resource conflict, or the same result reused for an idempotent lookup-or-create.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids } from "./helpers.ts";

test("reservations: two approved applications for the same animal cannot both become active reservations", async (t) => {
  const breeder1 = await as("breeder1");
  const buyer = await as("buyer");
  const customer = await as("customer");
  const admin = await as("admin");
  let appA: string | undefined;
  let appB: string | undefined;

  await t.test("setup: two different buyers, two approved applications, same animal", async () => {
    const a = await buyer
      .from("buyer_applications")
      .insert({ animal_id: ids.animalMaja, buyer_id: ids.buyer, organization_id: ids.orgCichyLas })
      .select("id")
      .single();
    assert.equal(a.error, null);
    appA = a.data!.id as string;

    const b = await customer
      .from("buyer_applications")
      .insert({
        animal_id: ids.animalMaja,
        buyer_id: ids.customer,
        organization_id: ids.orgCichyLas,
      })
      .select("id")
      .single();
    assert.equal(b.error, null);
    appB = b.data!.id as string;

    const approveA = await breeder1
      .from("buyer_applications")
      .update({ status: "approved" })
      .eq("id", appA);
    assert.equal(approveA.error, null);
    const approveB = await breeder1
      .from("buyer_applications")
      .update({ status: "approved" })
      .eq("id", appB);
    assert.equal(approveB.error, null);
  });

  await t.test("racing two reservation inserts for the same animal: exactly one wins", async () => {
    const [resA, resB] = await Promise.all([
      breeder1
        .from("reservations")
        .insert({
          animal_id: ids.animalMaja,
          buyer_id: ids.buyer,
          organization_id: ids.orgCichyLas,
          application_id: appA!,
        })
        .select("id"),
      breeder1
        .from("reservations")
        .insert({
          animal_id: ids.animalMaja,
          buyer_id: ids.customer,
          organization_id: ids.orgCichyLas,
          application_id: appB!,
        })
        .select("id"),
    ]);

    const outcomes = [resA, resB];
    const succeeded = outcomes.filter((r) => r.error === null);
    const failed = outcomes.filter((r) => r.error !== null);
    assert.equal(succeeded.length, 1, "expected exactly one reservation to win the race");
    assert.equal(failed.length, 1, "expected exactly one reservation to be rejected");

    await admin.from("reservations").delete().eq("animal_id", ids.animalMaja);
  });

  await t.test("cleanup", async () => {
    await admin.from("buyer_applications").delete().in("id", [appA!, appB!]);
  });
});

test("start_transport_conversation: concurrent calls converge on one conversation", async (t) => {
  const customer = await as("customer");
  const ops = await as("ops");
  let requestId: string | undefined;

  await t.test("setup: a fresh transport request owned by the customer", async () => {
    const created = await customer
      .from("transport_requests")
      .insert({
        requester_profile_id: ids.customer,
        request_number: `TR-CONCURRENCY-${Date.now()}`,
        request_purpose: "own_dog",
        animal_name: "Concurrency Test Dog",
        pickup_country: "Poland",
        pickup_city: "Warsaw",
        destination_country: "Germany",
        destination_city: "Berlin",
        status: "submitted",
      })
      .select("id")
      .single();
    assert.equal(created.error, null);
    requestId = created.data!.id as string;
  });

  await t.test("two concurrent start_transport_conversation calls return the same id", async () => {
    const [callA, callB] = await Promise.all([
      customer.rpc("start_transport_conversation", { p_transport_request_id: requestId! }),
      ops.rpc("start_transport_conversation", { p_transport_request_id: requestId! }),
    ]);
    assert.equal(callA.error, null);
    assert.equal(callB.error, null);
    assert.equal(
      callA.data,
      callB.data,
      "both concurrent callers must land on the same conversation",
    );

    const count = await ops
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("linked_transport_request_id", requestId!);
    assert.equal(count.count, 1, "exactly one conversation must exist for this transport request");
  });

  await t.test("cleanup", async () => {
    // conversations/conversation_participants cascade from transport_requests? No -- they only
    // cascade from conversations.id, and transport_requests has no cascade to conversations, so
    // delete both explicitly.
    await ops.from("conversations").delete().eq("linked_transport_request_id", requestId!);
    await ops.from("transport_requests").delete().eq("id", requestId!);
  });
});

test("start_application_conversation: concurrent calls from the same buyer converge on one conversation", async (t) => {
  const buyer = await as("buyer");
  const ops = await as("ops");
  let conversationId: string | undefined;

  await t.test(
    "two concurrent calls for the same (animal, buyer) return the same conversation, not a duplicate",
    async () => {
      const [callA, callB] = await Promise.all([
        buyer.rpc("start_application_conversation", { p_animal_id: ids.animalFabian }),
        buyer.rpc("start_application_conversation", { p_animal_id: ids.animalFabian }),
      ]);
      assert.equal(callA.error, null);
      assert.equal(callB.error, null);
      assert.equal(
        callA.data,
        callB.data,
        "both concurrent callers must land on the same conversation",
      );
      conversationId = callA.data as string;

      const count = await ops
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("linked_animal_id", ids.animalFabian)
        .eq("conversation_type", "marketplace");
      assert.equal(
        count.count,
        1,
        "exactly one marketplace conversation must exist for this animal/buyer",
      );
    },
  );

  await t.test("cleanup", async () => {
    await ops.from("conversations").delete().eq("id", conversationId!);
  });
});
