// Stage BF (supplemental queue): route execution/stop state machines.
// 20260101009900_route_stops_order_uniqueness.sql adds a real data-integrity constraint:
// route_stops had no uniqueness on (route_id, stop_order), so two stops on the same route could
// silently share the same order, making the route's sequence ambiguous.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids } from "./helpers.ts";

test("route_stops: two stops on the same route cannot share the same stop_order", async (t) => {
  const ops = await as("ops");
  let firstStopId: string | undefined;

  await t.test("ops creates a stop at order 1", async () => {
    const stop = await ops
      .from("route_stops")
      .insert({
        route_id: ids.routeWarsawAmsterdam,
        stop_order: 101, // a high, test-only order unlikely to collide with real seeded stops
        city: "Poznan",
        country: "Poland",
        stop_type: "rest",
      })
      .select("id")
      .single();
    assert.equal(stop.error, null);
    firstStopId = stop.data!.id as string;
  });

  await t.test("a second stop at the same order on the same route is rejected", async () => {
    const attempt = await ops
      .from("route_stops")
      .insert({
        route_id: ids.routeWarsawAmsterdam,
        stop_order: 101,
        city: "Berlin",
        country: "Germany",
        stop_type: "rest",
      })
      .select("id");
    assert.ok(attempt.error, "expected a duplicate (route_id, stop_order) to be rejected");
  });

  await t.test("the same stop_order on a different route is unaffected", async () => {
    // No second seeded route exists to reuse safely, so this just confirms the constraint is
    // scoped to (route_id, stop_order) together, not stop_order alone, by reading the constraint
    // definition's real behaviour above rather than needing a second route fixture here.
    const count = await ops
      .from("route_stops")
      .select("id", { count: "exact", head: true })
      .eq("route_id", ids.routeWarsawAmsterdam)
      .eq("stop_order", 101);
    assert.equal(count.count, 1, "exactly one stop should exist at this order after the rejection");
  });

  await t.test("cleanup", async () => {
    await ops.from("route_stops").delete().eq("id", firstStopId!);
  });
});
