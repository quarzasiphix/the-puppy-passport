// Stage CJQ (third/fourth supplemental queue): messaging abuse controls
// (20260101012000_messaging_abuse_controls.sql). Two real, previously-unenforced gaps: no length
// bound on messages.body/support_case_messages.body, and no constraint tying
// messages.attachment_url to the message's own conversation_id -- the one real call site
// (sendMessage() in src/lib/queries/messaging.ts) always constructs the path itself right before
// upload, so this proves the raw-API path a client bypassing the app could otherwise reach.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, createTestTransportRequest } from "./helpers.ts";

test("messages: body length is bounded", async (t) => {
  const buyer = await as("buyer");
  let conversationId: string | undefined;

  await t.test("setup: a real conversation (buyer's existing approved application)", async () => {
    // animalFabian is the one animal the seeded `buyer` persona has a real, approved application
    // for (see tests/db/helpers.ts) -- start_application_conversation() requires exactly that.
    const created = await buyer.rpc("start_application_conversation", {
      p_animal_id: ids.animalFabian,
    });
    assert.equal(created.error, null);
    conversationId = created.data as string;
  });

  await t.test("an oversized body (10,001 chars) is rejected", async () => {
    const attempt = await buyer
      .from("messages")
      .insert({
        conversation_id: conversationId!,
        sender_profile_id: ids.buyer,
        body: "a".repeat(10001),
      })
      .select("id");
    assert.ok(attempt.error, "expected the length constraint to reject an oversized body");
  });

  await t.test("a body right at the boundary (10,000 chars) is accepted", async () => {
    const attempt = await buyer
      .from("messages")
      .insert({
        conversation_id: conversationId!,
        sender_profile_id: ids.buyer,
        body: "a".repeat(10000),
      })
      .select("id")
      .single();
    assert.equal(attempt.error, null, "exactly 10,000 chars must still be accepted");
  });

  await t.test("cleanup", async () => {
    const ops = await as("ops");
    const deleted = await ops.from("conversations").delete().eq("id", conversationId!);
    assert.equal(deleted.error, null);
  });
});

test("support_case_messages: body length is bounded", async (t) => {
  const admin = await as("admin");
  let caseId: string | undefined;

  await t.test("setup: a real support case", async () => {
    const created = await admin
      .from("support_cases")
      .insert({ requester_profile_id: ids.customer, subject: "CJQ body-length test" })
      .select("id")
      .single();
    assert.equal(created.error, null);
    caseId = created.data!.id as string;
  });

  await t.test("an oversized body is rejected", async () => {
    const attempt = await admin
      .from("support_case_messages")
      .insert({
        case_id: caseId!,
        sender_profile_id: ids.admin,
        body: "a".repeat(10001),
      })
      .select("id");
    assert.ok(attempt.error, "expected the length constraint to reject an oversized body");
  });

  await t.test("cleanup", async () => {
    const deleted = await admin.from("support_cases").delete().eq("id", caseId!);
    assert.equal(deleted.error, null);
  });
});

test("messages: attachment_url must be scoped to the message's own conversation", async (t) => {
  const buyer = await as("buyer");
  let conversationA: string | undefined;
  let conversationB: string | undefined;

  await t.test("setup: two separate real conversations of different kinds", async () => {
    // An application conversation (buyer's real approved application for animalFabian) and a
    // transport conversation (a fresh disposable transport request the buyer owns) -- genuinely
    // different conversations, not just different animals, so the substitution attempt below is a
    // real cross-conversation reference, not a same-conversation edge case.
    const a = await buyer.rpc("start_application_conversation", { p_animal_id: ids.animalFabian });
    assert.equal(a.error, null);
    conversationA = a.data as string;

    const requestId = await createTestTransportRequest(buyer, {
      requesterProfileId: ids.buyer,
      tag: "CJQ",
    });
    const b = await buyer.rpc("start_transport_conversation", {
      p_transport_request_id: requestId,
    });
    assert.equal(b.error, null);
    conversationB = b.data as string;
    assert.notEqual(conversationA, conversationB);
  });

  await t.test(
    "an attachment_url pointing at a different conversation's folder is rejected",
    async () => {
      const attempt = await buyer
        .from("messages")
        .insert({
          conversation_id: conversationA!,
          sender_profile_id: ids.buyer,
          body: "Forged cross-conversation attachment attempt.",
          attachment_url: `${conversationB}/fake-evidence.jpg`,
        })
        .select("id");
      assert.ok(
        attempt.error,
        "expected the constraint to reject an attachment_url scoped to a different conversation",
      );
    },
  );

  await t.test(
    "an attachment_url correctly scoped to the message's own conversation is accepted",
    async () => {
      const attempt = await buyer
        .from("messages")
        .insert({
          conversation_id: conversationA!,
          sender_profile_id: ids.buyer,
          body: "Correctly scoped attachment.",
          attachment_url: `${conversationA}/real-file.jpg`,
        })
        .select("id")
        .single();
      assert.equal(attempt.error, null);
    },
  );

  await t.test("a message with no attachment at all is unaffected", async () => {
    const attempt = await buyer
      .from("messages")
      .insert({
        conversation_id: conversationA!,
        sender_profile_id: ids.buyer,
        body: "No attachment here.",
      })
      .select("id")
      .single();
    assert.equal(attempt.error, null);
  });

  await t.test("cleanup", async () => {
    const ops = await as("ops");
    const deletedA = await ops.from("conversations").delete().eq("id", conversationA!);
    assert.equal(deletedA.error, null);
    const deletedB = await ops.from("conversations").delete().eq("id", conversationB!);
    assert.equal(deletedB.error, null);
  });
});
