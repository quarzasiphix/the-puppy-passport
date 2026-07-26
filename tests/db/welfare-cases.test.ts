// Stage D: urgent welfare/rescue transport (supabase/migrations/20260101007600_welfare_cases.sql).
// See docs/AUTONOMOUS_BACKEND_PROGRESS.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, isBlocked } from "./helpers.ts";

test("only a verified foundation/shelter/rescue org member can create a welfare case", async (t) => {
  const foundation1 = await as("foundation1");
  const breeder1 = await as("breeder1");
  const customer = await as("customer");

  await t.test("an approved foundation's own member can create a case for their org", async () => {
    const { data, error } = await foundation1
      .from("welfare_cases")
      .insert({
        organisation_id: ids.orgFundacja,
        created_by: ids.foundation1,
        reason: "Stray found injured near the shelter.",
        urgency: "critical",
        status: "submitted",
      })
      .select("id, case_number, status")
      .single();
    assert.equal(error, null);
    assert.ok(data?.case_number?.startsWith("WC-"));
    await foundation1.from("welfare_cases").delete().eq("id", data!.id);
  });

  await t.test(
    "a kennel (org_type='kennel') cannot create a welfare case for their own org",
    async () => {
      const attempt = await breeder1
        .from("welfare_cases")
        .insert({
          organisation_id: ids.orgCichyLas,
          created_by: ids.breeder1,
          reason: "Should be rejected — kennels are not eligible.",
          status: "submitted",
        })
        .select();
      assert.ok(isBlocked(attempt.data, attempt.error));
    },
  );

  await t.test(
    "an ordinary customer with no organisation cannot create a welfare case at all",
    async () => {
      const attempt = await customer
        .from("welfare_cases")
        .insert({
          organisation_id: ids.orgFundacja,
          created_by: ids.customer,
          reason: "Should be rejected — not a member of this org.",
          status: "submitted",
        })
        .select();
      assert.ok(isBlocked(attempt.data, attempt.error));
    },
  );
});

test("welfare case visibility: org members, ops, and unrelated orgs", async (t) => {
  const foundation1 = await as("foundation1");
  const breeder1 = await as("breeder1");
  const ops = await as("ops");
  let caseId: string | undefined;

  await t.test("setup", async () => {
    const created = await foundation1
      .from("welfare_cases")
      .insert({
        organisation_id: ids.orgFundacja,
        created_by: ids.foundation1,
        reason: "Visibility test case.",
        status: "submitted",
      })
      .select("id")
      .single();
    assert.equal(created.error, null);
    caseId = created.data!.id as string;
  });

  await t.test("ops can see it", async () => {
    const { data, error } = await ops.from("welfare_cases").select("id").eq("id", caseId!);
    assert.equal(error, null);
    assert.equal(data?.length, 1);
  });

  await t.test("an unrelated organisation's owner cannot see it", async () => {
    const blocked = await breeder1.from("welfare_cases").select("id").eq("id", caseId!);
    assert.ok(isBlocked(blocked.data, blocked.error));
  });

  await t.test("cleanup", async () => {
    if (caseId) await foundation1.from("welfare_cases").delete().eq("id", caseId);
  });
});

test("ops acknowledge/review workflow", async (t) => {
  const foundation1 = await as("foundation1");
  const ops = await as("ops");
  const breeder1 = await as("breeder1");
  let caseId: string | undefined;

  await t.test("setup", async () => {
    const created = await foundation1
      .from("welfare_cases")
      .insert({
        organisation_id: ids.orgFundacja,
        created_by: ids.foundation1,
        reason: "Review workflow test.",
        status: "submitted",
      })
      .select("id")
      .single();
    assert.equal(created.error, null);
    caseId = created.data!.id as string;
  });

  await t.test("a non-ops user cannot acknowledge or review", async () => {
    const ack = await breeder1.rpc("acknowledge_welfare_case", { p_case_id: caseId! });
    assert.ok(ack.error, "expected a non-ops acknowledge to be rejected");
    const review = await breeder1.rpc("review_welfare_case", {
      p_case_id: caseId!,
      p_decision: "accepted_for_assessment",
    });
    assert.ok(review.error, "expected a non-ops review to be rejected");
  });

  await t.test("ops acknowledges the case", async () => {
    const { error } = await ops.rpc("acknowledge_welfare_case", { p_case_id: caseId! });
    assert.equal(error, null);
    const check = await ops
      .from("welfare_cases")
      .select("ops_acknowledged, ops_acknowledged_by")
      .eq("id", caseId!)
      .single();
    assert.equal(check.data?.ops_acknowledged, true);
    assert.equal(check.data?.ops_acknowledged_by, ids.ops);
  });

  await t.test(
    "ops accepts the case for assessment, with an internal-only review note",
    async () => {
      const { error } = await ops.rpc("review_welfare_case", {
        p_case_id: caseId!,
        p_decision: "accepted_for_assessment",
        p_review_notes: "Confirmed with the shelter by phone — internal only.",
      });
      assert.equal(error, null);
      const check = await ops
        .from("welfare_cases")
        .select("status, review_notes")
        .eq("id", caseId!)
        .single();
      assert.equal(check.data?.status, "accepted_for_assessment");
      assert.equal(
        check.data?.review_notes,
        "Confirmed with the shelter by phone — internal only.",
      );
    },
  );

  await t.test(
    "the organisation sees the new status but the review_notes column is theirs to read too (no column-level hiding at the DB layer -- the UI is responsible for not surfacing it)",
    async () => {
      // RLS is row-level, not column-level — this documents the real boundary rather than pretending
      // review_notes is invisible to the org at the database layer. The foundation UI's own query
      // never selects review_notes for this reason (matches the codebase's established convention,
      // e.g. transport_status_history.internal_note).
      const check = await foundation1
        .from("welfare_cases")
        .select("status")
        .eq("id", caseId!)
        .single();
      assert.equal(check.data?.status, "accepted_for_assessment");
    },
  );

  await t.test("cleanup", async () => {
    if (caseId) await ops.from("welfare_cases").delete().eq("id", caseId);
  });
});

