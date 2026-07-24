// Stage R (supplemental queue): messaging/conversation security. No prior test in this suite
// touched public.messages/conversations/conversation_participants at all -- a real coverage gap
// for a feature with its own RLS surface. Covers: the is_internal lock added in
// 20260101008600_messages_internal_flag_lock.sql (an ordinary participant could previously set
// is_internal = true on their own INSERT, spoofing what's meant to be a trusted ops-only
// annotation channel), that a normal message still round-trips correctly, that internal messages
// stay hidden from non-ops participants while ops can both write and read them, and that an
// unrelated third party has zero access to the conversation at all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, isBlocked } from "./helpers.ts";

test("messaging security: is_internal lock, normal messages, and cross-tenant isolation", async (t) => {
  const buyer = await as("buyer");
  const breeder1 = await as("breeder1");
  const ops = await as("ops");
  let conversationId: string | undefined;

  await t.test("setup: buyer <-> breeder conversation for a real application", async () => {
    const created = await buyer.rpc("start_application_conversation", {
      p_animal_id: ids.animalFabian,
    });
    assert.equal(created.error, null);
    conversationId = created.data as string;
    assert.ok(conversationId);
  });

  await t.test(
    "a participant cannot set is_internal = true on their own message (locked by the trigger-less RLS WITH CHECK)",
    async () => {
      const attempt = await buyer
        .from("messages")
        .insert({
          conversation_id: conversationId!,
          sender_profile_id: ids.buyer,
          body: "Spoofed internal note attempt.",
          is_internal: true,
        })
        .select("id");
      assert.ok(
        isBlocked(attempt.data, attempt.error),
        "expected the RLS WITH CHECK to reject a participant-authored is_internal=true message",
      );
    },
  );

  let normalMessageId: string | undefined;
  await t.test("a participant can send a normal (non-internal) message", async () => {
    const sent = await buyer
      .from("messages")
      .insert({
        conversation_id: conversationId!,
        sender_profile_id: ids.buyer,
        body: "Hi, is Fabian still available for a video call?",
      })
      .select("id, is_internal")
      .single();
    assert.equal(sent.error, null);
    assert.equal(sent.data?.is_internal, false);
    normalMessageId = sent.data!.id as string;
  });

  await t.test("the other participant (breeder) can read the normal message", async () => {
    const seen = await breeder1
      .from("messages")
      .select("id, body")
      .eq("id", normalMessageId!)
      .single();
    assert.equal(seen.error, null);
    assert.ok(seen.data?.body.includes("video call"));
  });

  let internalMessageId: string | undefined;
  await t.test("ops staff can write a real internal note via their own broad policy", async () => {
    const sent = await ops
      .from("messages")
      .insert({
        conversation_id: conversationId!,
        sender_profile_id: ids.ops,
        body: "Internal: buyer already flagged as a repeat applicant, fast-track review.",
        is_internal: true,
      })
      .select("id")
      .single();
    assert.equal(sent.error, null);
    internalMessageId = sent.data!.id as string;
  });

  await t.test("the internal note is invisible to the ordinary participants", async () => {
    const buyerView = await buyer.from("messages").select("id").eq("id", internalMessageId!);
    assert.ok(isBlocked(buyerView.data, buyerView.error));

    const breederView = await breeder1.from("messages").select("id").eq("id", internalMessageId!);
    assert.ok(isBlocked(breederView.data, breederView.error));
  });

  await t.test("ops can still read the internal note back", async () => {
    const seen = await ops
      .from("messages")
      .select("id, is_internal")
      .eq("id", internalMessageId!)
      .single();
    assert.equal(seen.error, null);
    assert.equal(seen.data?.is_internal, true);
  });

  await t.test("an unrelated third party has zero access to this conversation", async () => {
    const outsider = await as("foundation1");

    const conv = await outsider.from("conversations").select("id").eq("id", conversationId!);
    assert.ok(isBlocked(conv.data, conv.error));

    const msgs = await outsider
      .from("messages")
      .select("id")
      .eq("conversation_id", conversationId!);
    assert.ok(isBlocked(msgs.data, msgs.error));

    const sendAttempt = await outsider
      .from("messages")
      .insert({
        conversation_id: conversationId!,
        sender_profile_id: ids.foundation1,
        body: "I should not be able to post here.",
      })
      .select("id");
    assert.ok(isBlocked(sendAttempt.data, sendAttempt.error));
  });

  await t.test("cleanup", async () => {
    await ops.from("conversations").delete().eq("id", conversationId!);
  });
});
