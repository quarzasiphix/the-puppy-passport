// Stage CJH (third/fourth supplemental queue): legal-hold mechanism
// (20260101011500_legal_holds.sql). place_legal_hold()/release_legal_hold() are admin-only,
// server-stamp the real actor, and an active hold now blocks execute_account_deletion() (Stage AI)
// the exact same way an unresolved business obligation already does. No UI exists to place a hold
// yet -- explicitly requested by name in this queue regardless (the same precedent as Stage
// BL-addendum's support cases); this proves the backend contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { as, ids } from "./helpers.ts";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

test("place_legal_hold/release_legal_hold: admin-only, server-stamped actor", async (t) => {
  const admin = await as("admin");
  const ops = await as("ops");
  let holdId: string | undefined;

  await t.test("a non-admin (even ops staff) cannot place a legal hold", async () => {
    const attempt = await ops.rpc("place_legal_hold", {
      p_subject_profile_id: ids.customer,
      p_reason: "Unauthorised attempt.",
    });
    assert.ok(attempt.error, "expected only an admin to be able to place a hold");
  });

  await t.test("an admin places a real hold", async () => {
    const call = await admin.rpc("place_legal_hold", {
      p_subject_profile_id: ids.customer,
      p_reason: "Stage CJH test hold.",
    });
    assert.equal(call.error, null);
    holdId = call.data as string;
    assert.ok(holdId);

    const row = await admin
      .from("legal_holds")
      .select("subject_profile_id, reason, placed_by, released_at")
      .eq("id", holdId)
      .single();
    assert.equal(row.error, null);
    assert.equal(row.data?.subject_profile_id, ids.customer);
    assert.equal(
      row.data?.placed_by,
      ids.admin,
      "the real caller must be server-stamped, never forgeable",
    );
    assert.equal(row.data?.released_at, null);
  });

  await t.test("a non-admin cannot release it", async () => {
    const attempt = await ops.rpc("release_legal_hold", { p_hold_id: holdId! });
    assert.ok(attempt.error, "expected only an admin to be able to release a hold");
  });

  await t.test(
    "an admin releases it; the row survives, marked released, never deleted",
    async () => {
      const call = await admin.rpc("release_legal_hold", {
        p_hold_id: holdId!,
        p_release_reason: "Test cleanup.",
      });
      assert.equal(call.error, null);

      const row = await admin
        .from("legal_holds")
        .select("released_at, released_by, release_reason")
        .eq("id", holdId!)
        .single();
      assert.equal(row.error, null);
      assert.ok(row.data?.released_at, "the hold row must still exist, marked released");
      assert.equal(row.data?.released_by, ids.admin);
      assert.equal(row.data?.release_reason, "Test cleanup.");
    },
  );

  await t.test("releasing an already-released hold is rejected, not silently no-op", async () => {
    const attempt = await admin.rpc("release_legal_hold", { p_hold_id: holdId! });
    assert.ok(attempt.error, "expected a clear error, not a silent no-op, for a double release");
  });
});

test("execute_account_deletion: refuses while an active legal hold exists", async (t) => {
  const admin = await as("admin");
  const disposableClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  let disposableId: string | undefined;
  let requestId: string | undefined;
  let holdId: string | undefined;

  await t.test("setup: a fresh throwaway account requests its own deletion", async () => {
    const email = `legal-hold-test-${Date.now()}@havenpaw.test`;
    const signUp = await disposableClient.auth.signUp({ email, password: "password123" });
    assert.equal(signUp.error, null);
    disposableId = signUp.data.user?.id;
    assert.ok(disposableId);

    const request = await disposableClient
      .from("account_deletion_requests")
      .insert({ profile_id: disposableId, reason: "CJH stage test" })
      .select("id")
      .single();
    assert.equal(request.error, null);
    requestId = request.data!.id as string;
  });

  await t.test("an admin places a legal hold on this disposable account", async () => {
    const call = await admin.rpc("place_legal_hold", {
      p_subject_profile_id: disposableId!,
      p_reason: "Under investigation (test).",
    });
    assert.equal(call.error, null);
    holdId = call.data as string;
  });

  await t.test("execute_account_deletion is refused while the hold is active", async () => {
    const attempt = await admin.rpc("execute_account_deletion", { p_request_id: requestId! });
    assert.ok(attempt.error, "expected the deletion to be blocked by the active legal hold");
    assert.match(attempt.error!.message, /legal hold/);
  });

  await t.test("releasing the hold allows the deletion to proceed", async () => {
    const release = await admin.rpc("release_legal_hold", { p_hold_id: holdId! });
    assert.equal(release.error, null);

    const call = await admin.rpc("execute_account_deletion", { p_request_id: requestId! });
    assert.equal(call.error, null, "the deletion must now succeed once the hold is released");
  });
});
