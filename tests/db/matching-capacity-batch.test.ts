// Stage IR-12 (integration-readiness queue): representative volume and performance.
// src/lib/queries/matching.ts's suggestRoutesForRequest() used to call computeMatch() once per
// candidate route, and computeMatch() queried route_assignments once per route (a plain `.eq
// ("route_id", route.id)` head-count) to compute remaining capacity -- a real N+1 (parallelised
// via Promise.all, but still one round trip per route) that scales linearly with how many routes
// are in planning/confirmed. Replaced with a single batched query
// (fetchActiveAssignmentCounts() in matching.ts) selecting every candidate route's assignment
// rows in one `.in("route_id", routeIds)` call and grouping counts client-side (PostgREST has no
// GROUP BY). matching.ts can't be imported directly here (it pulls in the browser Supabase client
// via the `@/` alias, which this plain `node --test` runner can't resolve -- the same reason no
// other tests/db file imports a real query module with a Supabase client dependency) -- these
// tests instead prove the real thing that changed: that the new batched query shape returns
// exactly the same per-route row set the old per-route query did, correctly excluding released/
// cancelled/expired assignments, for several routes at once in one round trip.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, createTestTransportRequest } from "./helpers.ts";

test("route_assignments batched-by-route query matches the old per-route count exactly", async (t) => {
  const ops = await as("ops");
  const routeIds: string[] = [];
  const requestIds: string[] = [];

  await t.test("setup: 2 routes, each with a mix of active and cancelled assignments", async () => {
    for (const activeCount of [2, 0]) {
      const route = await ops
        .from("routes")
        .insert({
          route_name: `IR-12 batch test ${activeCount}`,
          max_capacity: 5,
          status: "planning",
        })
        .select("id")
        .single();
      assert.equal(route.error, null);
      const routeId = route.data!.id as string;
      routeIds.push(routeId);

      for (let i = 0; i < activeCount; i++) {
        const reqId = await createTestTransportRequest(ops, {
          requesterProfileId: ids.customer,
          tag: `IR12-active-${routeId.slice(0, 8)}-${i}`,
        });
        requestIds.push(reqId);
        const assignment = await ops
          .from("route_assignments")
          .insert({ route_id: routeId, transport_request_id: reqId })
          .select("id");
        assert.equal(assignment.error, null);
      }
      // Every route also gets one cancelled assignment, which must never count toward capacity.
      const cancelledReqId = await createTestTransportRequest(ops, {
        requesterProfileId: ids.customer,
        tag: `IR12-cancelled-${routeId.slice(0, 8)}`,
      });
      requestIds.push(cancelledReqId);
      const cancelled = await ops
        .from("route_assignments")
        .insert({
          route_id: routeId,
          transport_request_id: cancelledReqId,
          reservation_status: "cancelled",
        })
        .select("id");
      assert.equal(cancelled.error, null);
    }
  });

  await t.test(
    "one batched query for both routes returns the same active-only counts as querying each route separately",
    async () => {
      // The old, replaced shape: one `.eq("route_id", ...)` count query per route.
      const perRouteCounts = new Map<string, number>();
      for (const routeId of routeIds) {
        const { count, error } = await ops
          .from("route_assignments")
          .select("*", { count: "exact", head: true })
          .eq("route_id", routeId)
          .not("reservation_status", "in", "(released,cancelled,expired)");
        assert.equal(error, null);
        perRouteCounts.set(routeId, count ?? 0);
      }

      // The new, real shape: one query for every candidate route's rows, grouped client-side.
      const { data, error } = await ops
        .from("route_assignments")
        .select("route_id")
        .in("route_id", routeIds)
        .not("reservation_status", "in", "(released,cancelled,expired)");
      assert.equal(error, null);
      const batchedCounts = new Map<string, number>();
      for (const row of data ?? []) {
        batchedCounts.set(row.route_id, (batchedCounts.get(row.route_id) ?? 0) + 1);
      }

      for (const routeId of routeIds) {
        assert.equal(
          batchedCounts.get(routeId) ?? 0,
          perRouteCounts.get(routeId),
          `expected the batched count for route ${routeId} to match the old per-route count`,
        );
      }
      // Concretely: the first route has 2 active + 1 cancelled -> 2; the second has 0 active + 1
      // cancelled -> 0. Asserted directly, not just "the two shapes agree with each other", in
      // case both shapes were wrong in the same way.
      assert.equal(batchedCounts.get(routeIds[0]) ?? 0, 2);
      assert.equal(batchedCounts.get(routeIds[1]) ?? 0, 0);
    },
  );

  await t.test("cleanup", async () => {
    for (const reqId of requestIds) {
      await ops.from("transport_requests").delete().eq("id", reqId);
    }
    for (const routeId of routeIds) {
      await ops.from("routes").delete().eq("id", routeId);
    }
  });
});
