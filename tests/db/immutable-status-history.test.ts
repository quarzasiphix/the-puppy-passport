// Stage CJF (third/fourth supplemental queue): immutable lifecycle history
// (20260101011300_immutable_status_history.sql). transport_status_history used to have `for all`
// write policies for both ops staff and the assigned driver -- meaning either could UPDATE or
// DELETE an existing historical row, not just append new ones, even though every real app code
// path only ever inserts or selects. Now genuinely append-only, matching audit_logs' own existing
// precedent (no update/delete policy for anyone, not even admin).
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, createTestTransportRequest } from "./helpers.ts";

test("transport_status_history is append-only: no UPDATE or DELETE for ops or the assigned driver", async (t) => {
  const ops = await as("ops");
  const driver = await as("driver");
  const admin = await as("admin");
  let requestId: string | undefined;
  let historyRowId: string | undefined;

  await t.test(
    "setup: a request assigned to the seeded driver, with a real logged status",
    async () => {
      requestId = await createTestTransportRequest(ops, {
        requesterProfileId: ids.customer,
        tag: "CJF-HISTORY",
        status: "driver_assigned",
        assigned_driver_id: ids.driverRecord,
        assigned_vehicle_id: ids.vehicle,
      });

      const row = await ops
        .from("transport_status_history")
        .insert({
          transport_request_id: requestId,
          status: "driver_assigned",
          changed_by: ids.ops,
          customer_note: "Driver assigned.",
        })
        .select("id")
        .single();
      assert.equal(row.error, null, "ops can still insert -- only update/delete are restricted");
      historyRowId = row.data!.id as string;
    },
  );

  await t.test("ops staff cannot UPDATE an existing history row", async () => {
    const attempt = await ops
      .from("transport_status_history")
      .update({ customer_note: "Tampered." })
      .eq("id", historyRowId!)
      .select();
    assert.equal(
      attempt.data?.length ?? 0,
      0,
      "ops must not be able to edit history after the fact",
    );
  });

  await t.test("ops staff cannot DELETE an existing history row", async () => {
    const attempt = await ops
      .from("transport_status_history")
      .delete()
      .eq("id", historyRowId!)
      .select();
    assert.equal(attempt.data?.length ?? 0, 0, "ops must not be able to delete history");
  });

  await t.test("the assigned driver can still insert a real status log entry", async () => {
    const row = await driver
      .from("transport_status_history")
      .insert({
        transport_request_id: requestId!,
        status: "pickup_confirmed",
        changed_by: ids.driver,
        customer_note: "Picked up.",
      })
      .select("id")
      .single();
    assert.equal(
      row.error,
      null,
      "the driver can still insert -- only update/delete are restricted",
    );
  });

  await t.test(
    "the assigned driver cannot UPDATE or DELETE any history row on their own job",
    async () => {
      const updateAttempt = await driver
        .from("transport_status_history")
        .update({ customer_note: "Tampered by driver." })
        .eq("id", historyRowId!)
        .select();
      assert.equal(
        updateAttempt.data?.length ?? 0,
        0,
        "the driver must not be able to edit history",
      );

      const deleteAttempt = await driver
        .from("transport_status_history")
        .delete()
        .eq("id", historyRowId!)
        .select();
      assert.equal(
        deleteAttempt.data?.length ?? 0,
        0,
        "the driver must not be able to delete history",
      );
    },
  );

  await t.test("the row is still exactly as it was originally written", async () => {
    const current = await ops
      .from("transport_status_history")
      .select("customer_note")
      .eq("id", historyRowId!)
      .single();
    assert.equal(current.error, null);
    assert.equal(current.data?.customer_note, "Driver assigned.");
  });

  await t.test("cleanup", async () => {
    await admin.from("transport_requests").delete().eq("id", requestId!);
  });
});
