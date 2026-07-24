// Stage BZ (supplemental queue): maintenance mode (20260101011000_maintenance_mode.sql). Covers:
// only ever one row, publicly readable, admin-only write, the server-stamped enabled_by/enabled_at
// (never forgeable, even on a same-value update), and that a non-admin can read but never write.
import { test } from "node:test";
import assert from "node:assert/strict";
import { anon, as, ids } from "./helpers.ts";

test("app_maintenance_mode: single row, public read, admin-only write, non-forgeable actor stamp", async (t) => {
  const admin = await as("admin");
  const customer = await as("customer");

  await t.test("cleanup: ensure a known baseline before this test", async () => {
    const reset = await admin
      .from("app_maintenance_mode")
      .update({
        enabled: false,
        message: "Havenpaw is temporarily down for maintenance. Please check back shortly.",
      })
      .eq("id", true)
      .select("enabled")
      .single();
    assert.equal(reset.error, null);
    assert.equal(reset.data?.enabled, false);
  });

  await t.test("anon can read the maintenance status", async () => {
    const read = await anon()
      .from("app_maintenance_mode")
      .select("enabled, message")
      .eq("id", true)
      .single();
    assert.equal(read.error, null);
    assert.equal(read.data?.enabled, false);
  });

  await t.test("a non-admin cannot enable maintenance mode", async () => {
    const attempt = await customer
      .from("app_maintenance_mode")
      .update({ enabled: true })
      .eq("id", true)
      .select();
    assert.equal(
      attempt.data?.length ?? 0,
      0,
      "RLS must silently filter out the write for a non-admin",
    );
  });

  await t.test("an admin can enable it, and the actor/timestamp are server-stamped", async () => {
    const enabled = await admin
      .from("app_maintenance_mode")
      .update({ enabled: true, message: "Upgrading the database, back in 10 minutes." })
      .eq("id", true)
      .select("enabled, message, enabled_by, enabled_at")
      .single();
    assert.equal(enabled.error, null);
    assert.equal(enabled.data?.enabled, true);
    assert.equal(enabled.data?.message, "Upgrading the database, back in 10 minutes.");
    assert.equal(enabled.data?.enabled_by, ids.admin);
    assert.ok(enabled.data?.enabled_at);
  });

  await t.test(
    "a forged enabled_by on a same-value update is overwritten, not honoured",
    async () => {
      const forged = await admin
        .from("app_maintenance_mode")
        .update({ enabled: true, enabled_by: ids.customer, message: "Still upgrading." })
        .eq("id", true)
        .select("enabled_by, message")
        .single();
      assert.equal(forged.error, null);
      assert.equal(
        forged.data?.enabled_by,
        ids.admin,
        "the trigger must re-stamp the real caller, not the forged value",
      );
      assert.equal(forged.data?.message, "Still upgrading.");
    },
  );

  await t.test("disabling preserves who last turned it on, not client-supplied", async () => {
    const before = await admin
      .from("app_maintenance_mode")
      .select("enabled_by, enabled_at")
      .eq("id", true)
      .single();

    const disabled = await admin
      .from("app_maintenance_mode")
      .update({ enabled: false, enabled_by: ids.customer })
      .eq("id", true)
      .select("enabled, enabled_by, enabled_at")
      .single();
    assert.equal(disabled.error, null);
    assert.equal(disabled.data?.enabled, false);
    assert.equal(
      disabled.data?.enabled_by,
      before.data?.enabled_by,
      "must preserve the real last-enabled actor, not the forged value on disable",
    );
    assert.equal(disabled.data?.enabled_at, before.data?.enabled_at);
  });

  await t.test("cleanup: leave the row in its default disabled state", async () => {
    await admin
      .from("app_maintenance_mode")
      .update({
        enabled: false,
        message: "Havenpaw is temporarily down for maintenance. Please check back shortly.",
      })
      .eq("id", true);
  });
});
