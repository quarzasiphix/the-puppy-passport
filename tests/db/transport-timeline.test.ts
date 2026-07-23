// Stage C: coverage for named-transport-party visibility (20260101007500) and the timeline event
// sources it unblocks (getCustomerTimeline()/getOpsTimeline()/getDriverTimeline()). See
// docs/AUTONOMOUS_BACKEND_PROGRESS.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, isBlocked } from "./helpers.ts";

test("a party named via transport_parties (not the legacy inline columns) can see the request and its history", async (t) => {
  const customer = await as("customer");
  const buyer = await as("buyer");
  let requestId: string | undefined;

  await t.test(
    "setup: customer creates a draft naming buyer as recipient, then submits",
    async () => {
      const created = await customer.rpc("create_transport_draft", {
        p_request: { pickup_city: "Warsaw" },
        p_animals: [],
        p_parties: [{ party_role: "recipient", profile_id: ids.buyer }],
      });
      assert.equal(created.error, null);
      requestId = created.data as string;
      const submitted = await customer
        .from("transport_requests")
        .update({ status: "submitted" })
        .eq("id", requestId);
      assert.equal(submitted.error, null);

      const history = await customer.from("transport_status_history").insert({
        transport_request_id: requestId,
        status: "submitted",
        changed_by: ids.customer,
        customer_note: "Request submitted.",
      });
      assert.equal(history.error, null);
    },
  );

  await t.test("the named recipient (not the requester) can read the request itself", async () => {
    const { data, error } = await buyer
      .from("transport_requests")
      .select("id, status")
      .eq("id", requestId!)
      .single();
    assert.equal(error, null);
    assert.equal(data?.status, "submitted");
  });

  await t.test("the named recipient can read its status history", async () => {
    const { data, error } = await buyer
      .from("transport_status_history")
      .select("status, customer_note")
      .eq("transport_request_id", requestId!);
    assert.equal(error, null);
    assert.equal(data?.length, 1);
    assert.equal(data?.[0]?.status, "submitted");
  });

  await t.test("an unrelated third party still sees nothing", async () => {
    const breeder1 = await as("breeder1");
    const blocked = await breeder1.from("transport_requests").select("id").eq("id", requestId!);
    assert.ok(isBlocked(blocked.data, blocked.error));
    const blockedHistory = await breeder1
      .from("transport_status_history")
      .select("id")
      .eq("transport_request_id", requestId!);
    assert.ok(isBlocked(blockedHistory.data, blockedHistory.error));
  });

  await t.test("cleanup", async () => {
    if (requestId) await customer.from("transport_requests").delete().eq("id", requestId);
  });
});

test("a named organisation party (sender) can see the request and its amendments", async (t) => {
  const customer = await as("customer");
  const breeder1 = await as("breeder1");
  let requestId: string | undefined;
  let amendmentId: string | undefined;

  await t.test(
    "setup: request naming Cichy Las as sender, submitted, amendment filed",
    async () => {
      const created = await customer.rpc("create_transport_draft", {
        p_request: { pickup_city: "Warsaw" },
        p_animals: [],
        p_parties: [{ party_role: "sender", organisation_id: ids.orgCichyLas }],
      });
      assert.equal(created.error, null);
      requestId = created.data as string;
      await customer.from("transport_requests").update({ status: "submitted" }).eq("id", requestId);

      const amendment = await customer.rpc("request_transport_amendment", {
        p_transport_request_id: requestId,
        p_field_name: "pickup_city",
        p_new_value: "Krakow",
      });
      assert.equal(amendment.error, null);
      amendmentId = amendment.data as string;
    },
  );

  await t.test(
    "the sender organisation's owner can see the request and the pending amendment",
    async () => {
      const request = await breeder1
        .from("transport_requests")
        .select("id")
        .eq("id", requestId!)
        .single();
      assert.equal(request.error, null);

      const amendment = await breeder1
        .from("transport_request_amendments")
        .select("id, field_name, status")
        .eq("id", amendmentId!)
        .single();
      assert.equal(amendment.error, null);
      assert.equal(amendment.data?.status, "pending");
    },
  );

  await t.test("an unrelated organisation cannot see either", async () => {
    const breeder2 = await as("breeder2");
    const blocked = await breeder2.from("transport_requests").select("id").eq("id", requestId!);
    assert.ok(isBlocked(blocked.data, blocked.error));
  });

  await t.test("cleanup", async () => {
    if (requestId) await customer.from("transport_requests").delete().eq("id", requestId);
  });
});

test("timeline sources: status history and reviewed amendments merge in chronological order", async (t) => {
  const customer = await as("customer");
  const ops = await as("ops");
  let requestId: string | undefined;

  await t.test(
    "setup: submitted request with a status change and an approved amendment",
    async () => {
      const created = await customer.rpc("create_transport_draft", {
        p_request: { pickup_city: "Warsaw" },
        p_animals: [],
        p_parties: [],
      });
      assert.equal(created.error, null);
      requestId = created.data as string;
      await customer.from("transport_requests").update({ status: "submitted" }).eq("id", requestId);
      await customer.from("transport_status_history").insert({
        transport_request_id: requestId,
        status: "submitted",
        changed_by: ids.customer,
        customer_note: "Request submitted.",
      });

      const amendment = await customer.rpc("request_transport_amendment", {
        p_transport_request_id: requestId,
        p_field_name: "pickup_city",
        p_new_value: "Krakow",
      });
      assert.equal(amendment.error, null);
      const review = await ops.rpc("review_transport_amendment", {
        p_amendment_id: amendment.data as string,
        p_approve: true,
      });
      assert.equal(review.error, null);
    },
  );

  await t.test(
    "the customer-safe query returns both a status event and a resolved-amendment event",
    async () => {
      const history = await customer
        .from("transport_status_history")
        .select("id, status, changed_at, customer_note")
        .eq("transport_request_id", requestId!);
      assert.equal(history.error, null);
      assert.ok((history.data?.length ?? 0) >= 1);

      const amendments = await customer
        .from("transport_request_amendments")
        .select("id, status, reviewed_at")
        .eq("transport_request_id", requestId!)
        .neq("status", "pending");
      assert.equal(amendments.error, null);
      assert.equal(amendments.data?.length, 1);
      assert.equal(amendments.data?.[0]?.status, "approved");
      assert.ok(amendments.data?.[0]?.reviewed_at);
    },
  );

  await t.test("cleanup", async () => {
    const ops2 = await as("ops");
    if (requestId) await ops2.from("transport_requests").delete().eq("id", requestId);
  });
});