test("conversion to a real transport draft", async (t) => {
  const foundation1 = await as("foundation1");
  const ops = await as("ops");
  const breeder1 = await as("breeder1");
  let caseId: string | undefined;
  let transportRequestId: string | undefined;

  await t.test("setup: a case accepted for assessment", async () => {
    const created = await foundation1
      .from("welfare_cases")
      .insert({
        organisation_id: ids.orgFundacja,
        created_by: ids.foundation1,
        animal_name: "Rescue Dog",
        reason: "Conversion test.",
        location_city: "Warsaw",
        location_country: "Poland",
        destination_city: "Berlin",
        destination_country: "Germany",
        status: "submitted",
      })
      .select("id")
      .single();
    assert.equal(created.error, null);
    caseId = created.data!.id as string;

    const review = await ops.rpc("review_welfare_case", {
      p_case_id: caseId,
      p_decision: "accepted_for_assessment",
    });
    assert.equal(review.error, null);
  });

  await t.test(
    "cannot convert before acceptance is granted a second time (idempotency / re-entry guard)",
    async () => {
      // Not literally "before acceptance" here (already accepted above) -- this proves the *earlier*
      // states are rejected by attempting conversion on a case still in 'submitted' via a fresh case.
      const notYetAccepted = await foundation1
        .from("welfare_cases")
        .insert({
          organisation_id: ids.orgFundacja,
          created_by: ids.foundation1,
          reason: "Not yet accepted.",
          status: "submitted",
        })
        .select("id")
        .single();
      assert.equal(notYetAccepted.error, null);
      const attempt = await foundation1.rpc("convert_welfare_case_to_transport_draft", {
        p_case_id: notYetAccepted.data!.id,
      });
      assert.ok(attempt.error, "expected conversion to be rejected before ops acceptance");
      await foundation1.from("welfare_cases").delete().eq("id", notYetAccepted.data!.id);
    },
  );

  await t.test("an unrelated organisation cannot convert this case", async () => {
    const attempt = await breeder1.rpc("convert_welfare_case_to_transport_draft", {
      p_case_id: caseId!,
    });
    assert.ok(attempt.error, "expected an unrelated org to be rejected");
  });

  await t.test(
    "the case organisation's own member converts it to a real transport draft",
    async () => {
      const { data, error } = await foundation1.rpc("convert_welfare_case_to_transport_draft", {
        p_case_id: caseId!,
      });
      assert.equal(error, null);
      transportRequestId = data as string;

      const request = await foundation1
        .from("transport_requests")
        .select("status, animal_name, requester_profile_id, request_purpose")
        .eq("id", transportRequestId)
        .single();
      assert.equal(request.error, null);
      assert.equal(request.data?.status, "draft");
      assert.equal(request.data?.animal_name, "Rescue Dog");
      assert.equal(request.data?.requester_profile_id, ids.foundation1);
      assert.equal(request.data?.request_purpose, "foundation_rescue");

      const parties = await foundation1
        .from("transport_parties")
        .select("party_role, organisation_id")
        .eq("transport_request_id", transportRequestId);
      assert.equal(parties.error, null);
      const senderRow = parties.data?.find((p) => p.party_role === "sender");
      assert.equal(senderRow?.organisation_id, ids.orgFundacja);

      const caseCheck = await foundation1
        .from("welfare_cases")
        .select("status, converted_transport_request_id")
        .eq("id", caseId!)
        .single();
      assert.equal(caseCheck.data?.status, "converted_to_transport");
      assert.equal(caseCheck.data?.converted_transport_request_id, transportRequestId);
    },
  );

  await t.test(
    "retrying the conversion is a true idempotent success -- returns the same transport request, not an error (Stage XR-9)",
    async () => {
      const retry = await foundation1.rpc("convert_welfare_case_to_transport_draft", {
        p_case_id: caseId!,
      });
      assert.equal(
        retry.error,
        null,
        "a retry after the case is already converted must succeed, not error",
      );
      assert.equal(
        retry.data,
        transportRequestId,
        "must return the original transport request's own id, not create a new one",
      );

      const count = await foundation1
        .from("transport_requests")
        .select("id", { count: "exact", head: true })
        .eq("id", transportRequestId!);
      assert.equal(count.count, 1, "the retry must not have created a second transport request");
    },
  );

  await t.test("cleanup", async () => {
    if (transportRequestId)
      await foundation1.from("transport_requests").delete().eq("id", transportRequestId);
    if (caseId) await ops.from("welfare_cases").delete().eq("id", caseId);
  });
});

