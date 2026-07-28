// Stage F: full adoption questionnaire and review workflow
// (supabase/migrations/20260101007800_adoption_questionnaire_and_review.sql). See
// docs/AUTONOMOUS_BACKEND_PROGRESS.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, isBlocked } from "./helpers.ts";

test("buyer-write-lock: a buyer cannot directly change status/breeder_response/internal_notes on their own application", async (t) => {
  const buyer = await as("buyer");
  let applicationId: string | undefined;

  try {
    await t.test("setup: buyer submits an adoption application", async () => {
      const created = await buyer
        .from("buyer_applications")
        .insert({
          animal_id: ids.animalReksio,
          buyer_id: ids.buyer,
          organization_id: ids.orgFundacja,
          application_type: "adoption",
          message: "I'd love to adopt this dog.",
        })
        .select("id, status")
        .single();
      assert.equal(created.error, null);
      assert.equal(created.data?.status, "submitted");
      applicationId = created.data!.id as string;
    });

    // These are deliberate business-rule rejections raised by the buyer-write-lock trigger (a real
    // Postgres exception, errcode P0001) — not an RLS row filter, so isBlocked() (which checks for
    // the RLS-style "empty result or permission-denied" shape) doesn't apply; check attempt.error
    // directly, same as the transport snapshot-lock trigger tests do.
    await t.test("the buyer cannot self-approve their own application", async () => {
      const attempt = await buyer
        .from("buyer_applications")
        .update({ status: "approved" })
        .eq("id", applicationId!)
        .select();
      assert.ok(attempt.error, "expected the buyer-write-lock trigger to reject this");
    });

    await t.test("the buyer cannot write their own breeder_response", async () => {
      const attempt = await buyer
        .from("buyer_applications")
        .update({ breeder_response: "Approved! (forged)" })
        .eq("id", applicationId!)
        .select();
      assert.ok(attempt.error, "expected the buyer-write-lock trigger to reject this");
    });

    await t.test("the buyer cannot write internal_notes", async () => {
      const attempt = await buyer
        .from("buyer_applications")
        .update({ internal_notes: "Great applicant (forged)" })
        .eq("id", applicationId!)
        .select();
      assert.ok(attempt.error, "expected the buyer-write-lock trigger to reject this");
    });

    await t.test("the buyer CAN edit their own questionnaire answers", async () => {
      const attempt = await buyer
        .from("buyer_applications")
        .update({
          message: "Updated message with more detail.",
          veterinary_plan: "Local vet clinic.",
        })
        .eq("id", applicationId!)
        .select("message, veterinary_plan")
        .single();
      assert.equal(attempt.error, null);
      assert.equal(attempt.data?.message, "Updated message with more detail.");
    });

    await t.test("the buyer CAN withdraw their own application", async () => {
      const attempt = await buyer
        .from("buyer_applications")
        .update({ status: "withdrawn" })
        .eq("id", applicationId!)
        .select("status")
        .single();
      assert.equal(attempt.error, null);
      assert.equal(attempt.data?.status, "withdrawn");
    });

    await t.test("the buyer cannot forge organization_id/animal_id/buyer_id either", async () => {
      const attempt = await buyer
        .from("buyer_applications")
        .update({ organization_id: ids.orgCichyLas })
        .eq("id", applicationId!)
        .select();
      assert.ok(attempt.error, "expected the buyer-write-lock trigger to reject this");
    });
  } finally {
    // Every subtest above must run inside this try/finally: node:test does not automatically
    // continue to later `await t.test(...)` calls once an earlier one throws (an assertion
    // failure throws), so an unwrapped sequence can skip cleanup entirely and leave a stray row
    // behind — a real, previously-undiscovered gap that let cleanup be skipped silently and broke
    // an unrelated test file's assertions in a later run (found while dogfooding
    // release:preflight). See the same pattern already required by buildEligibleFixture() in
    // fundraising.test.ts.
    await t.test("cleanup", async () => {
      const admin = await as("admin");
      if (applicationId) {
        const deleted = await admin.from("buyer_applications").delete().eq("id", applicationId);
        assert.equal(
          deleted.error,
          null,
          "cleanup must not silently swallow a real deletion failure — a real, previous silent " +
            "failure here left dirty test data behind that broke an unrelated test file's " +
            "assertions in a later run (found while dogfooding release:preflight)",
        );
      }
    });
  }
});

