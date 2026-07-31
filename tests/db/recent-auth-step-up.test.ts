// Stage CJN (third/fourth supplemental queue): reauthentication ("step-up") hooks
// (20260101011800_recent_auth_step_up.sql). require_recent_auth() reads Supabase GoTrue's real
// JWT `amr` claim (confirmed directly against a real signed-in session before building on it) --
// a silent token refresh never advances it, only a genuine authentication event does. Wired into
// the three rarest, most destructive already-admin-only RPCs named by this stage:
// execute_account_deletion(), place_legal_hold(), release_legal_hold().
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, freshClient, uniqueTestEmail } from "./helpers.ts";

test("require_recent_auth: valid marker, expired marker, missing marker", async (t) => {
  const admin = await as("admin");

  await t.test("a valid, recent marker (generous max_age) passes", async () => {
    // admin's test session was signed in at the start of this suite run (well under any
    // reasonable window) -- a large max_age proves the happy path, not just the rejection path.
    const call = await admin.rpc("require_recent_auth", {
      p_operation: "test.valid",
      p_max_age: "10 years",
    });
    assert.equal(call.error, null, "a genuinely recent authentication must be accepted");
  });

  await t.test("an expired marker (zero-width window) is rejected", async () => {
    // The real elapsed time since sign-in is always >= 0, so a 0-second window deterministically
    // forces the "too old" branch without needing to wait real minutes or forge a JWT.
    const call = await admin.rpc("require_recent_auth", {
      p_operation: "test.expired",
      p_max_age: "0 seconds",
    });
    assert.ok(call.error, "expected a stale-relative-to-window session to be rejected");
    assert.match(call.error!.message, /reauthentication_required/);
  });

  await t.test("a missing marker (no session at all) is rejected, fail-closed", async () => {
    // anon has no execute grant on this function at all (this session's established
    // revoke-from-public / grant-to-authenticated-only convention, Stage BR) -- a real
    // unauthenticated caller is stopped at the grant layer before the function body's own
    // `auth.uid() is null` fail-closed branch ever runs. Defense in depth, not a gap: the same
    // request is rejected either way, just by an earlier line of defense.
    const anon = freshClient();
    const call = await anon.rpc("require_recent_auth", {
      p_operation: "test.no_session",
      p_max_age: "10 years",
    });
    assert.ok(call.error, "an unauthenticated caller must never pass a recent-auth check");
    assert.match(call.error!.message, /permission denied/i);
  });
});

test("wired RPCs: authorization is checked before reauthentication, and a fresh admin session succeeds", async (t) => {
  const admin = await as("admin");
  const ops = await as("ops");
  const disposableClient = freshClient();
  let disposableId: string | undefined;
  let requestId: string | undefined;
  let holdId: string | undefined;

  await t.test("setup: a fresh throwaway account requests its own deletion", async () => {
    const email = uniqueTestEmail("cjn-reauth-test");
    const signUp = await disposableClient.auth.signUp({ email, password: "password123" });
    assert.equal(signUp.error, null);
    disposableId = signUp.data.user?.id;
    assert.ok(disposableId);

    const request = await disposableClient
      .from("account_deletion_requests")
      .insert({ profile_id: disposableId, reason: "CJN stage test" })
      .select("id")
      .single();
    assert.equal(request.error, null);
    requestId = request.data!.id as string;
  });

  await t.test(
    "an unrelated (non-admin) actor gets the authorization error, not a reauth error",
    async () => {
      const holdAttempt = await ops.rpc("place_legal_hold", {
        p_subject_profile_id: disposableId!,
        p_reason: "Unauthorised attempt.",
      });
      assert.ok(holdAttempt.error);
      assert.match(
        holdAttempt.error!.message,
        /Only an admin/,
        "authorization must be checked before reauthentication, so a non-admin never learns the reauth rule exists",
      );

      const deletionAttempt = await ops.rpc("execute_account_deletion", {
        p_request_id: requestId!,
      });
      assert.ok(deletionAttempt.error);
      assert.match(deletionAttempt.error!.message, /Only an admin/);
    },
  );

  await t.test("a genuinely fresh admin session places and releases a legal hold", async () => {
    const place = await admin.rpc("place_legal_hold", {
      p_subject_profile_id: disposableId!,
      p_reason: "CJN reauth test hold.",
    });
    assert.equal(
      place.error,
      null,
      "a fresh admin session must not be blocked by the reauth check",
    );
    holdId = place.data as string;
    assert.ok(holdId);

    const release = await admin.rpc("release_legal_hold", { p_hold_id: holdId! });
    assert.equal(release.error, null);
  });

  await t.test("a genuinely fresh admin session executes the account deletion", async () => {
    const call = await admin.rpc("execute_account_deletion", { p_request_id: requestId! });
    assert.equal(call.error, null, "a fresh admin session must not be blocked by the reauth check");
  });
});
