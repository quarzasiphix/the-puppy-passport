// Stage BC (supplemental queue): organisation verification workflow.
// 20260101009700_verification_approval_idempotency.sql closed a real idempotency gap:
// approve_user_verification() had no guard against being called twice on the same verification.
// For breeder/organisation verifications this used to fail messily on a slug collision instead of
// a clean business error; there was also no protection against a genuine concurrent double-
// approval race (two admins, or one admin double-clicking).
//
// Both scenarios use a throwaway signed-up account (the same pattern established in Stage AI's
// account-deletion tests), never the shared breederPending/foundationPending personas -- those are
// read by other test files (workflows.test.ts, access-control.test.ts) as a *given* pending state,
// and this test's own cleanup steps wouldn't run if an earlier assertion failed, risking corrupting
// that shared state for every later test file in the same run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, freshClient, ids } from "./helpers.ts";

async function signUpDisposableUser() {
  const client = freshClient();
  const email = `verification-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@anemalo.test`;
  const signUp = await client.auth.signUp({ email, password: "password123" });
  assert.equal(signUp.error, null);
  const userId = signUp.data.user!.id;
  return { client, userId };
}

test("approve_user_verification: idempotent against a second sequential call", async (t) => {
  const admin = await as("admin");
  let verificationId: string | undefined;
  let orgId: string | undefined;

  await t.test("setup: a disposable breeder submits a real verification request", async () => {
    const { client, userId } = await signUpDisposableUser();
    const ver = await client
      .from("user_verifications")
      .insert({
        user_id: userId,
        verification_type: "breeder",
        status: "pending",
        submitted_data: { org_type: "kennel", name: `BC Test Kennel ${Date.now()}` },
      })
      .select("id")
      .single();
    assert.equal(ver.error, null);
    verificationId = ver.data!.id as string;
  });

  await t.test("the first approval succeeds and creates a real organisation", async () => {
    const call = await admin.rpc("approve_user_verification", {
      p_verification_id: verificationId!,
      p_admin_notes: "BC stage test",
    });
    assert.equal(call.error, null);
    assert.ok(call.data, "expected a real organisation id back");
    orgId = call.data as string;

    // Stage YR-7 (admin command catalogue): approve_user_verification() previously left no
    // audit_logs trail, unlike this schema's other significant trust-decision RPCs.
    const audit = await admin
      .from("audit_logs")
      .select("actor_profile_id, action")
      .eq("target_id", verificationId!)
      .eq("action", "user_verification.approved")
      .single();
    assert.equal(audit.error, null);
    assert.equal(audit.data?.actor_profile_id, ids.admin);
  });

  await t.test(
    "a second approval is rejected with a clean error, not a raw constraint violation",
    async () => {
      const again = await admin.rpc("approve_user_verification", {
        p_verification_id: verificationId!,
        p_admin_notes: "second attempt",
      });
      assert.ok(again.error, "expected the second approval to be rejected");
      assert.match(
        again.error!.message,
        /already been approved/,
        "expected the clean business-logic error, not a raw unique-constraint violation",
      );
    },
  );

  await t.test("exactly one organisation exists for this verification, not two", async () => {
    const orgs = await admin.from("organisations").select("id").eq("id", orgId!);
    assert.equal(orgs.error, null);
    assert.equal(orgs.data?.length, 1);
  });

  await t.test("cleanup", async () => {
    if (orgId) {
      await admin.from("organisation_members").delete().eq("org_id", orgId);
      await admin.from("organisations").delete().eq("id", orgId);
    }
  });
});

test("approve_user_verification: concurrent double-approval resolves to exactly one winner", async (t) => {
  const admin = await as("admin");
  let verificationId: string | undefined;
  let orgId: string | undefined;

  await t.test("setup: another disposable breeder submits a verification request", async () => {
    const { client, userId } = await signUpDisposableUser();
    const ver = await client
      .from("user_verifications")
      .insert({
        user_id: userId,
        verification_type: "breeder",
        status: "pending",
        submitted_data: { org_type: "kennel", name: `BC Race Test Kennel ${Date.now()}` },
      })
      .select("id")
      .single();
    assert.equal(ver.error, null);
    verificationId = ver.data!.id as string;
  });

  await t.test("two concurrent approval calls: exactly one succeeds", async () => {
    const [callA, callB] = await Promise.all([
      admin.rpc("approve_user_verification", { p_verification_id: verificationId! }),
      admin.rpc("approve_user_verification", { p_verification_id: verificationId! }),
    ]);
    const outcomes = [callA, callB];
    const succeeded = outcomes.filter((r) => r.error === null);
    const failed = outcomes.filter((r) => r.error !== null);
    assert.equal(succeeded.length, 1, "expected exactly one concurrent call to win the race");
    assert.equal(failed.length, 1);
    orgId = succeeded[0].data as string;
  });

  await t.test("exactly one organisation exists, even from a true race", async () => {
    const orgs = await admin.from("organisations").select("id").eq("id", orgId!);
    assert.equal(orgs.error, null);
    assert.equal(orgs.data?.length, 1);
  });

  await t.test("cleanup", async () => {
    if (orgId) {
      await admin.from("organisation_members").delete().eq("org_id", orgId);
      await admin.from("organisations").delete().eq("id", orgId);
    }
  });
});
