// Stage Z (supplemental queue): quotation/pricing hardening. Audited pricing_rules and quotation
// creation and found the design already correct (pricing_rules is ops-only-write and the client-
// side estimate calculator, src/lib/queries/pricing.ts, only ever reads active rules for a
// display-only range -- never the charged amount; quotations are ops-only-write, with the
// requester's accept/reject path already column-locked by Stage L). What was genuinely missing:
// zero test coverage existed for either boundary. Closing that gap, not a code change.
import { test } from "node:test";
import assert from "node:assert/strict";
import { anon, as, ids, isBlocked } from "./helpers.ts";

test("pricing_rules: active rules are public, inactive rules are hidden, only ops can write", async (t) => {
  const anonClient = anon();
  const customer = await as("customer");
  const ops = await as("ops");

  await t.test("an anonymous visitor can read active pricing rules", async () => {
    const { data, error } = await anonClient.from("pricing_rules").select("id, active").limit(1);
    assert.equal(error, null);
    assert.ok(Array.isArray(data));
    for (const row of data ?? []) assert.equal(row.active, true);
  });

  let inactiveRuleId: string | undefined;
  await t.test(
    "an inactive rule is hidden from anonymous and ordinary authenticated readers",
    async () => {
      const created = await ops
        .from("pricing_rules")
        .insert({ rule_type: "manual_adjustment", amount: 999, active: false })
        .select("id")
        .single();
      assert.equal(created.error, null);
      inactiveRuleId = created.data!.id as string;

      const anonView = await anonClient.from("pricing_rules").select("id").eq("id", inactiveRuleId);
      assert.ok(isBlocked(anonView.data, anonView.error));

      const customerView = await customer
        .from("pricing_rules")
        .select("id")
        .eq("id", inactiveRuleId);
      assert.ok(isBlocked(customerView.data, customerView.error));
    },
  );

  await t.test("ops can read the inactive rule", async () => {
    const seen = await ops.from("pricing_rules").select("id").eq("id", inactiveRuleId!).single();
    assert.equal(seen.error, null);
  });

  await t.test("an ordinary authenticated user cannot write pricing rules", async () => {
    const attempt = await customer
      .from("pricing_rules")
      .insert({ rule_type: "manual_adjustment", amount: 1, active: true })
      .select("id");
    assert.ok(isBlocked(attempt.data, attempt.error));

    const updateAttempt = await customer
      .from("pricing_rules")
      .update({ amount: 1 })
      .eq("id", inactiveRuleId!)
      .select("id");
    assert.ok(isBlocked(updateAttempt.data, updateAttempt.error));
  });

  await t.test("cleanup", async () => {
    await ops.from("pricing_rules").delete().eq("id", inactiveRuleId!);
  });
});

test("quotations: only ops can create a quotation at all", async () => {
  const customer = await as("customer");

  const attempt = await customer
    .from("quotations")
    .insert({
      transport_request_id: ids.transportWarsawAmsterdam,
      service_type: "individual",
      total_price: 1,
      currency: "EUR",
      status: "draft",
      created_by: ids.customer,
    })
    .select("id");
  assert.ok(
    isBlocked(attempt.data, attempt.error),
    "expected a customer to be completely unable to insert a quotation, not just restricted on update",
  );
});
