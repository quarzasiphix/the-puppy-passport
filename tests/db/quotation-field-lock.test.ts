// Stage L (database consistency audit): closes a real, previously-documented-but-unfixed gap
// (docs/adr/TRANSPORT_DATA_MODEL.md, "Quotations, routes, assignments"; carried forward in
// docs/AUTONOMOUS_BACKEND_PROGRESS.md as a known open item) via
// supabase/migrations/20260101008400_quotation_requester_field_lock.sql. RLS is row-level, not
// column-level: "requesters accept or reject their own quotation" only ever restricted
// `WITH CHECK (status in ('accepted', 'rejected'))`, so nothing stopped a requester's UPDATE from
// also smuggling changes to total_price/base_price/etc on the same statement. Not reachable
// through the real UI (respondToQuotation() in src/lib/queries/transport.ts only ever sends
// { status }), only via a raw API call -- worth closing anyway, the same shape as every other lock
// trigger added this session.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids } from "./helpers.ts";

test("quotation field lock: requester can only change status, ops can change everything", async (t) => {
  const ops = await as("ops");
  const customer = await as("customer");
  let quotationId: string | undefined;

  await t.test("ops creates and sends a quotation on the customer's own request", async () => {
    const quotation = await ops
      .from("quotations")
      .insert({
        transport_request_id: ids.transportWarsawAmsterdam,
        service_type: "individual",
        total_price: 500,
        currency: "EUR",
        status: "sent",
        created_by: ids.ops,
      })
      .select("id, total_price")
      .single();
    assert.equal(quotation.error, null);
    assert.equal(quotation.data?.total_price, 500);
    quotationId = quotation.data!.id as string;
  });

  await t.test(
    "the requester cannot smuggle a price change alongside an accept/reject update",
    async () => {
      const attempt = await customer
        .from("quotations")
        .update({ status: "accepted", total_price: 1 })
        .eq("id", quotationId!)
        .select("id");
      assert.ok(
        attempt.error,
        "expected the trigger to reject a requester update that also changes total_price",
      );

      // Confirm nothing changed at all (not even the status) -- the whole statement must be
      // rejected, not partially applied.
      const after = await ops
        .from("quotations")
        .select("status, total_price")
        .eq("id", quotationId!)
        .single();
      assert.equal(after.error, null);
      assert.equal(after.data?.status, "sent");
      assert.equal(after.data?.total_price, 500);
    },
  );

  await t.test("the requester can still legitimately accept via a status-only update", async () => {
    const accept = await customer
      .from("quotations")
      .update({ status: "accepted" })
      .eq("id", quotationId!)
      .select("status, total_price")
      .single();
    assert.equal(accept.error, null);
    assert.equal(accept.data?.status, "accepted");
    assert.equal(accept.data?.total_price, 500);
  });

  await t.test("ops staff retain full column access regardless of the lock trigger", async () => {
    const opsUpdate = await ops
      .from("quotations")
      .update({ total_price: 475, status: "sent" })
      .eq("id", quotationId!)
      .select("status, total_price")
      .single();
    assert.equal(opsUpdate.error, null);
    assert.equal(opsUpdate.data?.status, "sent");
    assert.equal(opsUpdate.data?.total_price, 475);
  });

  await t.test("cleanup", async () => {
    await ops.from("quotations").delete().eq("id", quotationId!);
  });
});