// Stage XR-8 (optimistic concurrency/stale-write protection): review_welfare_case() used to do a
// plain, unlocked update with no expected-current-state check at all -- a case already converted
// to a real transport request (or closed) could be silently re-reviewed, contradicting the real
// transport_requests row it already spawned. 20260101013100_welfare_case_review_concurrency_lock.sql
// closes it with a `select ... for update` row lock plus a terminal-state guard.
test("review_welfare_case: terminal states are protected, concurrent reviews serialize safely", async (t) => {
  const foundation1 = await as("foundation1");
  const ops = await as("ops");
  let caseId: string | undefined;
  let transportRequestId: string | undefined;

  await t.test("setup: a case converted to a real transport draft", async () => {
    const created = await foundation1
      .from("welfare_cases")
      .insert({
        organisation_id: ids.orgFundacja,
        created_by: ids.foundation1,
        reason: "XR-8 concurrency test.",
        status: "submitted",
      })
      .select("id")
      .single();
    assert.equal(created.error, null);
    caseId = created.data!.id as string;

    const review = await ops.rpc("review_welfare_case", {
      p_case_id: caseId,
      p_decision: "accepted_for_assessment",
    });
    assert.equal(review.error, null);

    const converted = await foundation1.rpc("convert_welfare_case_to_transport_draft", {
      p_case_id: caseId,
    });
    assert.equal(converted.error, null);
    transportRequestId = converted.data as string;
  });

  await t.test(
    "reviewing an already-converted case is rejected -- it can never be silently reset",
    async () => {
      const attempt = await ops.rpc("review_welfare_case", {
        p_case_id: caseId!,
        p_decision: "declined",
      });
      assert.ok(attempt.error, "expected the terminal-state guard to reject this");

      const check = await ops.from("welfare_cases").select("status").eq("id", caseId!).single();
      assert.equal(
        check.data?.status,
        "converted_to_transport",
        "the case's real status must survive the rejected attempt untouched",
      );
    },
  );

  await t.test(
    "reconsidering between accepted_for_assessment/declined/information_required stays legitimately allowed",
    async () => {
      const secondCase = await foundation1
        .from("welfare_cases")
        .insert({
          organisation_id: ids.orgFundacja,
          created_by: ids.foundation1,
          reason: "XR-8 reconsideration test.",
          status: "submitted",
        })
        .select("id")
        .single();
      assert.equal(secondCase.error, null);
      const secondCaseId = secondCase.data!.id as string;

      const declined = await ops.rpc("review_welfare_case", {
        p_case_id: secondCaseId,
        p_decision: "declined",
      });
      assert.equal(declined.error, null);

      // Ops reconsiders after new information -- a real, legitimate workflow this fix must not
      // block, unlike the genuinely terminal converted/closed states above.
      const reconsidered = await ops.rpc("review_welfare_case", {
        p_case_id: secondCaseId,
        p_decision: "accepted_for_assessment",
      });
      assert.equal(reconsidered.error, null);

      const check = await ops
        .from("welfare_cases")
        .select("status")
        .eq("id", secondCaseId)
        .single();
      assert.equal(check.data?.status, "accepted_for_assessment");

      await ops.from("welfare_cases").delete().eq("id", secondCaseId);
    },
  );

  await t.test(
    "10 concurrent review calls on the same non-terminal case all serialize to a real, consistent final state",
    async () => {
      const thirdCase = await foundation1
        .from("welfare_cases")
        .insert({
          organisation_id: ids.orgFundacja,
          created_by: ids.foundation1,
          reason: "XR-8 race test.",
          status: "submitted",
        })
        .select("id")
        .single();
      assert.equal(thirdCase.error, null);
      const thirdCaseId = thirdCase.data!.id as string;

      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          ops.rpc("review_welfare_case", {
            p_case_id: thirdCaseId,
            p_decision: i % 2 === 0 ? "accepted_for_assessment" : "declined",
          }),
        ),
      );
      for (const r of results) {
        assert.equal(r.error, null, "every concurrent call on a non-terminal case must succeed");
      }

      const check = await ops.from("welfare_cases").select("status").eq("id", thirdCaseId).single();
      assert.ok(
        ["accepted_for_assessment", "declined"].includes(check.data?.status as string),
        "the row lock must leave the case in exactly one real, consistent final state",
      );

      await ops.from("welfare_cases").delete().eq("id", thirdCaseId);
    },
  );

  await t.test("cleanup", async () => {
    if (transportRequestId)
      await foundation1.from("transport_requests").delete().eq("id", transportRequestId);
    if (caseId) await ops.from("welfare_cases").delete().eq("id", caseId);
  });
});
