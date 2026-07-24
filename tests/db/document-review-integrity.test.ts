// Stage AO (supplemental queue): security red-team pass.
// 20260101009600_transport_document_review_lock.sql closed two real gaps:
// 1) A requester had unrestricted column access to their own transport_documents rows -- could
//    self-set status='accepted' and forge reviewed_by/reviewed_at (faking an ops review that
//    never happened), and -- the more serious one -- could swap file_url to a different Storage
//    object *after* a real ops approval without resetting the review status (document
//    substitution: a passport/health-certificate scan swapped out post-approval while still
//    showing as ops-reviewed).
// 2) reviewDocument() (ops-side) trusted a client-supplied reviewedBy -- one ops account could
//    credit a different ops profile as the reviewer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids } from "./helpers.ts";

test("a requester cannot self-approve or forge review fields on their own document", async (t) => {
  const customer = await as("customer");
  const ops = await as("ops");
  let documentId: string | undefined;

  await t.test("setup: the requester uploads a real document", async () => {
    const doc = await customer
      .from("transport_documents")
      .insert({
        transport_request_id: ids.transportWarsawAmsterdam,
        category: "other",
        file_url: `${ids.transportWarsawAmsterdam}/red-team-doc-${Date.now()}.txt`,
        uploaded_by: ids.customer,
        status: "uploaded",
      })
      .select("id, status")
      .single();
    assert.equal(doc.error, null);
    assert.equal(doc.data?.status, "uploaded");
    documentId = doc.data!.id as string;
  });

  await t.test("the requester cannot self-set status to accepted", async () => {
    const attempt = await customer
      .from("transport_documents")
      .update({ status: "accepted" })
      .eq("id", documentId!)
      .select();
    assert.ok(attempt.error, "expected the trigger to reject a requester self-approving");
  });

  await t.test("the requester cannot forge reviewed_by/reviewed_at", async () => {
    const attempt = await customer
      .from("transport_documents")
      .update({ reviewed_by: ids.customer, reviewed_at: new Date().toISOString() })
      .eq("id", documentId!)
      .select();
    assert.ok(attempt.error, "expected the trigger to reject forged review fields");
  });

  await t.test(
    "the requester can still legitimately replace the file while not yet accepted",
    async () => {
      const newPath = `${ids.transportWarsawAmsterdam}/red-team-doc-corrected-${Date.now()}.txt`;
      const replace = await customer
        .from("transport_documents")
        .update({ file_url: newPath })
        .eq("id", documentId!)
        .select("file_url")
        .single();
      assert.equal(replace.error, null, "replacing a not-yet-accepted document must stay allowed");
      assert.equal(replace.data?.file_url, newPath);
    },
  );

  await t.test("ops accepts the document for real", async () => {
    const reviewed = await ops
      .from("transport_documents")
      .update({ status: "accepted", reviewed_by: ids.ops, reviewed_at: new Date().toISOString() })
      .eq("id", documentId!)
      .select("status, reviewed_by")
      .single();
    assert.equal(reviewed.error, null);
    assert.equal(reviewed.data?.status, "accepted");
  });

  await t.test(
    "document substitution: the requester cannot swap the file after acceptance",
    async () => {
      const swapAttempt = await customer
        .from("transport_documents")
        .update({ file_url: `${ids.transportWarsawAmsterdam}/substituted-${Date.now()}.txt` })
        .eq("id", documentId!)
        .select();
      assert.ok(
        swapAttempt.error,
        "expected an accepted document to be completely locked from requester changes",
      );

      // Confirm nothing changed at all, not even silently.
      const stillAccepted = await ops
        .from("transport_documents")
        .select("status")
        .eq("id", documentId!)
        .single();
      assert.equal(stillAccepted.error, null);
      assert.equal(stillAccepted.data?.status, "accepted");
    },
  );

  await t.test("cleanup", async () => {
    await ops.from("transport_documents").delete().eq("id", documentId!);
  });
});

test("reviewDocument: reviewed_by is always the real ops caller, never a forged profile", async (t) => {
  const customer = await as("customer");
  const ops = await as("ops");
  const admin = await as("admin");
  let documentId: string | undefined;

  await t.test("setup: a fresh uploaded document", async () => {
    const doc = await customer
      .from("transport_documents")
      .insert({
        transport_request_id: ids.transportWarsawAmsterdam,
        category: "other",
        file_url: `${ids.transportWarsawAmsterdam}/red-team-actor-${Date.now()}.txt`,
        uploaded_by: ids.customer,
        status: "uploaded",
      })
      .select("id")
      .single();
    assert.equal(doc.error, null);
    documentId = doc.data!.id as string;
  });

  await t.test(
    "ops reviews it while attempting to credit a different profile as reviewer; the real caller wins",
    async () => {
      const reviewed = await ops
        .from("transport_documents")
        .update({
          status: "accepted",
          reviewed_by: ids.admin, // attempted forgery: crediting admin instead of the real caller
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", documentId!)
        .select("reviewed_by")
        .single();
      assert.equal(reviewed.error, null);
      assert.equal(
        reviewed.data?.reviewed_by,
        ids.ops,
        "reviewed_by must be server-stamped to the real caller, ignoring the forged value",
      );
    },
  );

  await t.test("cleanup", async () => {
    await admin.from("transport_documents").delete().eq("id", documentId!);
  });
});
