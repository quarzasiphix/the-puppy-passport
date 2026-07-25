// Stage IR-6 (integration-readiness queue): complete product scenarios
// (20260101012300_convert_application_to_reservation.sql). Writing a genuine end-to-end test for
// "buyer applies -> breeder approves -> reserved" (the exact pipeline docs/PRODUCT_VISION.md's own
// priority hierarchy names) surfaced a real gap: reservations had a complete, correct RLS contract
// but zero code path anywhere could ever create one. This proves the full journey now actually
// works, not just that the RPC exists in isolation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids } from "./helpers.ts";

test("scenario: buyer applies, breeder approves, breeder reserves -- the full purchase pipeline", async (t) => {
  const buyer = await as("buyer");
  const breeder1 = await as("breeder1");
  const admin = await as("admin");
  let applicationId: string | undefined;
  let reservationId: string | undefined;

  await t.test("setup: confirm the animal starts available", async () => {
    const animal = await admin
      .from("animals")
      .select("availability_status")
      .eq("id", ids.animalMaja)
      .single();
    assert.equal(animal.error, null);
    assert.equal(animal.data?.availability_status, "available");
  });

  await t.test("buyer submits a real application", async () => {
    const created = await buyer
      .from("buyer_applications")
      .insert({
        animal_id: ids.animalMaja,
        buyer_id: ids.buyer,
        organization_id: ids.orgCichyLas,
        application_type: "purchase",
        message: "IR-6 scenario test application.",
      })
      .select("id, status")
      .single();
    assert.equal(created.error, null);
    assert.equal(created.data?.status, "submitted");
    applicationId = created.data!.id as string;
  });

  await t.test("converting before approval is rejected", async () => {
    const attempt = await breeder1.rpc("convert_application_to_reservation", {
      p_application_id: applicationId!,
    });
    assert.ok(attempt.error, "expected a not-yet-approved application to be rejected");
  });

  await t.test("the kennel approves the application", async () => {
    const updated = await breeder1
      .from("buyer_applications")
      .update({ status: "approved" })
      .eq("id", applicationId!)
      .select("status")
      .single();
    assert.equal(updated.error, null);
    assert.equal(updated.data?.status, "approved");
  });

  await t.test("an unrelated organisation cannot convert this application", async () => {
    const foundation1 = await as("foundation1");
    const attempt = await foundation1.rpc("convert_application_to_reservation", {
      p_application_id: applicationId!,
    });
    assert.ok(attempt.error, "expected only the owning organisation to be able to convert");
  });

  await t.test("the kennel converts the approved application to a reservation", async () => {
    const call = await breeder1.rpc("convert_application_to_reservation", {
      p_application_id: applicationId!,
      p_agreed_price: 4500,
      p_currency: "PLN",
    });
    assert.equal(call.error, null);
    assert.ok(call.data, "expected a real reservation id");
    reservationId = call.data as string;
  });

  await t.test("the reservation is correctly populated and visible to the buyer", async () => {
    const seen = await buyer
      .from("reservations")
      .select("id, animal_id, buyer_id, organization_id, application_id, agreed_price, status")
      .eq("id", reservationId!)
      .single();
    assert.equal(seen.error, null);
    assert.equal(seen.data?.animal_id, ids.animalMaja);
    assert.equal(seen.data?.buyer_id, ids.buyer);
    assert.equal(seen.data?.organization_id, ids.orgCichyLas);
    assert.equal(seen.data?.application_id, applicationId);
    assert.equal(seen.data?.agreed_price, 4500);
  });

  await t.test("the application status flips to converted_to_reservation", async () => {
    const app = await buyer
      .from("buyer_applications")
      .select("status")
      .eq("id", applicationId!)
      .single();
    assert.equal(app.error, null);
    assert.equal(app.data?.status, "converted_to_reservation");
  });

  await t.test("the animal's public availability status becomes reserved", async () => {
    const animal = await admin
      .from("animals")
      .select("availability_status")
      .eq("id", ids.animalMaja)
      .single();
    assert.equal(animal.error, null);
    assert.equal(animal.data?.availability_status, "reserved");
  });

  await t.test(
    "converting the same application a second time is rejected, not silently duplicated",
    async () => {
      const attempt = await breeder1.rpc("convert_application_to_reservation", {
        p_application_id: applicationId!,
      });
      assert.ok(attempt.error, "expected a second conversion attempt to be rejected");

      const count = await admin
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("application_id", applicationId!);
      assert.equal(count.count, 1, "exactly one reservation must exist, never two");
    },
  );

  await t.test("cleanup", async () => {
    const deletedReservation = await admin.from("reservations").delete().eq("id", reservationId!);
    assert.equal(deletedReservation.error, null);
    const deletedApplication = await admin
      .from("buyer_applications")
      .delete()
      .eq("id", applicationId!);
    assert.equal(deletedApplication.error, null);
    const restoredAnimal = await admin
      .from("animals")
      .update({ availability_status: "available" })
      .eq("id", ids.animalMaja);
    assert.equal(restoredAnimal.error, null);
  });
});
