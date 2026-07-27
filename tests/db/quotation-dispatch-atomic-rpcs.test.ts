// Follow-up to Stage XR-7 (docs/TRANSACTIONAL_WORKFLOW_BOUNDARIES_AUDIT.md):
// respond_to_quotation(), send_quotation(), assign_driver_to_job()
// (20260101013400_quotation_dispatch_atomic_rpcs.sql) replace 3 of the 6 documented multi-write,
// forgeable-actor client-side call sequences with single atomic, server-actor-stamped RPCs. These
// tests prove both halves: the operation still behaves correctly, and changed_by is always the
// real caller, never trusted client input (the old client code passed a plain actorId/userId
// argument that this RPC no longer accepts at all).
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, createTestTransportRequest } from "./helpers.ts";

async function createTestQuotation(
  requestId: string,
  overrides: { status?: string; expiryDate?: string | null } = {},
): Promise<string> {
  const admin = await as("admin");
  const created = await admin
    .from("quotations")
    .insert({
      transport_request_id: requestId,
      service_type: "individual",
      total_price: 500,
      currency: "EUR",
      expiry_date: overrides.expiryDate ?? null,
      status: overrides.status ?? "sent",
    })
    .select("id")
    .single();
  assert.equal(created.error, null);
  return created.data!.id as string;
}

test("respond_to_quotation: accepting updates the request and logs real history", async (t) => {
  const admin = await as("admin");
  let requestId: string | undefined;
  let quotationId: string | undefined;

  await t.test("setup: a sent quotation on the customer's own request", async () => {
    requestId = await createTestTransportRequest(admin, {
      requesterProfileId: ids.customer,
      tag: "RPC-QUOTE-ACCEPT",
      status: "quotation_sent",
    });
    quotationId = await createTestQuotation(requestId);
  });

  await t.test("someone else cannot respond to this customer's quotation", async () => {
    const buyer = await as("buyer");
    const attempt = await buyer.rpc("respond_to_quotation", {
      p_quotation_id: quotationId!,
      p_response: "accepted",
    });
    assert.ok(attempt.error, "expected only the requester to be able to respond");
  });

  await t.test("the requester accepts it", async () => {
    const customer = await as("customer");
    const call = await customer.rpc("respond_to_quotation", {
      p_quotation_id: quotationId!,
      p_response: "accepted",
    });
    assert.equal(call.error, null);

    const quotation = await admin
      .from("quotations")
      .select("status")
      .eq("id", quotationId!)
      .single();
    assert.equal(quotation.data?.status, "accepted");

    const request = await admin
      .from("transport_requests")
      .select("status")
      .eq("id", requestId!)
      .single();
    assert.equal(request.data?.status, "accepted_by_customer");

    const history = await admin
      .from("transport_status_history")
      .select("status, changed_by")
      .eq("transport_request_id", requestId!)
      .eq("status", "accepted_by_customer")
      .single();
    assert.equal(history.error, null);
    assert.equal(
      history.data?.changed_by,
      ids.customer,
      "changed_by must always be the real caller, never trusted client input",
    );
  });

  await t.test("a retry with the same response is idempotent, no duplicate history", async () => {
    const customer = await as("customer");
    const retry = await customer.rpc("respond_to_quotation", {
      p_quotation_id: quotationId!,
      p_response: "accepted",
    });
    assert.equal(retry.error, null, "a same-response retry must succeed quietly, not error");

    const historyRows = await admin
      .from("transport_status_history")
      .select("id")
      .eq("transport_request_id", requestId!)
      .eq("status", "accepted_by_customer");
    assert.equal(historyRows.data?.length, 1, "the retry must not insert a second history row");
  });

  await t.test("cleanup", async () => {
    await admin.from("quotations").delete().eq("id", quotationId!);
    await admin.from("transport_status_history").delete().eq("transport_request_id", requestId!);
    await admin.from("transport_requests").delete().eq("id", requestId!);
  });
});

