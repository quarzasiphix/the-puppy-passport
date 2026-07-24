// Stage BG (supplemental queue): proof of pickup/delivery.
// transport_status_history.evidence_url existed but was never wired to anything -- no Storage
// bucket, no RLS, no way to actually attach a photo when a driver logs a status change. Also
// closes the same non-atomic + forgeable-actor shape already fixed for
// changeOpsRequestStatus()/assignRequestToRoute(): advanceJobStatus() used to do two separate
// client-side writes with a client-supplied driverProfileId trusted as the actor.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, createTestTransportRequest, ids } from "./helpers.ts";

test("advance_transport_job_status: atomic write with evidence, server-stamped actor, driver-only", async (t) => {
  const ops = await as("ops");
  const driver = await as("driver");
  let requestId: string | undefined;
  let objectPath: string | undefined;

  await t.test("setup: a request assigned to the seeded driver", async () => {
    requestId = await createTestTransportRequest(ops, {
      requesterProfileId: ids.customer,
      tag: "BG-EVIDENCE",
      status: "driver_assigned",
      assigned_driver_id: ids.driverRecord,
      assigned_vehicle_id: ids.vehicle,
    });
  });

  await t.test(
    "setup: advance through the real intermediate steps (Stage CC's state machine)",
    async () => {
      for (const status of [
        "pickup_confirmed",
        "animal_collected",
        "in_transport",
        "approaching_destination",
      ]) {
        const step = await driver.rpc("advance_transport_job_status", {
          p_request_id: requestId!,
          p_new_status: status,
        });
        assert.equal(step.error, null, `expected the real ${status} step to succeed`);
      }
    },
  );

  await t.test("the driver uploads a real evidence photo and logs delivered with it", async () => {
    objectPath = `${requestId}/delivered-${Date.now()}.txt`;
    const upload = await driver.storage
      .from("transport-evidence")
      .upload(objectPath, new Blob(["not a real photo -- evidence flow test"]), {
        contentType: "text/plain",
      });
    assert.equal(upload.error, null);

    const call = await driver.rpc("advance_transport_job_status", {
      p_request_id: requestId!,
      p_new_status: "delivered",
      p_evidence_object_path: objectPath,
      p_customer_note: "Delivered to the recipient.",
    });
    assert.equal(call.error, null);
  });

  await t.test(
    "status, history and evidence all landed together, with the real driver as actor",
    async () => {
      const request = await ops
        .from("transport_requests")
        .select("status")
        .eq("id", requestId!)
        .single();
      assert.equal(request.error, null);
      assert.equal(request.data?.status, "delivered");

      const history = await ops
        .from("transport_status_history")
        .select("changed_by, evidence_url, customer_note")
        .eq("transport_request_id", requestId!)
        .eq("status", "delivered")
        .single();
      assert.equal(history.error, null);
      assert.equal(history.data?.changed_by, ids.driver, "changed_by must be the real caller");
      assert.equal(history.data?.evidence_url, objectPath);
    },
  );

  await t.test(
    "the requester can read the evidence via a signed URL; an unrelated user cannot",
    async () => {
      const customer = await as("customer");
      const signed = await customer.storage
        .from("transport-evidence")
        .createSignedUrl(objectPath!, 60);
      assert.equal(signed.error, null);
      assert.ok(signed.data?.signedUrl);

      const outsider = await as("foundation1");
      const denied = await outsider.storage
        .from("transport-evidence")
        .createSignedUrl(objectPath!, 60);
      assert.ok(denied.error, "expected an unrelated user to be denied");
    },
  );

  await t.test("an unassigned driver cannot advance this job at all", async () => {
    // breederPending has no drivers row, so this proves the "not the assigned driver" branch,
    // not just a role check.
    const notADriver = await as("breederPending");
    const attempt = await notADriver.rpc("advance_transport_job_status", {
      p_request_id: requestId!,
      p_new_status: "handover_confirmed",
      p_evidence_object_path: null,
      p_customer_note: null,
    });
    assert.ok(attempt.error, "expected a non-assigned-driver caller to be rejected");
  });

  await t.test("cleanup", async () => {
    await ops.storage.from("transport-evidence").remove([objectPath!]);
    await ops.from("transport_requests").delete().eq("id", requestId!);
  });
});
