// Stage S (supplemental queue): attachments. messages.attachment_url existed on the schema since
// the original messaging migration but was never wired to a real Storage bucket, RLS, or upload
// UI (confirmed by grep: zero references anywhere in src/ before this stage). Covers the new
// message-attachments bucket added in 20260101008700_message_attachments_storage.sql: a
// conversation participant can upload and read within their own conversation, and an unrelated
// user is blocked from both, following the same private-bucket-plus-signed-URL pattern already
// proven for transport-documents (see "real document upload flow" in transport-domain.test.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids } from "./helpers.ts";

test("message attachments: private Storage object + signed URL, scoped to conversation participants", async (t) => {
  const buyer = await as("buyer");
  const breeder1 = await as("breeder1");
  const ops = await as("ops");
  let conversationId: string | undefined;
  let objectPath: string | undefined;
  let messageId: string | undefined;

  await t.test("setup: buyer <-> breeder conversation for a real application", async () => {
    const created = await buyer.rpc("start_application_conversation", {
      p_animal_id: ids.animalFabian,
    });
    assert.equal(created.error, null);
    conversationId = created.data as string;
  });

  await t.test("the buyer uploads a real attachment and records it on a message", async () => {
    objectPath = `${conversationId}/test-attachment-${Date.now()}.txt`;
    const upload = await buyer.storage
      .from("message-attachments")
      .upload(objectPath, new Blob(["not a real attachment — upload flow test"]), {
        contentType: "text/plain",
      });
    assert.equal(upload.error, null);

    const message = await buyer
      .from("messages")
      .insert({
        conversation_id: conversationId!,
        sender_profile_id: ids.buyer,
        body: "Here's a photo of the paperwork.",
        attachment_url: objectPath,
      })
      .select("id, attachment_url")
      .single();
    assert.equal(message.error, null);
    assert.equal(message.data?.attachment_url, objectPath);
    assert.ok(!message.data?.attachment_url?.startsWith("http"));
    messageId = message.data!.id as string;
  });

  await t.test("the other participant (breeder) can generate a signed URL for it", async () => {
    const signed = await breeder1.storage
      .from("message-attachments")
      .createSignedUrl(objectPath!, 60);
    assert.equal(signed.error, null);
    assert.ok(signed.data?.signedUrl);
  });

  await t.test("ops can also read it", async () => {
    const signed = await ops.storage.from("message-attachments").createSignedUrl(objectPath!, 60);
    assert.equal(signed.error, null);
    assert.ok(signed.data?.signedUrl);
  });

  await t.test("an unrelated user cannot generate a signed URL for it", async () => {
    const outsider = await as("foundation1");
    const signed = await outsider.storage
      .from("message-attachments")
      .createSignedUrl(objectPath!, 60);
    assert.ok(
      signed.error,
      "expected a permission error creating a signed URL for another conversation's attachment",
    );
  });

  await t.test(
    "an unrelated user cannot upload into someone else's conversation folder",
    async () => {
      const outsider = await as("foundation1");
      const attempt = await outsider.storage
        .from("message-attachments")
        .upload(`${conversationId}/intrusion-attempt.txt`, new Blob(["should not land"]), {
          contentType: "text/plain",
        });
      assert.ok(attempt.error, "expected the upload to be rejected");
    },
  );

  await t.test("cleanup", async () => {
    if (messageId) await ops.from("conversations").delete().eq("id", conversationId!);
    await ops.storage.from("message-attachments").remove([objectPath!]);
  });
});
