// Stage CJI (third/fourth supplemental queue): deletion-blocker graph
// (20260101011600_deletion_blocker_graph.sql). execute_account_deletion() only ever reports the
// first blocker it finds; get_account_deletion_blockers() is the read-only, admin-only preview of
// every real blocker that currently applies -- proves it returns multiple blockers at once, not
// just one, and stays admin-gated.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, freshClient, ids, createTestTransportRequest, uniqueTestEmail } from "./helpers.ts";

test("get_account_deletion_blockers: admin-only, reports every applicable blocker at once", async (t) => {
  const admin = await as("admin");
  const ops = await as("ops");
  const disposableClient = freshClient();
  let disposableId: string | undefined;
  let requestId: string | undefined;
  let holdId: string | undefined;

  await t.test("a non-admin cannot call this", async () => {
    const attempt = await ops.rpc("get_account_deletion_blockers", { p_profile_id: ids.customer });
    assert.ok(attempt.error, "expected only an admin to be able to inspect blockers");
  });

  await t.test("a genuinely unblocked disposable account has zero blockers", async () => {
    const email = uniqueTestEmail("blockers-test");
    const signUp = await disposableClient.auth.signUp({ email, password: "password123" });
    assert.equal(signUp.error, null);
    disposableId = signUp.data.user?.id;
    assert.ok(disposableId);

    const blockers = await admin.rpc("get_account_deletion_blockers", {
      p_profile_id: disposableId!,
    });
    assert.equal(blockers.error, null);
    assert.equal(blockers.data?.length, 0);
  });

  await t.test(
    "adding an active transport request and a legal hold surfaces both at once",
    async () => {
      requestId = await createTestTransportRequest(admin, {
        requesterProfileId: disposableId!,
        tag: "CJI-BLOCKERS",
        status: "submitted",
      });

      const hold = await admin.rpc("place_legal_hold", {
        p_subject_profile_id: disposableId!,
        p_reason: "Stage CJI test hold.",
      });
      assert.equal(hold.error, null);
      holdId = hold.data as string;

      const blockers = await admin.rpc("get_account_deletion_blockers", {
        p_profile_id: disposableId!,
      });
      assert.equal(blockers.error, null);
      const reasons = (blockers.data as { blocker: string }[]).map((b) => b.blocker);
      assert.equal(reasons.length, 2, "both real blockers must be reported together, not just one");
      assert.ok(reasons.includes("an active transport request"));
      assert.ok(reasons.includes("an active legal hold"));
    },
  );

  await t.test("resolving both blockers brings the list back to zero", async () => {
    await admin.from("transport_requests").delete().eq("id", requestId!);
    await admin.rpc("release_legal_hold", { p_hold_id: holdId! });

    const blockers = await admin.rpc("get_account_deletion_blockers", {
      p_profile_id: disposableId!,
    });
    assert.equal(blockers.error, null);
    assert.equal(blockers.data?.length, 0);
  });
});
