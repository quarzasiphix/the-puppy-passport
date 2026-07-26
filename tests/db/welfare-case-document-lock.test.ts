// Stage IR-11 (integration-readiness queue): Storage and signed URL security.
// 20260101012500_welfare_case_document_lock.sql. welfare_case_documents (table) and the
// welfare-case-documents Storage bucket both used a single unrestricted `for all` policy for org
// members -- unlike welfare_cases itself, which already locks organisation-side edits to a fixed
// editable window (draft/submitted/information_required). An org member could tamper with
// supporting evidence (replace or delete it) even after ops had already accepted or declined the
// case based on that exact evidence -- the same bug class Stage AP closed for transport_documents.
// These tests prove the real boundary: viewing stays open always, writes are locked once the case
// leaves the editable window, at both the table and the underlying Storage object layer, and ops
// retains full access throughout.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, isBlocked } from "./helpers.ts";

test("welfare case documents are frozen from the org's side once ops decides the case", async (t) => {
  const foundation1 = await as("foundation1");
  const ops = await as("ops");
  let caseId: string | undefined;
  let docId: string | undefined;
  let objectPath: string | undefined;

  await t.test("setup: an editable ('submitted') welfare case", async () => {
    const created = await foundation1
      .from("welfare_cases")
      .insert({
        organisation_id: ids.orgFundacja,
        created_by: ids.foundation1,
        reason: "Storage lock test.",
        status: "submitted",
      })
      .select("id")
      .single();
    assert.equal(created.error, null);
    caseId = created.data!.id as string;
  });

  await t.test("while editable: the org can upload a real supporting document", async () => {
    objectPath = `${caseId}/evidence-${Date.now()}.txt`;
    const upload = await foundation1.storage
      .from("welfare-case-documents")
      .upload(objectPath, new Blob(["original evidence"]), { contentType: "text/plain" });
    assert.equal(upload.error, null);

    const row = await foundation1
      .from("welfare_case_documents")
      .insert({ welfare_case_id: caseId!, file_url: objectPath, uploaded_by: ids.foundation1 })
      .select("id")
      .single();
    assert.equal(row.error, null);
    docId = row.data!.id as string;
  });

  await t.test("while editable: the org can still edit the document row's notes", async () => {
    const update = await foundation1
      .from("welfare_case_documents")
      .update({ notes: "updated while still editable" })
      .eq("id", docId!)
      .select("notes");
    assert.equal(update.error, null);
    assert.equal(update.data?.[0]?.notes, "updated while still editable");
  });

  await t.test("ops accepts the case for assessment, locking it", async () => {
    const review = await ops.rpc("review_welfare_case", {
      p_case_id: caseId!,
      p_decision: "accepted_for_assessment",
    });
    assert.equal(review.error, null);
  });

  await t.test("once locked: the org can still view the document row", async () => {
    const row = await foundation1
      .from("welfare_case_documents")
      .select("id, file_url")
      .eq("id", docId!)
      .single();
    assert.equal(row.error, null);
    assert.equal(row.data?.file_url, objectPath);
  });

  await t.test("once locked: the org can still generate a signed URL for the object", async () => {
    const signed = await foundation1.storage
      .from("welfare-case-documents")
      .createSignedUrl(objectPath!, 60);
    assert.equal(signed.error, null);
    assert.ok(signed.data?.signedUrl);
  });

  await t.test("once locked: the org cannot edit the document row anymore", async () => {
    const attempt = await foundation1
      .from("welfare_case_documents")
      .update({ notes: "trying to tamper after the decision" })
      .eq("id", docId!)
      .select();
    assert.ok(isBlocked(attempt.data, attempt.error));
  });

  await t.test("once locked: the org cannot delete the document row anymore", async () => {
    const attempt = await foundation1
      .from("welfare_case_documents")
      .delete()
      .eq("id", docId!)
      .select();
    assert.ok(isBlocked(attempt.data, attempt.error));
  });

  await t.test("once locked: the org cannot add a new document row anymore", async () => {
    const attempt = await foundation1
      .from("welfare_case_documents")
      .insert({
        welfare_case_id: caseId!,
        file_url: `${caseId}/should-not-be-allowed.txt`,
        uploaded_by: ids.foundation1,
      })
      .select();
    assert.ok(isBlocked(attempt.data, attempt.error));
  });

  await t.test("once locked: the org cannot overwrite the Storage object in place", async () => {
    const attempt = await foundation1.storage
      .from("welfare-case-documents")
      .upload(objectPath!, new Blob(["substituted evidence"]), {
        contentType: "text/plain",
        upsert: true,
      });
    assert.ok(attempt.error, "expected the Storage UPDATE policy to reject this");
  });

  await t.test("once locked: the org cannot delete the Storage object", async () => {
    const attempt = await foundation1.storage.from("welfare-case-documents").remove([objectPath!]);
    // Supabase Storage's remove() reports per-object results rather than a top-level error for an
    // RLS-blocked delete -- the real assertion is that nothing was actually removed.
    assert.equal(attempt.error, null);
    assert.equal(attempt.data?.length ?? 0, 0, "expected zero objects to actually be removed");

    const stillThere = await foundation1.storage
      .from("welfare-case-documents")
      .createSignedUrl(objectPath!, 60);
    assert.equal(stillThere.error, null, "the object must still exist after the blocked delete");
  });

  await t.test("once locked: ops can still add and manage documents on the case", async () => {
    const opsPath = `${caseId}/ops-note-${Date.now()}.txt`;
    const upload = await ops.storage
      .from("welfare-case-documents")
      .upload(opsPath, new Blob(["ops-added evidence"]), { contentType: "text/plain" });
    assert.equal(upload.error, null);

    const row = await ops
      .from("welfare_case_documents")
      .insert({ welfare_case_id: caseId!, file_url: opsPath, uploaded_by: ids.ops })
      .select("id")
      .single();
    assert.equal(row.error, null);

    await ops.from("welfare_case_documents").delete().eq("id", row.data!.id);
    await ops.storage.from("welfare-case-documents").remove([opsPath]);
  });

  await t.test("cleanup", async () => {
    if (objectPath) await ops.storage.from("welfare-case-documents").remove([objectPath]);
    if (docId) await ops.from("welfare_case_documents").delete().eq("id", docId);
    if (caseId) await ops.from("welfare_cases").delete().eq("id", caseId);
  });
});
