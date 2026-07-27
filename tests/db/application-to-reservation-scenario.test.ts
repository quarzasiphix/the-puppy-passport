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
    "a real audit_logs entry records the conversion (Stage YR-7: previously missing)",
    async () => {
      const audit = await admin
        .from("audit_logs")
        .select("actor_profile_id, action")
        .eq("target_id", applicationId!)
        .eq("action", "buyer_application.converted_to_reservation")
        .single();
      assert.equal(audit.error, null);
      assert.equal(audit.data?.actor_profile_id, ids.breeder1);
    },
  );

  await t.test(
    "converting the same application again with DIFFERENT terms is rejected as a real conflict (Stage XR-9)",
    async () => {
      const attempt = await breeder1.rpc("convert_application_to_reservation", {
        p_application_id: applicationId!,
        // Omits agreed_price/currency -- defaults to null/'PLN', genuinely different from the
        // 4500/'PLN' actually recorded, so this must be rejected as a conflicting retry, not
        // silently accepted or silently ignored.
      });
      assert.ok(attempt.error, "expected a changed-payload retry to be rejected");

      const count = await admin
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("application_id", applicationId!);
      assert.equal(count.count, 1, "exactly one reservation must exist, never two");
    },
  );

  await t.test(
    "retrying with the EXACT SAME terms is a true idempotent success -- returns the original reservation, not an error (Stage XR-9)",
    async () => {
      const retry = await breeder1.rpc("convert_application_to_reservation", {
        p_application_id: applicationId!,
        p_agreed_price: 4500,
        p_currency: "PLN",
      });
      assert.equal(
        retry.error,
        null,
        "a retry with the exact same terms must succeed, not error, matching the original call",
      );
      assert.equal(
        retry.data,
        reservationId,
        "must return the original reservation's own id, not create a new one",
      );

      const count = await admin
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("application_id", applicationId!);
      assert.equal(
        count.count,
        1,
        "still exactly one reservation, the idempotent retry created nothing new",
      );
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

// Stage XR-9 (idempotency key registry): genuinely concurrent retries -- not just sequential
// "call again after the first already returned" -- must still converge on exactly one reservation.
test("convert_application_to_reservation: genuinely concurrent identical calls converge on one reservation", async (t) => {
  const customer = await as("customer");
  const breeder2 = await as("breeder2");
  const admin = await as("admin");
  let applicationId: string | undefined;

  await t.test("setup: an approved application", async () => {
    // Uses the `customer` persona (not `buyer`) and `breeder2`/orgWolnaDolina (the org that
    // actually owns animalRico) specifically to avoid colliding with seed.sql's own existing
    // active application for buyer_id=ids.buyer on this same animal
    // (buyer_applications_active_unique) -- a genuinely fresh, uncontended application.
    const created = await customer
      .from("buyer_applications")
      .insert({
        animal_id: ids.animalRico,
        buyer_id: ids.customer,
        organization_id: ids.orgWolnaDolina,
        application_type: "purchase",
        message: "XR-9 concurrency test application.",
      })
      .select("id")
      .single();
    assert.equal(created.error, null);
    applicationId = created.data!.id as string;

    const approved = await admin
      .from("buyer_applications")
      .update({ status: "approved" })
      .eq("id", applicationId);
    assert.equal(approved.error, null);
  });

  await t.test(
    "10 simultaneous identical conversion calls all succeed and agree on the same reservation id",
    async () => {
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          breeder2.rpc("convert_application_to_reservation", {
            p_application_id: applicationId!,
            p_agreed_price: 2000,
            p_currency: "PLN",
          }),
        ),
      );
      for (const r of results) {
        assert.equal(r.error, null, "every concurrent call must succeed, never fail outright");
      }
      const distinctIds = new Set(results.map((r) => r.data));
      assert.equal(distinctIds.size, 1, "every concurrent call must resolve to the exact same id");

      const count = await admin
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("application_id", applicationId!);
      assert.equal(count.count, 1, "the race must never leave more than one reservation behind");
    },
  );

  await t.test("cleanup", async () => {
    await admin.from("reservations").delete().eq("application_id", applicationId!);
    await admin.from("buyer_applications").delete().eq("id", applicationId!);
    await admin
      .from("animals")
      .update({ availability_status: "available" })
      .eq("id", ids.animalRico);
  });
});
