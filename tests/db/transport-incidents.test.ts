// Stage BH (supplemental queue): incidents/animal-welfare events. transport_incidents had zero
// test coverage despite being a real, already-correctly-built feature: the assigned-driver INSERT
// policy already enforces reported_by = auth.uid() at the RLS layer (not a client-trusted field,
// unlike several forgeable-actor gaps found and fixed elsewhere this session), drivers have no
// UPDATE policy at all (can't edit their own report after the fact -- ops-only resolution), and
// is_assigned_driver_for_request() (fixed in Stage BD to check active role) gates who may report.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, createTestTransportRequest, ids, isBlocked } from "./helpers.ts";

test("transport_incidents: assigned-driver-only reporting, RLS-enforced actor, ops-only resolution", async (t) => {
  const ops = await as("ops");
  const driver = await as("driver");
  let requestId: string | undefined;
  let incidentId: string | undefined;

  await t.test("setup: a request assigned to the seeded driver", async () => {
    requestId = await createTestTransportRequest(ops, {
      requesterProfileId: ids.customer,
      tag: "BH-INCIDENT",
      status: "in_transport",
      assigned_driver_id: ids.driverRecord,
      assigned_vehicle_id: ids.vehicle,
    });
  });

  await t.test("the assigned driver can report a real incident on their active job", async () => {
    const incident = await driver
      .from("transport_incidents")
      .insert({
        transport_request_id: requestId!,
        reported_by: ids.driver,
        incident_type: "delay",
        severity: "low",
        description: "Traffic delay, ETA pushed back 45 minutes.",
      })
      .select("id, status, reported_by")
      .single();
    assert.equal(incident.error, null);
    assert.equal(incident.data?.status, "open");
    assert.equal(incident.data?.reported_by, ids.driver);
    incidentId = incident.data!.id as string;
  });

  await t.test("the driver cannot forge reported_by to a different profile", async () => {
    const attempt = await driver
      .from("transport_incidents")
      .insert({
        transport_request_id: requestId!,
        reported_by: ids.ops,
        incident_type: "delay",
        severity: "low",
        description: "Forged actor attempt.",
      })
      .select();
    assert.ok(
      isBlocked(attempt.data, attempt.error),
      "expected a forged reported_by to be rejected",
    );
  });

  await t.test("an unrelated driver cannot report an incident on this job", async () => {
    const admin = await as("admin");
    // Build a second, genuinely unrelated driver -- temporarily grant driver role + a drivers row
    // to breederPending, who has no relationship whatsoever to this transport request.
    const grantRole = await admin
      .from("user_roles")
      .upsert(
        { user_id: ids.breederPending, role: "driver", status: "active" },
        { onConflict: "user_id,role" },
      );
    assert.equal(grantRole.error, null);
    const grantDriver = await admin
      .from("drivers")
      .insert({ profile_id: ids.breederPending, name: "BH Unrelated Driver" })
      .select("id")
      .single();
    assert.equal(grantDriver.error, null);

    try {
      const unrelated = await as("breederPending");
      const attempt = await unrelated
        .from("transport_incidents")
        .insert({
          transport_request_id: requestId!,
          reported_by: ids.breederPending,
          incident_type: "delay",
          severity: "low",
          description: "Should be blocked -- not assigned to this job.",
        })
        .select();
      assert.ok(isBlocked(attempt.data, attempt.error));
    } finally {
      await admin
        .from("drivers")
        .delete()
        .eq("id", grantDriver.data!.id as string);
      await admin
        .from("user_roles")
        .delete()
        .eq("user_id", ids.breederPending)
        .eq("role", "driver");
    }
  });

  await t.test("the reporting driver cannot edit their own incident afterward", async () => {
    const attempt = await driver
      .from("transport_incidents")
      .update({ severity: "critical" })
      .eq("id", incidentId!)
      .select();
    assert.ok(
      isBlocked(attempt.data, attempt.error),
      "expected drivers to have no update access at all",
    );
  });

  await t.test("ops can resolve the incident", async () => {
    const resolved = await ops
      .from("transport_incidents")
      .update({
        status: "resolved",
        resolution_notes: "Confirmed with the recipient.",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", incidentId!)
      .select("status")
      .single();
    assert.equal(resolved.error, null);
    assert.equal(resolved.data?.status, "resolved");
  });

  await t.test("the customer/requester cannot see raw incident records", async () => {
    const customer = await as("customer");
    const attempt = await customer.from("transport_incidents").select("id").eq("id", incidentId!);
    assert.ok(isBlocked(attempt.data, attempt.error));
  });

  await t.test("cleanup", async () => {
    await ops.from("transport_incidents").delete().eq("id", incidentId!);
    await ops.from("transport_requests").delete().eq("id", requestId!);
  });
});
