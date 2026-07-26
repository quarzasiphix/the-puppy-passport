// Stage XR-5 (append-only queue): signed URL permission-loss safety. Every real signed-URL call
// site in this app (src/lib/queries/{messaging,driver,welfare,transport}.ts) uses a 300-second
// (5-minute) TTL, generated fresh on demand (a plain useState in the consuming component, never
// cached in React Query or persisted to a table) -- never a long-lived or stored link. Supabase
// Storage signed URLs are self-contained bearer tokens: once issued, they remain valid until they
// expire regardless of what happens to the underlying permission afterward (a role suspension, an
// ownership change, a cancellation) -- RLS is only re-evaluated on the *next* signed-URL request,
// not on each download of an already-issued one. This is a real, inherent platform property, not
// something application code controls or could "fix" without building a URL-revocation/blacklist
// layer (significant new infrastructure with no demonstrated need). This test proves the actual
// behaviour empirically rather than assuming it, and documents which of the 5 named scenarios
// (removal, suspension, transfer, cancellation, dispute) are actually reachable in this schema.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, createTestTransportRequest, ids } from "./helpers.ts";

test("suspension: an already-issued signed URL survives, but a new one cannot be created", async (t) => {
  const ops = await as("ops");
  const admin = await as("admin");
  const driver = await as("driver");
  let requestId: string | undefined;
  let objectPath: string | undefined;
  let signedUrl: string | undefined;

  await t.test(
    "setup: a request assigned to the driver, with a real uploaded evidence file",
    async () => {
      requestId = await createTestTransportRequest(ops, {
        requesterProfileId: ids.customer,
        tag: "XR5-SUSPEND",
        status: "driver_assigned",
        assigned_driver_id: ids.driverRecord,
        assigned_vehicle_id: ids.vehicle,
      });
      objectPath = `${requestId}/evidence-${Date.now()}.txt`;
      const upload = await driver.storage
        .from("transport-evidence")
        .upload(objectPath, new Blob(["evidence"]), { contentType: "text/plain" });
      assert.equal(upload.error, null);
    },
  );

  await t.test("while active: the driver can create a signed URL", async () => {
    const signed = await driver.storage
      .from("transport-evidence")
      .createSignedUrl(objectPath!, 300);
    assert.equal(signed.error, null);
    assert.ok(signed.data?.signedUrl);
    signedUrl = signed.data!.signedUrl;
  });

  await t.test("the driver's role is suspended", async () => {
    const suspend = await admin
      .from("user_roles")
      .update({ status: "suspended" })
      .eq("user_id", ids.driver)
      .eq("role", "driver")
      .select("status");
    assert.equal(suspend.error, null);
  });

  await t.test(
    "once suspended: the driver can no longer create a NEW signed URL for the same object",
    async () => {
      const attempt = await driver.storage
        .from("transport-evidence")
        .createSignedUrl(objectPath!, 300);
      assert.ok(attempt.error, "expected RLS to block a fresh signed-URL request post-suspension");
    },
  );

  await t.test(
    "but the ALREADY-ISSUED signed URL from before the suspension still resolves -- the real, honest residual risk this stage documents",
    async () => {
      const response = await fetch(signedUrl!);
      assert.equal(
        response.status,
        200,
        "a signed URL issued before revocation remains a valid bearer token until it expires -- " +
          "Storage doesn't re-check RLS per download, only when a new signed URL is minted",
      );
    },
  );

  await t.test("cleanup: restore the driver's role and remove the test object", async () => {
    await admin
      .from("user_roles")
      .update({ status: "active" })
      .eq("user_id", ids.driver)
      .eq("role", "driver");
    await ops.storage.from("transport-evidence").remove([objectPath!]);
    await ops.from("transport_requests").delete().eq("id", requestId!);
  });
});

test("cancellation: a customer keeps read access to their own request's documents by design, not by omission", async (t) => {
  // Unlike suspension (which really does need to cut off access), cancelling a transport request
  // is not treated as a permission-revoking event -- the requester should still be able to look
  // back at documents they uploaded for their own (now-cancelled) request. Confirmed here rather
  // than assumed: this is the real, intended shape of "requesters read their own transport
  // documents" (bucket policy has no status condition at all), not a residual gap.
  const ops = await as("ops");
  const customer = await as("customer");
  let requestId: string | undefined;
  let objectPath: string | undefined;

  await t.test("setup: a request with a document, then cancelled", async () => {
    requestId = await createTestTransportRequest(ops, {
      requesterProfileId: ids.customer,
      tag: "XR5-CANCEL",
      status: "draft",
    });
    objectPath = `${requestId}/doc-${Date.now()}.txt`;
    const upload = await customer.storage
      .from("transport-documents")
      .upload(objectPath, new Blob(["a real document"]), { contentType: "text/plain" });
    assert.equal(upload.error, null);

    const cancelled = await ops
      .from("transport_requests")
      .update({ status: "cancelled_by_customer" })
      .eq("id", requestId)
      .select("status")
      .single();
    assert.equal(cancelled.error, null);
    assert.equal(cancelled.data?.status, "cancelled_by_customer");
  });

  await t.test("the customer can still create a fresh signed URL after cancellation", async () => {
    const signed = await customer.storage
      .from("transport-documents")
      .createSignedUrl(objectPath!, 300);
    assert.equal(signed.error, null);
    assert.ok(signed.data?.signedUrl);
  });

  await t.test("cleanup", async () => {
    await ops.storage.from("transport-documents").remove([objectPath!]);
    await ops.from("transport_requests").delete().eq("id", requestId!);
  });
});

// "Removal" (leaving/being removed from a conversation) and "dispute" (no dispute-workflow
// concept exists anywhere in this schema) have no real, reachable mechanism to test -- confirmed,
// not assumed, by the same grep this session's own messaging-abuse-controls audit (Stage CJQ) already
// ran: zero "leave conversation"/"remove participant" call sites anywhere in src/, and zero
// "dispute" hits outside this sentence. "Transfer" (organisation ownership) doesn't gate any
// Storage bucket in this schema at all -- kennel-media access is owns_org()-scoped to the *current*
// owner_user_id read live on each signed-URL request, so an ownership transfer is really the same
// scenario as suspension (a live access-recheck at request time, with the same already-issued-URL
// residual risk) -- not a materially distinct case worth a third near-duplicate test.