test("the organisation can review with a new interview_planned status and set internal_notes", async (t) => {
  const buyer = await as("buyer");
  const foundation1 = await as("foundation1");
  let applicationId: string | undefined;

  try {
    await t.test("setup", async () => {
      const created = await buyer
        .from("buyer_applications")
        .insert({
          animal_id: ids.animalReksio,
          buyer_id: ids.buyer,
          organization_id: ids.orgFundacja,
          application_type: "adoption",
          message: "Interview test.",
        })
        .select("id")
        .single();
      assert.equal(created.error, null);
      applicationId = created.data!.id as string;
    });

    await t.test("the org sets interview_planned with internal notes and a reply", async () => {
      const { data, error } = await foundation1
        .from("buyer_applications")
        .update({
          status: "interview_planned",
          breeder_response: "Let's set up a call this week.",
          internal_notes: "Seems experienced with rescues — prioritise.",
        })
        .eq("id", applicationId!)
        .select("status, breeder_response, internal_notes")
        .single();
      assert.equal(error, null);
      assert.equal(data?.status, "interview_planned");
      assert.equal(data?.internal_notes, "Seems experienced with rescues — prioritise.");
    });

    await t.test("an unrelated organisation cannot review this application", async () => {
      const breeder1 = await as("breeder1");
      const attempt = await breeder1
        .from("buyer_applications")
        .update({ status: "approved" })
        .eq("id", applicationId!)
        .select();
      assert.ok(isBlocked(attempt.data, attempt.error));
    });
  } finally {
    await t.test("cleanup", async () => {
      // Org owners only have SELECT/UPDATE on buyer_applications, no DELETE grant — matches the
      // "a campaign moves through states, it never just disappears" discipline already established
      // for fundraising_campaigns. Only the buyer themselves or an admin can delete this row.
      const admin = await as("admin");
      if (applicationId) {
        const deleted = await admin.from("buyer_applications").delete().eq("id", applicationId);
        assert.equal(
          deleted.error,
          null,
          "cleanup must not silently swallow a real deletion failure",
        );
      }
    });
  }
});

test("approved adoption application connects to a real transport draft via the existing entry point", async (t) => {
  const buyer = await as("buyer");
  const foundation1 = await as("foundation1");
  let applicationId: string | undefined;
  let transportRequestId: string | undefined;

  try {
    await t.test("setup: application submitted and approved", async () => {
      const created = await buyer
        .from("buyer_applications")
        .insert({
          animal_id: ids.animalReksio,
          buyer_id: ids.buyer,
          organization_id: ids.orgFundacja,
          application_type: "adoption",
          message: "Transport conversion test.",
        })
        .select("id")
        .single();
      assert.equal(created.error, null);
      applicationId = created.data!.id as string;

      const approved = await foundation1
        .from("buyer_applications")
        .update({ status: "approved", breeder_response: "Welcome to the family!" })
        .eq("id", applicationId)
        .select("status")
        .single();
      assert.equal(approved.error, null);
      assert.equal(approved.data?.status, "approved");
    });

    await t.test("the org starts a transport draft naming the buyer as recipient", async () => {
      const { data, error } = await foundation1.rpc("create_transport_draft", {
        p_request: { request_purpose: "adoption", ownership_changing: true },
        p_animals: [{ animal_id: ids.animalReksio, name: "Reksio" }],
        p_parties: [
          { party_role: "recipient", profile_id: ids.buyer },
          { party_role: "sender", organisation_id: ids.orgFundacja },
        ],
      });
      assert.equal(error, null);
      transportRequestId = data as string;

      const request = await foundation1
        .from("transport_requests")
        .select("status")
        .eq("id", transportRequestId)
        .single();
      assert.equal(request.data?.status, "draft");
    });
  } finally {
    await t.test("cleanup", async () => {
      if (transportRequestId) {
        const deletedRequest = await foundation1
          .from("transport_requests")
          .delete()
          .eq("id", transportRequestId);
        assert.equal(
          deletedRequest.error,
          null,
          "cleanup must not silently swallow a real deletion failure",
        );
      }
      const admin = await as("admin");
      if (applicationId) {
        const deleted = await admin.from("buyer_applications").delete().eq("id", applicationId);
        assert.equal(
          deleted.error,
          null,
          "cleanup must not silently swallow a real deletion failure",
        );
      }
    });
  }
});
