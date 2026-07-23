// Stage I: admin/dashboard placeholder audit -- dashboard.admin.organisations.tsx,
// dashboard.admin.settings.tsx (markets), and dashboard.buyer.scheduled.tsx were all honest
// NotImplemented placeholders even though the underlying data (organisations, markets,
// transport_requests) was already real. See docs/AUTONOMOUS_BACKEND_PROGRESS.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { anon, as, ids, isBlocked } from "./helpers.ts";

test("admin organisation management: suspend, restore, feature", async (t) => {
  const admin = await as("admin");
  const breeder1 = await as("breeder1");

  await t.test("admin can list all organisations regardless of type/status", async () => {
    const { data, error } = await admin
      .from("organisations")
      .select("id, name, verification_status, is_featured")
      .eq("id", ids.orgCichyLas)
      .single();
    assert.equal(error, null);
    assert.equal(data?.verification_status, "approved");
  });

  await t.test("an unrelated breeder cannot suspend another org", async () => {
    const breeder2 = await as("breeder2");
    const attempt = await breeder2
      .from("organisations")
      .update({ verification_status: "suspended" })
      .eq("id", ids.orgCichyLas)
      .select();
    assert.ok(isBlocked(attempt.data, attempt.error));
  });

  await t.test("admin suspends and restores an organisation", async () => {
    const suspend = await admin
      .from("organisations")
      .update({ verification_status: "suspended" })
      .eq("id", ids.orgWolnaDolina)
      .select("verification_status")
      .single();
    assert.equal(suspend.error, null);
    assert.equal(suspend.data?.verification_status, "suspended");

    const restore = await admin
      .from("organisations")
      .update({ verification_status: "approved" })
      .eq("id", ids.orgWolnaDolina)
      .select("verification_status")
      .single();
    assert.equal(restore.error, null);
    assert.equal(restore.data?.verification_status, "approved");
  });

  await t.test("admin can feature an organisation; the org's own owner cannot", async () => {
    const featured = await admin
      .from("organisations")
      .update({ is_featured: true })
      .eq("id", ids.orgCichyLas)
      .select("is_featured")
      .single();
    assert.equal(featured.error, null);
    assert.equal(featured.data?.is_featured, true);

    // The org's own owner has full RLS update rights on their own row (row-level only), so
    // is_featured needs its own trigger-level lock (extending the same
    // prevent_org_owner_transfer_by_non_admin trigger Stage E added for owner_user_id) — without
    // it, any owner could self-feature their own listing, defeating admin curation entirely.
    const ownerAttempt = await breeder1
      .from("organisations")
      .update({ is_featured: false })
      .eq("id", ids.orgCichyLas)
      .select();
    assert.ok(ownerAttempt.error, "expected the featured-flag lock trigger to reject this");

    const check = await admin
      .from("organisations")
      .select("is_featured")
      .eq("id", ids.orgCichyLas)
      .single();
    assert.equal(check.data?.is_featured, true, "the owner's attempt must not have changed it");

    await admin.from("organisations").update({ is_featured: false }).eq("id", ids.orgCichyLas);
  });
});

test("markets: admin-only mutation, publicly readable when enabled", async (t) => {
  const admin = await as("admin");
  let marketId: string | undefined;

  await t.test("setup: a real market row exists (Poland, seeded)", async () => {
    const { data, error } = await admin
      .from("markets")
      .select("id, enabled")
      .eq("country_code", "PL")
      .single();
    assert.equal(error, null);
    marketId = data!.id as string;
  });

  await t.test("an unrelated breeder cannot toggle a market", async () => {
    const breeder1 = await as("breeder1");
    const attempt = await breeder1
      .from("markets")
      .update({ enabled: false })
      .eq("id", marketId!)
      .select();
    assert.ok(isBlocked(attempt.data, attempt.error));
  });

  await t.test("admin can toggle a market", async () => {
    const { data, error } = await admin
      .from("markets")
      .update({ enabled: true })
      .eq("id", marketId!)
      .select("enabled")
      .single();
    assert.equal(error, null);
    assert.equal(data?.enabled, true);
  });

  await t.test("anon can read an enabled market but not see a disabled one", async () => {
    const visible = await anon().from("markets").select("id").eq("id", marketId!);
    assert.equal(visible.error, null);
    assert.equal(visible.data?.length, 1);

    await admin.from("markets").update({ enabled: false }).eq("id", marketId!);
    const hidden = await anon().from("markets").select("id").eq("id", marketId!);
    assert.equal(hidden.error, null);
    assert.equal(hidden.data?.length, 0);

    // Restore to whatever a real market for an actively-used country should be.
    await admin.from("markets").update({ enabled: true }).eq("id", marketId!);
  });
});

test("buyer scheduled transports: only scheduled-or-later, own requests only", async (t) => {
  const customer = await as("customer");
  let requestId: string | undefined;

  await t.test("setup: a draft-created request moved to 'scheduled'", async () => {
    const created = await customer.rpc("create_transport_draft", {
      p_request: { pickup_city: "Warsaw" },
      p_animals: [{ name: "Scheduled Test Dog" }],
      p_parties: [],
    });
    assert.equal(created.error, null);
    requestId = created.data as string;
    await customer.from("transport_requests").update({ status: "submitted" }).eq("id", requestId);

    const ops = await as("ops");
    const scheduled = await ops
      .from("transport_requests")
      .update({ status: "scheduled" })
      .eq("id", requestId)
      .select("status")
      .single();
    assert.equal(scheduled.error, null);
    assert.equal(scheduled.data?.status, "scheduled");
  });

  await t.test("it appears in the scheduled-or-later query", async () => {
    const { data, error } = await customer
      .from("transport_requests")
      .select("id, status")
      .eq("requester_profile_id", ids.customer)
      .in("status", ["scheduled", "driver_assigned", "in_transport", "delivered", "completed"])
      .eq("id", requestId!);
    assert.equal(error, null);
    assert.equal(data?.length, 1);
  });

  await t.test("a still-draft request of the same customer does not appear", async () => {
    const draft = await customer.rpc("create_transport_draft", { p_request: {} });
    assert.equal(draft.error, null);
    const { data, error } = await customer
      .from("transport_requests")
      .select("id")
      .eq("requester_profile_id", ids.customer)
      .in("status", ["scheduled", "driver_assigned", "in_transport", "delivered", "completed"])
      .eq("id", draft.data as string);
    assert.equal(error, null);
    assert.equal(data?.length, 0);
    await customer
      .from("transport_requests")
      .delete()
      .eq("id", draft.data as string);
  });

  await t.test("cleanup", async () => {
    const ops = await as("ops");
    if (requestId) await ops.from("transport_requests").delete().eq("id", requestId);
  });
});
