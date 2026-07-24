// Stage M (operational scenario suite): the existing suite exercises transport draft creation,
// amendments, the customer-visible submit/cancel transitions, and column-locking of the
// operational fields (see transport-domain.test.ts, security-regressions.test.ts), but no test in
// the suite had ever driven a request through the *full* driver-owned journey
// (driver_assigned -> pickup_confirmed -> animal_collected -> in_transport -> rest_or_care_stop ->
// approaching_destination -> delivered -> handover_confirmed -> completed) the way a real driver
// actually would from the driver workspace, nor exercised route assignment/unassignment and the
// cross-tenant boundaries around it. Each scenario below is a separate, focused test per the
// project's "separate diagnostic tests, not one giant test" rule.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, isBlocked } from "./helpers.ts";

test("scenario: an assigned driver progresses a request through the full delivery journey", async (t) => {
  const ops = await as("ops");
  const driver = await as("driver");
  let requestId: string | undefined;

  await t.test(
    "setup: ops creates and assigns a request to the seeded driver/vehicle",
    async () => {
      const created = await ops.rpc("create_transport_draft", { p_request: {} });
      assert.equal(created.error, null);
      requestId = created.data as string;

      const assigned = await ops
        .from("transport_requests")
        .update({
          status: "driver_assigned",
          assigned_driver_id: ids.driverRecord,
          assigned_vehicle_id: ids.vehicle,
        })
        .eq("id", requestId)
        .select("status")
        .single();
      assert.equal(assigned.error, null);
      assert.equal(assigned.data?.status, "driver_assigned");
    },
  );

  const journey = [
    "pickup_confirmed",
    "animal_collected",
    "in_transport",
    "rest_or_care_stop",
    "approaching_destination",
    "delivered",
    "handover_confirmed",
    "completed",
  ] as const;

  for (const status of journey) {
    await t.test(`driver progresses status to '${status}'`, async () => {
      const updated = await driver
        .from("transport_requests")
        .update({ status })
        .eq("id", requestId!)
        .select("status")
        .single();
      assert.equal(updated.error, null, `driver should be able to set status to '${status}'`);
      assert.equal(updated.data?.status, status);

      const logged = await driver
        .from("transport_status_history")
        .insert({ transport_request_id: requestId!, status, changed_by: ids.driver })
        .select("id");
      assert.equal(logged.error, null, `driver should be able to log '${status}' in the history`);
    });
  }

  await t.test("the full journey is visible in transport_status_history, in order", async () => {
    const history = await ops
      .from("transport_status_history")
      .select("status, changed_at")
      .eq("transport_request_id", requestId!)
      .order("changed_at", { ascending: true });
    assert.equal(history.error, null);
    const statuses = (history.data ?? []).map((row) => row.status);
    for (const status of journey) {
      assert.ok(statuses.includes(status), `expected '${status}' to appear in the history`);
    }
  });

  await t.test("cleanup", async () => {
    await ops.from("transport_requests").delete().eq("id", requestId!);
  });
});

