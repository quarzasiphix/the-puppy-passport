// Stage AD (supplemental queue): transactional domain events.
// change_ops_request_status() (20260101009200_change_ops_request_status_rpc.sql) replaces
// changeOpsRequestStatus()'s old three separate client-side writes (update transport_requests,
// insert transport_status_history, insert audit_logs) with one atomic RPC, and closes a
// forgeable-actor gap the old version had (changed_by/actor_profile_id used to trust a
// client-supplied actorId field; now always auth.uid()).
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids } from "./helpers.ts";

test("change_ops_request_status: atomic status/history/audit write, server-stamped actor", async (t) => {
  const ops = await as("ops");
  const admin = await as("admin");

  await t.test(
    "ops staff can call it; status, history and audit rows all land together",
    async () => {
      const before = await ops
        .from("transport_requests")
        .select("status")
        .eq("id", ids.transportBerlin)
        .single();
      assert.equal(before.error, null);

      const call = await ops.rpc("change_ops_request_status", {
        p_request_id: ids.transportBerlin,
        p_new_status: "initial_review",
        p_customer_note: null,
        p_internal_note: "AD stage test note",
      });
      assert.equal(call.error, null);

      const after = await ops
        .from("transport_requests")
        .select("status")
        .eq("id", ids.transportBerlin)
        .single();
      assert.equal(after.error, null);
      assert.equal(after.data?.status, "initial_review");

      const history = await ops
        .from("transport_status_history")
        .select("status, changed_by, internal_note")
        .eq("transport_request_id", ids.transportBerlin)
        .eq("status", "initial_review")
        .order("changed_at", { ascending: false })
        .limit(1)
        .single();
      assert.equal(history.error, null);
      assert.equal(history.data?.changed_by, ids.ops, "changed_by must be the real caller, ops");
      assert.equal(history.data?.internal_note, "AD stage test note");

      const audit = await admin
        .from("audit_logs")
        .select("actor_profile_id, action, before, after")
        .eq("target_id", ids.transportBerlin)
        .eq("action", "transport_request.status_changed")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      assert.equal(audit.error, null);
      assert.equal(audit.data?.actor_profile_id, ids.ops, "audit actor must be the real caller");
      assert.deepEqual(audit.data?.before, { status: before.data?.status });
      assert.deepEqual(audit.data?.after, { status: "initial_review" });

      // Restore for other tests reusing this fixture request.
      await ops
        .from("transport_requests")
        .update({ status: before.data!.status })
        .eq("id", ids.transportBerlin);
    },
  );

  await t.test("a non-ops user cannot call it at all", async () => {
    const customer = await as("customer");
    const attempt = await customer.rpc("change_ops_request_status", {
      p_request_id: ids.transportBerlin,
      p_new_status: "completed",
      p_customer_note: null,
      p_internal_note: null,
    });
    assert.ok(attempt.error, "expected a non-ops caller to be rejected outright");

    // Confirm the status genuinely did not change.
    const unchanged = await ops
      .from("transport_requests")
      .select("status")
      .eq("id", ids.transportBerlin)
      .single();
    assert.equal(unchanged.error, null);
    assert.notEqual(unchanged.data?.status, "completed");
  });

  await t.test("an assigned driver cannot use this ops-only RPC either", async () => {
    const driver = await as("driver");
    const attempt = await driver.rpc("change_ops_request_status", {
      p_request_id: ids.transportWarsawAmsterdam,
      p_new_status: "completed",
      p_customer_note: null,
      p_internal_note: null,
    });
    assert.ok(
      attempt.error,
      "expected drivers to use their own direct-update path, not this ops-only RPC",
    );
  });

  await t.test("a nonexistent transport request id is rejected, not silently a no-op", async () => {
    const attempt = await ops.rpc("change_ops_request_status", {
      p_request_id: "00000000-0000-0000-0000-000000000000",
      p_new_status: "completed",
      p_customer_note: null,
      p_internal_note: null,
    });
    assert.ok(attempt.error, "expected an error for a request id that doesn't exist");
  });
});
