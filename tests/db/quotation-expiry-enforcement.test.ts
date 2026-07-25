// Stage IR-9 (integration-readiness queue): document expiry jobs
// (20260101012400_quotation_expiry_enforcement.sql). transport_documents/vehicles/drivers already
// have a real, deliberate, already-wired client-computed expiry warning (no background job exists
// anywhere in this app, Stage BA) -- quotations.expiry_date was the one genuine gap: nothing
// stopped a customer accepting an already-expired price quote, server-side or in the UI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, createTestTransportRequest } from "./helpers.ts";

async function createTestQuotation(requestId: string, expiryDate: string | null): Promise<string> {
  const admin = await as("admin");
  const created = await admin
    .from("quotations")
    .insert({
      transport_request_id: requestId,
      service_type: "individual",
      total_price: 500,
      currency: "EUR",
      expiry_date: expiryDate,
      status: "sent",
    })
    .select("id")
    .single();
  assert.equal(created.error, null);
  return created.data!.id as string;
}

test("quotations: a customer cannot accept an already-expired quotation", async (t) => {
  const admin = await as("admin");
  let requestId: string | undefined;
  let quotationId: string | undefined;

  await t.test("setup: a disposable request and an already-expired quotation", async () => {
    requestId = await createTestTransportRequest(admin, {
      requesterProfileId: ids.customer,
      tag: "IR9",
    });
    quotationId = await createTestQuotation(requestId, "2020-01-01");
  });

  await t.test("accepting the expired quotation is rejected", async () => {
    const customer = await as("customer");
    const attempt = await customer
      .from("quotations")
      .update({ status: "accepted" })
      .eq("id", quotationId!)
      .select();
    assert.ok(attempt.error, "expected an expired quotation to reject an accept transition");

    const stillSent = await admin
      .from("quotations")
      .select("status")
      .eq("id", quotationId!)
      .single();
    assert.equal(stillSent.data?.status, "sent", "status must be unchanged");
  });

  await t.test("rejecting an expired quotation is still allowed", async () => {
    const customer = await as("customer");
    const attempt = await customer
      .from("quotations")
      .update({ status: "rejected" })
      .eq("id", quotationId!)
      .select("status")
      .single();
    assert.equal(attempt.error, null, "declining a stale quote must remain harmless and allowed");
    assert.equal(attempt.data?.status, "rejected");
  });

  await t.test("cleanup", async () => {
    await admin.from("quotations").delete().eq("id", quotationId!);
  });
});

test("quotations: a customer can accept a quotation that has not expired", async (t) => {
  const admin = await as("admin");
  let requestId: string | undefined;
  let quotationId: string | undefined;

  await t.test(
    "setup: a disposable request and a quotation expiring far in the future",
    async () => {
      requestId = await createTestTransportRequest(admin, {
        requesterProfileId: ids.customer,
        tag: "IR9-valid",
      });
      quotationId = await createTestQuotation(requestId, "2099-01-01");
    },
  );

  await t.test("accepting the still-valid quotation succeeds", async () => {
    const customer = await as("customer");
    const attempt = await customer
      .from("quotations")
      .update({ status: "accepted" })
      .eq("id", quotationId!)
      .select("status")
      .single();
    assert.equal(attempt.error, null);
    assert.equal(attempt.data?.status, "accepted");
  });

  await t.test("cleanup", async () => {
    await admin.from("quotations").delete().eq("id", quotationId!);
  });
});

test("quotations: a null expiry_date never blocks acceptance", async (t) => {
  const admin = await as("admin");
  let requestId: string | undefined;
  let quotationId: string | undefined;

  await t.test("setup: a disposable request and a quotation with no expiry date", async () => {
    requestId = await createTestTransportRequest(admin, {
      requesterProfileId: ids.customer,
      tag: "IR9-noexpiry",
    });
    quotationId = await createTestQuotation(requestId, null);
  });

  await t.test("accepting a quotation with no expiry date succeeds", async () => {
    const customer = await as("customer");
    const attempt = await customer
      .from("quotations")
      .update({ status: "accepted" })
      .eq("id", quotationId!)
      .select("status")
      .single();
    assert.equal(attempt.error, null);
    assert.equal(attempt.data?.status, "accepted");
  });

  await t.test("cleanup", async () => {
    await admin.from("quotations").delete().eq("id", quotationId!);
  });
});