test("respond_to_quotation: rejecting only updates the quotation, nothing else", async (t) => {
  const admin = await as("admin");
  let requestId: string | undefined;
  let quotationId: string | undefined;

  await t.test("setup", async () => {
    requestId = await createTestTransportRequest(admin, {
      requesterProfileId: ids.customer,
      tag: "RPC-QUOTE-REJECT",
      status: "quotation_sent",
    });
    quotationId = await createTestQuotation(requestId);
  });

  await t.test("the requester rejects it", async () => {
    const customer = await as("customer");
    const call = await customer.rpc("respond_to_quotation", {
      p_quotation_id: quotationId!,
      p_response: "rejected",
    });
    assert.equal(call.error, null);

    const quotation = await admin
      .from("quotations")
      .select("status")
      .eq("id", quotationId!)
      .single();
    assert.equal(quotation.data?.status, "rejected");

    const request = await admin
      .from("transport_requests")
      .select("status")
      .eq("id", requestId!)
      .single();
    assert.equal(
      request.data?.status,
      "quotation_sent",
      "rejecting a quotation must never advance the request's own status",
    );
  });

  await t.test("an invalid response value is rejected outright", async () => {
    const customer = await as("customer");
    const attempt = await customer.rpc("respond_to_quotation", {
      p_quotation_id: quotationId!,
      p_response: "viewed",
    });
    assert.ok(attempt.error, "expected a non accepted/rejected response to be rejected");
  });

  await t.test("cleanup", async () => {
    await admin.from("quotations").delete().eq("id", quotationId!);
    await admin.from("transport_requests").delete().eq("id", requestId!);
  });
});

test("respond_to_quotation: an already-expired quotation cannot be accepted", async (t) => {
  const admin = await as("admin");
  let requestId: string | undefined;
  let quotationId: string | undefined;

  await t.test("setup: an already-expired quotation", async () => {
    requestId = await createTestTransportRequest(admin, {
      requesterProfileId: ids.customer,
      tag: "RPC-QUOTE-EXPIRED",
      status: "quotation_sent",
    });
    quotationId = await createTestQuotation(requestId, { expiryDate: "2020-01-01" });
  });

  await t.test("accepting is rejected", async () => {
    const customer = await as("customer");
    const attempt = await customer.rpc("respond_to_quotation", {
      p_quotation_id: quotationId!,
      p_response: "accepted",
    });
    assert.ok(attempt.error, "expected an expired quotation to reject an accept response");

    const quotation = await admin
      .from("quotations")
      .select("status")
      .eq("id", quotationId!)
      .single();
    assert.equal(quotation.data?.status, "sent", "status must be unchanged");
  });

  await t.test("rejecting an expired quotation still works", async () => {
    const customer = await as("customer");
    const call = await customer.rpc("respond_to_quotation", {
      p_quotation_id: quotationId!,
      p_response: "rejected",
    });
    assert.equal(call.error, null);
  });

  await t.test("cleanup", async () => {
    await admin.from("quotations").delete().eq("id", quotationId!);
    await admin.from("transport_requests").delete().eq("id", requestId!);
  });
});

test("send_quotation: ops-only, atomic, idempotent on retry", async (t) => {
  const admin = await as("admin");
  const ops = await as("ops");
  let requestId: string | undefined;
  let quotationId: string | undefined;

  await t.test("setup: a draft quotation", async () => {
    requestId = await createTestTransportRequest(admin, {
      requesterProfileId: ids.customer,
      tag: "RPC-SEND-QUOTE",
    });
    quotationId = await createTestQuotation(requestId, { status: "draft" });
  });

  await t.test("a non-ops user cannot send it", async () => {
    const customer = await as("customer");
    const attempt = await customer.rpc("send_quotation", { p_quotation_id: quotationId! });
    assert.ok(attempt.error, "expected only ops staff to be able to send a quotation");
  });

  await t.test("ops sends it: quotation and request status update, history logged", async () => {
    const call = await ops.rpc("send_quotation", { p_quotation_id: quotationId! });
    assert.equal(call.error, null);

    const quotation = await admin
      .from("quotations")
      .select("status")
      .eq("id", quotationId!)
      .single();
    assert.equal(quotation.data?.status, "sent");

    const request = await admin
      .from("transport_requests")
      .select("status")
      .eq("id", requestId!)
      .single();
    assert.equal(request.data?.status, "quotation_sent");

    const history = await admin
      .from("transport_status_history")
      .select("changed_by")
      .eq("transport_request_id", requestId!)
      .eq("status", "quotation_sent")
      .single();
    assert.equal(history.error, null);
    assert.equal(history.data?.changed_by, ids.ops);

    // Stage YR-7 (admin command catalogue): every ops-privileged RPC should leave a real
    // audit_logs entry, matching its sibling ops RPCs -- send_quotation() previously didn't.
    const audit = await admin
      .from("audit_logs")
      .select("actor_profile_id, action")
      .eq("target_id", quotationId!)
      .eq("action", "quotation.sent")
      .single();
    assert.equal(audit.error, null);
    assert.equal(audit.data?.actor_profile_id, ids.ops);
  });

  await t.test("a retry is idempotent, no duplicate history or audit entry", async () => {
    const retry = await ops.rpc("send_quotation", { p_quotation_id: quotationId! });
    assert.equal(retry.error, null);

    const historyRows = await admin
      .from("transport_status_history")
      .select("id")
      .eq("transport_request_id", requestId!)
      .eq("status", "quotation_sent");
    assert.equal(historyRows.data?.length, 1);

    const auditRows = await admin
      .from("audit_logs")
      .select("id")
      .eq("target_id", quotationId!)
      .eq("action", "quotation.sent");
    assert.equal(
      auditRows.data?.length,
      1,
      "the idempotent retry must not duplicate the audit entry",
    );
  });

  await t.test("cleanup", async () => {
    await admin.from("quotations").delete().eq("id", quotationId!);
    await admin.from("transport_status_history").delete().eq("transport_request_id", requestId!);
    await admin.from("transport_requests").delete().eq("id", requestId!);
  });
});