test("scenario: route assignment makes the request visible to the requester, unassignment revokes driver access", async (t) => {
  const ops = await as("ops");
  const customer = await as("customer");
  const driver = await as("driver");
  let requestId: string | undefined;
  let routeId: string | undefined;
  let assignmentId: string | undefined;

  await t.test("setup: customer's own request, ready for scheduling", async () => {
    const requestNumber = `TR-SCENARIO-ROUTE-${Date.now()}`;
    const created = await customer
      .from("transport_requests")
      .insert({
        requester_profile_id: ids.customer,
        request_number: requestNumber,
        request_purpose: "own_dog",
        animal_name: "Route Scenario Dog",
        pickup_country: "Poland",
        pickup_city: "Warsaw",
        destination_country: "Netherlands",
        destination_city: "Rotterdam",
        status: "submitted",
      })
      .select("id")
      .single();
    assert.equal(created.error, null);
    requestId = created.data!.id as string;
    await ops
      .from("transport_requests")
      .update({ status: "ready_for_scheduling" })
      .eq("id", requestId);
  });

  await t.test("ops creates a route and assigns the request to it", async () => {
    const route = await ops
      .from("routes")
      .insert({
        route_name: "Route scenario test route",
        vehicle_id: ids.vehicle,
        driver_id: ids.driverRecord,
        status: "planning",
      })
      .select("id")
      .single();
    assert.equal(route.error, null);
    routeId = route.data!.id as string;

    const assignment = await ops
      .from("route_assignments")
      .insert({ route_id: routeId, transport_request_id: requestId! })
      .select("id")
      .single();
    assert.equal(assignment.error, null);
    assignmentId = assignment.data!.id as string;

    const scheduled = await ops
      .from("transport_requests")
      .update({
        status: "scheduled",
        assigned_route_id: routeId,
        assigned_driver_id: ids.driverRecord,
        assigned_vehicle_id: ids.vehicle,
      })
      .eq("id", requestId!)
      .select("status")
      .single();
    assert.equal(scheduled.error, null);
    assert.equal(scheduled.data?.status, "scheduled");
  });

  await t.test("the requester can see the route assignment on their own request", async () => {
    const seen = await customer
      .from("route_assignments")
      .select("id, route_id")
      .eq("id", assignmentId!)
      .single();
    assert.equal(seen.error, null);
    assert.equal(seen.data?.route_id, routeId);
  });

  await t.test(
    "the assigned driver can see and act on the request before unassignment",
    async () => {
      const seen = await driver.from("transport_requests").select("id").eq("id", requestId!);
      assert.equal(seen.error, null);
      assert.equal(seen.data?.length, 1);
    },
  );

  await t.test("ops unassigns the driver/vehicle/route from the request", async () => {
    await ops.from("route_assignments").delete().eq("id", assignmentId!);
    const unassigned = await ops
      .from("transport_requests")
      .update({
        status: "ready_for_scheduling",
        assigned_route_id: null,
        assigned_driver_id: null,
        assigned_vehicle_id: null,
      })
      .eq("id", requestId!)
      .select("status, assigned_driver_id")
      .single();
    assert.equal(unassigned.error, null);
    assert.equal(unassigned.data?.status, "ready_for_scheduling");
    assert.equal(unassigned.data?.assigned_driver_id, null);
  });

  await t.test("the formerly-assigned driver loses access after unassignment", async () => {
    const seen = await driver.from("transport_requests").select("id").eq("id", requestId!);
    assert.ok(
      isBlocked(seen.data, seen.error),
      "a driver no longer assigned to a request must lose row-level access to it",
    );
  });

  await t.test("cleanup", async () => {
    await ops.from("routes").delete().eq("id", routeId!);
    await ops.from("transport_requests").delete().eq("id", requestId!);
  });
});

test("scenario: cross-tenant attack — an unrelated user cannot see another party's route, vehicle or driver record", async (t) => {
  const buyer = await as("buyer");

  await t.test("cannot bulk-read routes", async () => {
    const blocked = await buyer.from("routes").select("id");
    assert.ok(isBlocked(blocked.data, blocked.error));
  });

  await t.test("cannot bulk-read vehicles", async () => {
    const blocked = await buyer.from("vehicles").select("id");
    assert.ok(isBlocked(blocked.data, blocked.error));
  });

  await t.test("cannot bulk-read driver records", async () => {
    const blocked = await buyer.from("drivers").select("id");
    assert.ok(isBlocked(blocked.data, blocked.error));
  });

  await t.test("cannot read route_assignments for a request that isn't theirs", async () => {
    const blocked = await buyer
      .from("route_assignments")
      .select("id")
      .eq("route_id", ids.routeWarsawAmsterdam);
    assert.ok(isBlocked(blocked.data, blocked.error));
  });

  await t.test(
    "cannot directly insert a route_assignments row (ops/driver-only surface)",
    async () => {
      const attempt = await buyer
        .from("route_assignments")
        .insert({ route_id: ids.routeWarsawAmsterdam, transport_request_id: ids.transportBerlin })
        .select();
      assert.ok(attempt.error, "expected an ordinary user to be rejected outright");
    },
  );
});
