// Stage CJM (third/fourth supplemental queue): admin command log
// (20260101011700_organisation_verification_lock_and_admin_audit.sql). Two findings closed
// together: `organisations.verification_status` had no owner-lock protection at all (unlike
// `owner_user_id`/`is_featured`, already locked since Stage E/I) -- an org owner could self-approve
// their own organisation via a raw UPDATE, bypassing approve_user_verification() entirely, the same
// self-approval bug class already closed for rehoming_reviews/buyer_applications. And every real
// admin change to verification_status/is_featured/owner_user_id now writes a real audit_logs entry.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids } from "./helpers.ts";

test("organisations.verification_status: an owner cannot self-approve or self-suspend", async (t) => {
  // Deliberately owned by breeder1, not breederPending: owns_org() (the RLS "owners update their
  // own organisation" policy's `using` clause) requires the owner to hold an *active* role for the
  // org's type -- breederPending's own 'breeder' role is still 'pending', so a raw update from that
  // persona would never even reach the trigger; RLS would silently filter the row to zero matches
  // (data: [], error: null) and the test would pass for the wrong reason, proving nothing about the
  // trigger itself. breeder1 already holds an active breeder role, so RLS lets the UPDATE through
  // and the assertion genuinely exercises prevent_org_owner_transfer_by_non_admin().
  const breeder1 = await as("breeder1");
  const admin = await as("admin");
  let orgId: string | undefined;

  await t.test(
    "setup: a disposable pending org owned by breeder1 (none is seeded in 'pending' status -- orgs are only ever created by approve_user_verification())",
    async () => {
      const created = await admin
        .from("organisations")
        .insert({
          org_type: "kennel",
          name: "CJM Test Kennel",
          slug: `cjm-test-kennel-${Date.now()}`,
          owner_user_id: ids.breeder1,
        })
        .select("id, verification_status")
        .single();
      assert.equal(created.error, null);
      assert.equal(created.data?.verification_status, "pending");
      orgId = created.data!.id as string;
    },
  );

  await t.test("the owner cannot self-approve via a raw update", async () => {
    // A trigger-raised P0001 exception (not an RLS-level rejection) -- the row-level UPDATE is
    // genuinely allowed by RLS (breeder1 owns this org and holds an active breeder role), so the
    // correct rejection signal here is a real Postgres error, not an RLS-style empty/forbidden result.
    const attempt = await breeder1
      .from("organisations")
      .update({ verification_status: "approved" })
      .eq("id", orgId!)
      .select();
    assert.ok(attempt.error, "expected the lock trigger to reject a self-approval");

    const stillPending = await admin
      .from("organisations")
      .select("verification_status")
      .eq("id", orgId!)
      .single();
    assert.equal(stillPending.data?.verification_status, "pending", "status must be unchanged");
  });

  await t.test("an already-approved org's owner cannot self-suspend either", async () => {
    // breeder1 now owns two orgs (the disposable one above, still pending, plus their real seeded
    // approved kennel) -- filter on verification_status so this targets the seeded approved one
    // specifically rather than colliding with the disposable row and breaking .single().
    const org = await admin
      .from("organisations")
      .select("id, verification_status")
      .eq("owner_user_id", ids.breeder1)
      .eq("verification_status", "approved")
      .single();
    assert.equal(org.data?.verification_status, "approved");

    const attempt = await breeder1
      .from("organisations")
      .update({ verification_status: "suspended" })
      .eq("id", org.data!.id as string)
      .select();
    assert.ok(attempt.error, "expected the lock trigger to reject a self-suspension");
  });

  await t.test("cleanup", async () => {
    const deleted = await admin.from("organisations").delete().eq("id", orgId!);
    assert.equal(deleted.error, null, "cleanup must not silently swallow a real deletion failure");
  });
});

test("organisations: admin changes to verification_status/is_featured are audited", async (t) => {
  const admin = await as("admin");
  let orgId: string | undefined;
  let originalStatus: string | undefined;
  let originalFeatured: boolean | undefined;

  await t.test("setup: capture the real current state of a real org", async () => {
    const org = await admin
      .from("organisations")
      .select("id, verification_status, is_featured")
      .eq("owner_user_id", ids.breeder2)
      .single();
    assert.equal(org.error, null);
    orgId = org.data!.id as string;
    originalStatus = org.data!.verification_status as string;
    originalFeatured = org.data!.is_featured as boolean;
  });

  await t.test("admin toggles is_featured; a real audit_logs entry is written", async () => {
    const toggled = await admin
      .from("organisations")
      .update({ is_featured: !originalFeatured })
      .eq("id", orgId!)
      .select("is_featured")
      .single();
    assert.equal(toggled.error, null);
    assert.equal(toggled.data?.is_featured, !originalFeatured);

    const audit = await admin
      .from("audit_logs")
      .select("actor_profile_id, action, before, after")
      .eq("target_id", orgId!)
      .eq("action", "organisation.featured_changed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    assert.equal(audit.error, null);
    assert.equal(audit.data?.actor_profile_id, ids.admin);
    assert.equal((audit.data?.before as { is_featured: boolean }).is_featured, originalFeatured);
    assert.equal((audit.data?.after as { is_featured: boolean }).is_featured, !originalFeatured);

    // restore
    await admin.from("organisations").update({ is_featured: originalFeatured }).eq("id", orgId!);
  });

  await t.test(
    "a non-admin's own routine update (e.g. name) is never audited as a command",
    async () => {
      // orgWolnaDolina is a shared seeded org other test files also legitimately admin-toggle
      // (e.g. tests/db/admin-placeholders.test.ts's own suspend/restore cycle) across this long,
      // non-reset-between-files suite -- comparing a before/after delta rather than asserting an
      // absolute row count is what actually proves *this* routine self-edit added nothing.
      const before = await admin
        .from("audit_logs")
        .select("id")
        .eq("target_id", orgId!)
        .eq("action", "organisation.verification_status_changed");
      assert.equal(before.error, null);

      const breeder2 = await as("breeder2");
      await breeder2
        .from("organisations")
        .update({ description: "Routine self-edit." })
        .eq("id", orgId!);

      const after = await admin
        .from("audit_logs")
        .select("id")
        .eq("target_id", orgId!)
        .eq("action", "organisation.verification_status_changed");
      assert.equal(after.error, null);
      assert.equal(
        after.data?.length,
        before.data?.length,
        "an ordinary self-edit must not produce a new command-log entry",
      );
    },
  );
});
