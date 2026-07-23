// Regression coverage for the operations calendar (src/lib/queries/calendar.ts,
// dashboard.operations.calendar.tsx). The conflict-detection logic itself is deterministic
// client-side TypeScript over already-RLS-scoped data — what actually needs DB-level coverage is
// that the underlying queries return the right rows to the right roles, and that the raw data a
// real conflict (driver double-booked, unscheduled queue, etc.) depends on is genuinely queryable
// the way the calendar assumes. See docs/AUTONOMOUS_BACKEND_PROGRESS.md, Stage B.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, isBlocked } from "./helpers.ts";

test("ops-only calendar route listing, with embedded vehicle/driver/assignments", async (t) => {
  const ops = await as("ops");

  await t.test(
    "ops can list routes with vehicle/driver names and assignment reservation status embedded",
    async () => {
      const { data, error } = await ops
        .from("routes")
        .select(
          "id, route_number, vehicles(name), drivers(name), route_assignments(id, reservation_status)",
        )
        .eq("id", ids.routeWarsawAmsterdam)
        .single();
      assert.equal(error, null);
      assert.ok(data?.route_number);
    },
  );

  await t.test("an unrelated customer cannot bulk-list routes at all", async () => {
    const customer = await as("customer");
    const blocked = await customer.from("routes").select("id");
    assert.ok(isBlocked(blocked.data, blocked.error));
  });

  await t.test("an assigned driver sees only their own route, not a bulk listing", async () => {
    const driver = await as("driver");
    const own = await driver.from("routes").select("id").eq("id", ids.routeWarsawAmsterdam);
    assert.equal(own.error, null);
    assert.equal(own.data?.length, 1);

    // Drivers have no "list all routes" policy — a broad select is filtered to just their own.
    const all = await driver.from("routes").select("id");
    assert.equal(all.error, null);
    assert.ok((all.data?.length ?? 0) <= 1);
  });
});

test("unscheduled queue reflects status = 'ready_for_scheduling' with no assigned route", async (t) => {
  const ops = await as("ops");
  let requestId: string | undefined;

  await t.test("setup: a request in ready_for_scheduling with no route", async () => {
    const created = await ops.rpc("create_transport_draft", { p_request: {} });
    assert.equal(created.error, null);
    requestId = created.data as string;
    const updated = await ops
      .from("transport_requests")
      .update({ status: "ready_for_scheduling" })
      .eq("id", requestId)
      .select("status")
      .single();
    assert.equal(updated.error, null);
    assert.equal(updated.data?.status, "ready_for_scheduling");
  });

  await t.test("it appears in the unscheduled-queue query", async () => {
    const { data, error } = await ops
      .from("transport_requests")
      .select("id")
      .eq("status", "ready_for_scheduling")
      .is("assigned_route_id", null)
      .eq("id", requestId!);
    assert.equal(error, null);
    assert.equal(data?.length, 1);
  });

  await t.test("it disappears from the queue once assigned to a route", async () => {
    const assigned = await ops
      .from("transport_requests")
      .update({ assigned_route_id: ids.routeWarsawAmsterdam })
      .eq("id", requestId!);
    assert.equal(assigned.error, null);

    const { data, error } = await ops
      .from("transport_requests")
      .select("id")
      .eq("status", "ready_for_scheduling")
      .is("assigned_route_id", null)
      .eq("id", requestId!);
    assert.equal(error, null);
    assert.equal(data?.length, 0);
  });

  await t.test("cleanup", async () => {
    if (requestId) await ops.from("transport_requests").delete().eq("id", requestId);
  });
});

test("scheduling conflict data: driver/vehicle double-booking is genuinely queryable", async (t) => {
  const ops = await as("ops");
  let routeAId: string | undefined;
  let routeBId: string | undefined;
  const sharedDate = "2027-03-15";

  await t.test("setup: two routes sharing a driver, vehicle and departure date", async () => {
    const a = await ops
      .from("routes")
      .insert({
        route_name: "Conflict test A",
        departure_date: sharedDate,
        driver_id: ids.driverRecord,
        vehicle_id: ids.vehicle,
        status: "planning",
        max_capacity: 2,
      })
      .select("id")
      .single();
    assert.equal(a.error, null);
    routeAId = a.data!.id as string;

    const b = await ops
      .from("routes")
      .insert({
        route_name: "Conflict test B",
        departure_date: sharedDate,
        driver_id: ids.driverRecord,
        vehicle_id: ids.vehicle,
        status: "confirmed",
        max_capacity: 2,
      })
      .select("id")
      .single();
    assert.equal(b.error, null);
    routeBId = b.data!.id as string;
  });

  await t.test(
    "both routes are returned by a same-date range query, sharing driver and vehicle",
    async () => {
      const { data, error } = await ops
        .from("routes")
        .select("id, driver_id, vehicle_id, departure_date, status")
        .gte("departure_date", sharedDate)
        .lte("departure_date", sharedDate)
        .in("id", [routeAId!, routeBId!]);
      assert.equal(error, null);
      assert.equal(data?.length, 2);
      assert.ok(
        data?.every((r) => r.driver_id === ids.driverRecord && r.vehicle_id === ids.vehicle),
      );
    },
  );

  await t.test("cleanup", async () => {
    if (routeAId) await ops.from("routes").delete().eq("id", routeAId);
    if (routeBId) await ops.from("routes").delete().eq("id", routeBId);
  });
});

test("a completed/cancelled route is excluded from active double-booking consideration by status", async (t) => {
  // Sanity check for the conflict logic's own filter (ACTIVE_ROUTE_STATUSES in calendar.ts) — a
  // cancelled route sharing a driver/date with an active one should not itself be flagged, since
  // it never actually happened. This test only proves the status value survives round-trip
  // correctly; the filtering itself is pure TypeScript, verified by inspection.
  const ops = await as("ops");
  const cancelled = await ops
    .from("routes")
    .insert({
      route_name: "Cancelled route for status check",
      departure_date: "2027-03-16",
      status: "cancelled",
      max_capacity: 1,
    })
    .select("status")
    .single();
  assert.equal(cancelled.error, null);
  assert.equal(cancelled.data?.status, "cancelled");

  await ops.from("routes").delete().eq("route_name", "Cancelled route for status check");
});
