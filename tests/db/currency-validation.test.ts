// Stage BJ (supplemental queue): country/currency/timezone/unit normalisation.
// 20260101010100_currency_code_validation.sql added a real CHECK constraint: currency was
// free-text with zero validation across 8 tables, and some of those columns are writable by a
// party this session otherwise treats as "trusted but not fully trusted" (an org sets
// reservations.currency/animals.currency on their own rows).
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids } from "./helpers.ts";

test("currency columns reject an invalid code and accept the real supported ones", async (t) => {
  const breeder1 = await as("breeder1");
  const admin = await as("admin");

  await t.test("an org cannot set an invalid currency on their own animal", async () => {
    const attempt = await breeder1
      .from("animals")
      .update({ currency: "XYZ" })
      .eq("id", ids.animalMaja)
      .select();
    assert.ok(attempt.error, "expected an invalid currency code to be rejected");
  });

  await t.test("a valid supported currency is still accepted", async () => {
    const before = await breeder1
      .from("animals")
      .select("currency")
      .eq("id", ids.animalMaja)
      .single();
    assert.equal(before.error, null);

    const update = await breeder1
      .from("animals")
      .update({ currency: "EUR" })
      .eq("id", ids.animalMaja)
      .select("currency")
      .single();
    assert.equal(update.error, null);
    assert.equal(update.data?.currency, "EUR");

    // Restore the original value so other tests reusing this seeded animal aren't affected.
    await breeder1
      .from("animals")
      .update({ currency: before.data!.currency })
      .eq("id", ids.animalMaja);
  });

  await t.test("profiles.preferred_currency also rejects an invalid code", async () => {
    const customer = await as("customer");
    const attempt = await customer
      .from("profiles")
      .update({ preferred_currency: "GBP" })
      .eq("id", ids.customer)
      .select();
    assert.ok(attempt.error, "expected an invalid preferred_currency to be rejected");
  });

  await t.test(
    "admins are equally bound by the constraint (data-integrity, not a permission gate)",
    async () => {
      const attempt = await admin
        .from("pricing_rules")
        .insert({ rule_type: "manual_adjustment", amount: 1, currency: "USD" })
        .select();
      assert.ok(attempt.error, "expected the constraint to apply regardless of role");
    },
  );
});
