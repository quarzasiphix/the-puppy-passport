// Stage BM (supplemental queue): moderation assignment/reviewer workload.
// claim_moderation_case() (20260101010300_moderation_case_claim_rpc.sql) closes two real gaps in
// the "investigate" UI action: a concurrent-claim race (two moderators claiming the same
// unassigned case at once, whoever's write lands last silently wins) and a forgeable
// assigned_moderator_id (previously just whatever the client sent).
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids } from "./helpers.ts";

test("claim_moderation_case: atomic claim, server-stamped actor, clear conflict error", async (t) => {
  const admin = await as("admin");
  let caseId: string | undefined;

  await t.test("setup: a fresh open, unassigned moderation case", async () => {
    const created = await admin
      .from("moderation_cases")
      .insert({ case_type: "test", target_type: "user", target_id: ids.buyer, status: "open" })
      .select("id, assigned_moderator_id")
      .single();
    assert.equal(created.error, null);
    assert.equal(created.data?.assigned_moderator_id, null);
    caseId = created.data!.id as string;
  });

  await t.test("admin claims it: assigned_moderator_id and status update atomically", async () => {
    const call = await admin.rpc("claim_moderation_case", { p_case_id: caseId! });
    assert.equal(call.error, null);

    const claimed = await admin
      .from("moderation_cases")
      .select("assigned_moderator_id, status")
      .eq("id", caseId!)
      .single();
    assert.equal(claimed.error, null);
    assert.equal(claimed.data?.assigned_moderator_id, ids.admin);
    assert.equal(claimed.data?.status, "investigating");

    // Stage YR-7 (admin command catalogue): claim_moderation_case() previously left no
    // audit_logs trail, unlike its direct sibling claim_support_case().
    const audit = await admin
      .from("audit_logs")
      .select("actor_profile_id, action")
      .eq("target_id", caseId!)
      .eq("action", "moderation_case.claimed")
      .single();
    assert.equal(audit.error, null);
    assert.equal(audit.data?.actor_profile_id, ids.admin);
  });

  await t.test("claiming it again (idempotent, same claimant) succeeds", async () => {
    const call = await admin.rpc("claim_moderation_case", { p_case_id: caseId! });
    assert.equal(call.error, null, "re-claiming your own case must stay allowed");
  });

  await t.test("cleanup", async () => {
    await admin.from("moderation_cases").delete().eq("id", caseId!);
  });
});

test("claim_moderation_case: a second moderator cannot silently steal an already-claimed case", async (t) => {
  const admin = await as("admin");
  let caseId: string | undefined;
  let secondModeratorGranted = false;

  await t.test("setup: a case already claimed by admin, plus a second real moderator", async () => {
    const created = await admin
      .from("moderation_cases")
      .insert({ case_type: "test", target_type: "user", target_id: ids.buyer, status: "open" })
      .select("id")
      .single();
    assert.equal(created.error, null);
    caseId = created.data!.id as string;

    const firstClaim = await admin.rpc("claim_moderation_case", { p_case_id: caseId });
    assert.equal(firstClaim.error, null);

    // breederPending has no relationship to this case -- temporarily grant them the moderator
    // role to act as a genuinely second, real moderator identity for this test.
    const grant = await admin
      .from("user_roles")
      .upsert(
        { user_id: ids.breederPending, role: "moderator", status: "active" },
        { onConflict: "user_id,role" },
      );
    assert.equal(grant.error, null);
    secondModeratorGranted = true;
  });

  await t.test("the second moderator cannot claim a case someone else already has", async () => {
    const secondModerator = await as("breederPending");
    const attempt = await secondModerator.rpc("claim_moderation_case", { p_case_id: caseId! });
    assert.ok(attempt.error, "expected the RPC to reject claiming an already-claimed case");
    assert.match(attempt.error!.message, /already been claimed/);

    // Confirm the original claim is completely unchanged.
    const stillAdmins = await admin
      .from("moderation_cases")
      .select("assigned_moderator_id")
      .eq("id", caseId!)
      .single();
    assert.equal(stillAdmins.error, null);
    assert.equal(stillAdmins.data?.assigned_moderator_id, ids.admin);
  });

  await t.test("a non-moderator cannot call claim_moderation_case at all", async () => {
    const customer = await as("customer");
    const attempt = await customer.rpc("claim_moderation_case", { p_case_id: caseId! });
    assert.ok(attempt.error, "expected a non-moderator to be rejected outright");
  });

  await t.test("cleanup", async () => {
    await admin.from("moderation_cases").delete().eq("id", caseId!);
    if (secondModeratorGranted) {
      await admin
        .from("user_roles")
        .delete()
        .eq("user_id", ids.breederPending)
        .eq("role", "moderator");
    }
  });
});

test("claim_moderation_case: two genuinely concurrent claims resolve to exactly one winner", async (t) => {
  const admin = await as("admin");
  let caseId: string | undefined;

  await t.test("setup: a fresh case + a second real moderator identity", async () => {
    const created = await admin
      .from("moderation_cases")
      .insert({ case_type: "test", target_type: "user", target_id: ids.buyer, status: "open" })
      .select("id")
      .single();
    assert.equal(created.error, null);
    caseId = created.data!.id as string;

    const grant = await admin
      .from("user_roles")
      .upsert(
        { user_id: ids.breederPending, role: "moderator", status: "active" },
        { onConflict: "user_id,role" },
      );
    assert.equal(grant.error, null);
  });

  await t.test("two concurrent claims: exactly one succeeds", async () => {
    const secondModerator = await as("breederPending");
    const [callA, callB] = await Promise.all([
      admin.rpc("claim_moderation_case", { p_case_id: caseId! }),
      secondModerator.rpc("claim_moderation_case", { p_case_id: caseId! }),
    ]);
    const outcomes = [callA, callB];
    const succeeded = outcomes.filter((r) => r.error === null);
    const failed = outcomes.filter((r) => r.error !== null);
    assert.equal(succeeded.length, 1, "expected exactly one concurrent claim to win the race");
    assert.equal(failed.length, 1);
  });

  await t.test("cleanup", async () => {
    await admin.from("moderation_cases").delete().eq("id", caseId!);
    await admin
      .from("user_roles")
      .delete()
      .eq("user_id", ids.breederPending)
      .eq("role", "moderator");
  });
});
