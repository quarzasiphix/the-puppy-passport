// Stage CJD (third/fourth supplemental queue): server-controlled actor attribution audit
// (20260101011200_actor_attribution_stragglers.sql). quotations.created_by and
// legal_requirements.created_by were both still client-insertable with no trigger tying them to
// the real caller -- quotations.created_by is the real, demonstrated gap (createQuotation() in
// src/lib/queries/operations.ts inserted a client-supplied value, called from a real, live UI).
//
// Stage XR-7 found a real straggler CJD's own re-grep missed: transport_status_history.changed_by
// (20260101013000_transport_status_history_actor_lock.sql) -- respondToQuotation()/
// createTransportRequest() (src/lib/queries/transport.ts) both insert a client-supplied
// changed_by with no server check at all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, createTestTransportRequest, ids } from "./helpers.ts";

test("quotations.created_by is always server-stamped, never forgeable", async (t) => {
  const ops = await as("ops");
  const admin = await as("admin");
  let quotationId: string | undefined;

  await t.test(
    "ops creates a quotation while trying to forge created_by to a different profile",
    async () => {
      const quotation = await ops
        .from("quotations")
        .insert({
          transport_request_id: ids.transportWarsawAmsterdam,
          service_type: "individual",
          total_price: 300,
          currency: "EUR",
          status: "draft",
          created_by: ids.admin,
        })
        .select("id, created_by")
        .single();
      assert.equal(quotation.error, null);
      assert.equal(
        quotation.data?.created_by,
        ids.ops,
        "the trigger must stamp the real caller, not the forged value",
      );
      quotationId = quotation.data!.id as string;
    },
  );

  await t.test("cleanup", async () => {
    await admin.from("quotations").delete().eq("id", quotationId!);
  });
});

test("legal_requirements.created_by is always server-stamped, never forgeable", async (t) => {
  const admin = await as("admin");
  const ops = await as("ops");
  let requirementId: string | undefined;

  await t.test("admin creates a legal requirement while trying to forge created_by", async () => {
    const created = await admin
      .from("legal_requirements")
      .insert({
        country: "Poland",
        category: "transport",
        title: "Test requirement for actor-attribution audit",
        summary: "Test requirement for actor-attribution audit.",
        source_url: "https://example.gov.pl/legal-requirement",
        last_reviewed_at: new Date().toISOString().slice(0, 10),
        is_published: false,
        created_by: ids.ops,
      })
      .select("id, created_by")
      .single();
    assert.equal(created.error, null);
    assert.equal(
      created.data?.created_by,
      ids.admin,
      "the trigger must stamp the real caller, not the forged value",
    );
    requirementId = created.data!.id as string;
  });

  await t.test("cleanup", async () => {
    await admin.from("legal_requirements").delete().eq("id", requirementId!);
  });
});

test("transport_status_history.changed_by is always server-stamped, never forgeable", async (t) => {
  const ops = await as("ops");
  const customer = await as("customer");
  let requestId: string | undefined;

  await t.test("setup: a real request the customer owns", async () => {
    requestId = await createTestTransportRequest(ops, {
      requesterProfileId: ids.customer,
      tag: "XR7-ACTOR",
      status: "submitted",
    });
  });

  await t.test(
    "the customer logs a status change while trying to forge changed_by to a different profile",
    async () => {
      const logged = await customer
        .from("transport_status_history")
        .insert({
          transport_request_id: requestId!,
          status: "submitted",
          changed_by: ids.ops,
          customer_note: "XR-7 forged-actor test.",
        })
        .select("id, changed_by")
        .single();
      assert.equal(logged.error, null);
      assert.equal(
        logged.data?.changed_by,
        ids.customer,
        "the trigger must stamp the real caller, not the forged value",
      );
    },
  );

  await t.test("cleanup", async () => {
    // transport_status_history has no DELETE policy for anyone (genuinely append-only, matching
    // audit_logs) -- deleting the parent request cascades and removes the history row with it.
    await ops.from("transport_requests").delete().eq("id", requestId!);
  });
});
