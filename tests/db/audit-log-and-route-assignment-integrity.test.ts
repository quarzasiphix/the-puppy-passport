// Stage AE (supplemental queue): audit-log quality.
// 20260101009300_audit_logs_actor_lock_and_route_assignment_rpc.sql closed two real gaps:
// (1) "ops staff and admins write audit logs" checked is_ops_staff() but never restricted
// actor_profile_id, so any ops/admin account could credit a *different* profile as an audit
// entry's actor. (2) assignRequestToRoute() did two separate, non-atomic client-side writes with
// the second one's error unchecked, and trusted a client-supplied assigned_by. Both are now one
// atomic assign_request_to_route() RPC with a server-stamped actor.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, isBlocked } from "./helpers.ts";

test("audit_logs: an ops account cannot forge a different actor", async (t) => {
  const ops = await as("ops");
  const admin = await as("admin");

  await t.test("ops can insert an audit_logs row crediting themselves", async () => {
    const own = await ops
      .from("audit_logs")
      .insert({
        actor_profile_id: ids.ops,
        action: "test.self_attributed",
        target_type: "transport_requests",
        target_id: ids.transportBerlin,
      })
      .select("id");
    assert.equal(own.error, null);
  });

  await t.test("ops cannot insert an audit_logs row crediting a different profile", async () => {
    const forged = await ops
      .from("audit_logs")
      .insert({
        actor_profile_id: ids.admin,
        action: "test.forged_actor",
        target_type: "transport_requests",
        target_id: ids.transportBerlin,
      })
      .select("id");
    assert.ok(
      isBlocked(forged.data, forged.error),
      "expected the RLS WITH CHECK to reject a mismatched actor_profile_id",
    );
  });

  await t.test("cleanup", async () => {
    await admin.from("audit_logs").delete().eq("action", "test.self_attributed");
  });
});

test("assign_request_to_route: atomic write, server-stamped actor, ops-only", async (t) => {
  const ops = await as("ops");
  const admin = await as("admin");
  let requestId: string | undefined;
  let routeId: string | undefined;
  let assignmentId: string | undefined;

  await t.test("setup: a fresh request and a fresh route", async () => {
    const created = await ops.rpc("create_transport_draft", { p_request: {} });
    assert.equal(created.error, null);
    requestId = created.data as string;

    const route = await ops
      .from("routes")
      .insert({ route_name: "AE stage test route", status: "planning" })
      .select("id")
      .single();
    assert.equal(route.error, null);
    routeId = route.data!.id as string;
  });

  await t.test(
    "ops assigns the request to the route; both writes land together with the real actor",
    async () => {
      const call = await ops.rpc("assign_request_to_route", {
        p_route_id: routeId!,
        p_transport_request_id: requestId!,
        p_compatibility_notes: "AE stage test",
      });
      assert.equal(call.error, null);
      assignmentId = call.data as string;

      const assignment = await ops
        .from("route_assignments")
        .select("id, assigned_by, compatibility_notes")
        .eq("id", assignmentId)
        .single();
      assert.equal(assignment.error, null);
      assert.equal(assignment.data?.assigned_by, ids.ops, "assigned_by must be the real caller");

      const request = await ops
        .from("transport_requests")
        .select("assigned_route_id")
        .eq("id", requestId!)
        .single();
      assert.equal(request.error, null);
      assert.equal(
        request.data?.assigned_route_id,
        routeId,
        "transport_requests.assigned_route_id must reflect the same assignment, atomically",
      );

      // Stage YR-7 (admin command catalogue): assign_request_to_route() previously left no
      // audit_logs trail, unlike its sibling ops-privileged RPCs.
      const audit = await admin
        .from("audit_logs")
        .select("actor_profile_id, action")
        .eq("target_id", requestId!)
        .eq("action", "transport_request.route_assigned")
        .single();
      assert.equal(audit.error, null);
      assert.equal(audit.data?.actor_profile_id, ids.ops);
    },
  );

  await t.test("a non-ops user cannot call it", async () => {
    const customer = await as("customer");
    const attempt = await customer.rpc("assign_request_to_route", {
      p_route_id: routeId!,
      p_transport_request_id: requestId!,
      p_compatibility_notes: null,
    });
    assert.ok(attempt.error, "expected a non-ops caller to be rejected outright");
  });

  await t.test("a nonexistent route id is rejected, not silently a no-op", async () => {
    const attempt = await ops.rpc("assign_request_to_route", {
      p_route_id: "00000000-0000-0000-0000-000000000000",
      p_transport_request_id: requestId!,
      p_compatibility_notes: null,
    });
    assert.ok(attempt.error);
  });

  await t.test("cleanup", async () => {
    await admin.from("route_assignments").delete().eq("id", assignmentId!);
    await admin.from("routes").delete().eq("id", routeId!);
    await admin.from("transport_requests").delete().eq("id", requestId!);
  });
});
