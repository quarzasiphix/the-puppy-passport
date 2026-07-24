// Stage CC (supplemental queue): state-machine/chaos tests
// (20260101011100_driver_status_state_machine.sql). The full happy-path journey is already
// covered by tests/db/transport-lifecycle-scenarios.test.ts (driver_assigned all the way through
// completed, including the rest_or_care_stop detour) -- this file covers what that one doesn't:
// every illegal jump is rejected, a driver can't reassign route/vehicle/driver/compliance fields,
// and a "chaos" pass firing many invalid jump attempts concurrently from the same state never lets
// one sneak through regardless of ordering.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, createTestTransportRequest } from "./helpers.ts";

async function setupAssignedJob(admin: Awaited<ReturnType<typeof as>>) {
  const requestId = await createTestTransportRequest(admin, {
    requesterProfileId: ids.customer,
    tag: "CHAOS",
    status: "driver_assigned",
    assigned_driver_id: ids.driverRecord,
    assigned_vehicle_id: ids.vehicle,
  });
  return requestId;
}

test("driver status state machine: illegal jumps are rejected", async (t) => {
  const admin = await as("admin");
  const driver = await as("driver");

  await t.test("cannot skip straight from driver_assigned to completed", async () => {
    const requestId = await setupAssignedJob(admin);
    const attempt = await driver
      .from("transport_requests")
      .update({ status: "completed" })
      .eq("id", requestId)
      .select();
    assert.equal(attempt.data?.length ?? 0, 0, "an illegal jump must be rejected");

    const current = await admin
      .from("transport_requests")
      .select("status")
      .eq("id", requestId)
      .single();
    assert.equal(current.data?.status, "driver_assigned", "status must be unchanged");

    await admin.from("transport_requests").delete().eq("id", requestId);
  });

  await t.test("cannot move backwards after a legal forward step", async () => {
    const requestId = await setupAssignedJob(admin);
    const forward = await driver
      .from("transport_requests")
      .update({ status: "pickup_confirmed" })
      .eq("id", requestId)
      .select("status")
      .single();
    assert.equal(forward.error, null);
    assert.equal(forward.data?.status, "pickup_confirmed");

    const backward = await driver
      .from("transport_requests")
      .update({ status: "driver_assigned" })
      .eq("id", requestId)
      .select();
    assert.equal(backward.data?.length ?? 0, 0, "moving backwards must be rejected");

    await admin.from("transport_requests").delete().eq("id", requestId);
  });

  await t.test("cannot self-assign an ops-only hold state", async () => {
    const requestId = await setupAssignedJob(admin);
    const attempt = await driver
      .from("transport_requests")
      .update({ status: "veterinary_hold" })
      .eq("id", requestId)
      .select();
    assert.equal(
      attempt.data?.length ?? 0,
      0,
      "no real code path sets this from the driver side yet",
    );

    await admin.from("transport_requests").delete().eq("id", requestId);
  });

  await t.test(
    "a driver cannot reassign route/vehicle/driver/compliance/visibility fields",
    async () => {
      const requestId = await setupAssignedJob(admin);

      const reassignRoute = await driver
        .from("transport_requests")
        .update({ assigned_route_id: ids.routeWarsawAmsterdam })
        .eq("id", requestId)
        .select();
      assert.equal(reassignRoute.data?.length ?? 0, 0);

      const reassignDriver = await driver
        .from("transport_requests")
        .update({ assigned_driver_id: null })
        .eq("id", requestId)
        .select();
      assert.equal(reassignDriver.data?.length ?? 0, 0);

      const changeCompliance = await driver
        .from("transport_requests")
        .update({ compliance_review_result: "eligible_for_quotation" })
        .eq("id", requestId)
        .select();
      assert.equal(changeCompliance.data?.length ?? 0, 0);

      const changeVisibility = await driver
        .from("transport_requests")
        .update({ visibility: "community_visible" })
        .eq("id", requestId)
        .select();
      assert.equal(changeVisibility.data?.length ?? 0, 0);

      await admin.from("transport_requests").delete().eq("id", requestId);
    },
  );

  await t.test(
    "the optional rest_or_care_stop detour is legal, from and back to either side",
    async () => {
      const requestId = await setupAssignedJob(admin);
      for (const status of ["pickup_confirmed", "animal_collected", "in_transport"]) {
        const step = await driver
          .from("transport_requests")
          .update({ status })
          .eq("id", requestId)
          .select();
        assert.equal(step.error, null, `expected ${status} to succeed`);
      }
      const toRest = await driver
        .from("transport_requests")
        .update({ status: "rest_or_care_stop" })
        .eq("id", requestId)
        .select("status")
        .single();
      assert.equal(toRest.error, null);
      assert.equal(toRest.data?.status, "rest_or_care_stop");

      const resumeToApproaching = await driver
        .from("transport_requests")
        .update({ status: "approaching_destination" })
        .eq("id", requestId)
        .select("status")
        .single();
      assert.equal(resumeToApproaching.error, null);
      assert.equal(resumeToApproaching.data?.status, "approaching_destination");

      await admin.from("transport_requests").delete().eq("id", requestId);
    },
  );
});

test("driver status state machine: chaos — many concurrent invalid jumps from the same state never succeed", async (t) => {
  const admin = await as("admin");
  const driver = await as("driver");

  await t.test(
    "a burst of illegal concurrent transitions from driver_assigned all fail, state unchanged",
    async () => {
      const requestId = await setupAssignedJob(admin);

      const illegalTargets = [
        "completed",
        "handover_confirmed",
        "delivered",
        "approaching_destination",
        "in_transport",
        "animal_collected",
        "rest_or_care_stop",
        "cancelled_by_operations",
        "compliance_hold",
      ];

      const results = await Promise.all(
        illegalTargets.map((status) =>
          driver.from("transport_requests").update({ status }).eq("id", requestId).select(),
        ),
      );

      for (let i = 0; i < results.length; i++) {
        assert.equal(
          results[i].data?.length ?? 0,
          0,
          `expected the illegal jump to '${illegalTargets[i]}' to be rejected`,
        );
      }

      const current = await admin
        .from("transport_requests")
        .select("status")
        .eq("id", requestId)
        .single();
      assert.equal(
        current.data?.status,
        "driver_assigned",
        "not one illegal concurrent jump got through",
      );

      await admin.from("transport_requests").delete().eq("id", requestId);
    },
  );

  await t.test(
    "only the single legal next step succeeds when fired alongside a burst of illegal ones",
    async () => {
      const requestId = await setupAssignedJob(admin);

      const attempts = [
        "completed",
        "delivered",
        "pickup_confirmed", // the one legal transition from driver_assigned
        "in_transport",
        "handover_confirmed",
      ];

      const results = await Promise.all(
        attempts.map((status) =>
          driver.from("transport_requests").update({ status }).eq("id", requestId).select("status"),
        ),
      );

      const successes = results.filter((r) => (r.data?.length ?? 0) > 0);
      assert.equal(successes.length, 1, "exactly one concurrent attempt should have succeeded");
      assert.equal(successes[0].data?.[0]?.status, "pickup_confirmed");

      const current = await admin
        .from("transport_requests")
        .select("status")
        .eq("id", requestId)
        .single();
      assert.equal(current.data?.status, "pickup_confirmed");

      await admin.from("transport_requests").delete().eq("id", requestId);
    },
  );
});