test("assign_driver_to_job: ops-only, atomic, idempotent on retry, rejects a bogus driver", async (t) => {
  const admin = await as("admin");
  const ops = await as("ops");
  let requestId: string | undefined;

  await t.test("setup: a request ready for a driver", async () => {
    requestId = await createTestTransportRequest(admin, {
      requesterProfileId: ids.customer,
      tag: "RPC-ASSIGN-DRIVER",
      status: "ready_for_scheduling",
    });
  });

  await t.test("a non-ops user cannot assign a driver", async () => {
    const customer = await as("customer");
    const attempt = await customer.rpc("assign_driver_to_job", {
      p_transport_request_id: requestId!,
      p_driver_id: ids.driverRecord,
    });
    assert.ok(attempt.error, "expected only ops staff to be able to assign a driver");
  });

  await t.test("a nonexistent driver id is rejected", async () => {
    const attempt = await ops.rpc("assign_driver_to_job", {
      p_transport_request_id: requestId!,
      p_driver_id: "00000000-0000-0000-0000-000000000000",
    });
    assert.ok(attempt.error, "expected a nonexistent driver to be rejected");
  });

  await t.test("ops assigns the real driver: request and history update", async () => {
    const call = await ops.rpc("assign_driver_to_job", {
      p_transport_request_id: requestId!,
      p_driver_id: ids.driverRecord,
    });
    assert.equal(call.error, null);

    const request = await admin
      .from("transport_requests")
      .select("status, assigned_driver_id")
      .eq("id", requestId!)
      .single();
    assert.equal(request.data?.status, "driver_assigned");
    assert.equal(request.data?.assigned_driver_id, ids.driverRecord);

    const history = await admin
      .from("transport_status_history")
      .select("changed_by")
      .eq("transport_request_id", requestId!)
      .eq("status", "driver_assigned")
      .single();
    assert.equal(history.error, null);
    assert.equal(history.data?.changed_by, ids.ops);

    // Stage YR-7 (admin command catalogue): assign_driver_to_job() previously left no audit_logs
    // trail at all, unlike its sibling ops-privileged RPCs.
    const audit = await admin
      .from("audit_logs")
      .select("actor_profile_id, action")
      .eq("target_id", requestId!)
      .eq("action", "transport_request.driver_assigned")
      .single();
    assert.equal(audit.error, null);
    assert.equal(audit.data?.actor_profile_id, ids.ops);
  });

  await t.test(
    "a retry with the same driver is idempotent, no duplicate history or audit entry",
    async () => {
      const retry = await ops.rpc("assign_driver_to_job", {
        p_transport_request_id: requestId!,
        p_driver_id: ids.driverRecord,
      });
      assert.equal(retry.error, null);

      const auditRows = await admin
        .from("audit_logs")
        .select("id")
        .eq("target_id", requestId!)
        .eq("action", "transport_request.driver_assigned");
      assert.equal(
        auditRows.data?.length,
        1,
        "the idempotent retry must not duplicate the audit entry",
      );

      const historyRows = await admin
        .from("transport_status_history")
        .select("id")
        .eq("transport_request_id", requestId!)
        .eq("status", "driver_assigned");
      assert.equal(historyRows.data?.length, 1);
    },
  );

  await t.test("cleanup", async () => {
    await admin.from("transport_status_history").delete().eq("transport_request_id", requestId!);
    await admin.from("transport_requests").delete().eq("id", requestId!);
  });
});
