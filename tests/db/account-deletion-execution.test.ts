// Stage AI (supplemental queue): deletion/anonymisation execution
// (20260101009500_account_deletion_execution.sql). Closes the gap first flagged in Stage O
// (docs/PRIVACY_DATA_LIFECYCLE.md): markDeletionRequestProcessed("processed") used to only flip a
// status flag, never actually anonymising anything. execute_account_deletion() now does the real
// work: anonymise the profile row (never a hard delete -- Stage L's audit already established
// audit-trail FK columns have no ON DELETE action), refuse while a real unresolved obligation
// exists, and mark the request processed atomically.
//
// The successful-anonymisation path is deliberately tested against a throwaway signed-up user
// (anon().auth.signUp(), email confirmation disabled locally per supabase/config.toml), never
// against any of the ~10 shared seeded personas this whole suite reuses -- actually anonymising a
// shared persona would corrupt it for every later test file in the same run, the exact "don't
// exhaust a shared scarce resource" lesson from Stage J. The blocker tests below are safe against
// shared personas because they only ever prove *rejection*, never mutate anything.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { as, ids } from "./helpers.ts";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

test("execute_account_deletion: real anonymisation, on a disposable throwaway account", async (t) => {
  const admin = await as("admin");
  let disposableId: string | undefined;
  let requestId: string | undefined;
  const disposableClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  await t.test("setup: a fresh throwaway account requests its own deletion", async () => {
    const email = `deletion-test-${Date.now()}@havenpaw.test`;
    const signUp = await disposableClient.auth.signUp({ email, password: "password123" });
    assert.equal(signUp.error, null);
    disposableId = signUp.data.user?.id;
    assert.ok(disposableId, "expected a real new auth user id");

    const request = await disposableClient
      .from("account_deletion_requests")
      .insert({ profile_id: disposableId, reason: "AI stage test" })
      .select("id")
      .single();
    assert.equal(request.error, null);
    requestId = request.data!.id as string;
  });

  await t.test("a non-admin cannot execute the deletion", async () => {
    const attempt = await disposableClient.rpc("execute_account_deletion", {
      p_request_id: requestId!,
    });
    assert.ok(attempt.error, "expected only an admin to be able to execute a deletion");
  });

  await t.test("admin executes it: profile anonymised, request marked processed", async () => {
    const call = await admin.rpc("execute_account_deletion", { p_request_id: requestId! });
    assert.equal(call.error, null);

    // email/phone are never selectable via the ordinary REST path, not even for admin (see
    // 20260101003200_profiles_contact_lockdown.sql) -- display_name/avatar_url/is_deleted/
    // deleted_at are the columns actually visible this way, and are sufficient to prove
    // anonymisation happened.
    const profile = await admin
      .from("profiles")
      .select("display_name, avatar_url, is_deleted, deleted_at")
      .eq("id", disposableId!)
      .single();
    assert.equal(profile.error, null);
    assert.equal(profile.data?.is_deleted, true);
    assert.ok(profile.data?.deleted_at);
    assert.equal(profile.data?.display_name, null);
    assert.equal(profile.data?.avatar_url, null);

    // Confirm email/phone are cleared too, via the one sanctioned own-row path -- but this
    // profile's own auth session was only used for setup and its client was never kept signed in
    // for this assertion, so instead confirm indirectly: get_my_profile() is hard-coded to
    // auth.uid(), so re-signing in as the disposable account and calling it proves the real
    // stored value without this test needing its own privileged read path.
    const stillSignedIn = await disposableClient.rpc("get_my_profile");
    assert.equal(stillSignedIn.error, null);
    assert.equal(stillSignedIn.data?.email, null);
    assert.equal(stillSignedIn.data?.phone, null);

    const request = await admin
      .from("account_deletion_requests")
      .select("status, processed_by")
      .eq("id", requestId!)
      .single();
    assert.equal(request.error, null);
    assert.equal(request.data?.status, "processed");
    assert.equal(request.data?.processed_by, ids.admin);

    const audit = await admin
      .from("audit_logs")
      .select("action, actor_profile_id")
      .eq("target_id", disposableId!)
      .eq("action", "account_deletion.executed")
      .single();
    assert.equal(audit.error, null);
    assert.equal(audit.data?.actor_profile_id, ids.admin);
  });

  await t.test("the same request cannot be processed a second time", async () => {
    const again = await admin.rpc("execute_account_deletion", { p_request_id: requestId! });
    assert.ok(again.error, "expected an already-processed request to be rejected");
  });
});

test("execute_account_deletion: refuses while a real unresolved obligation exists", async (t) => {
  const admin = await as("admin");

  await t.test("blocked by an active transport request", async () => {
    const request = await admin
      .from("account_deletion_requests")
      .insert({ profile_id: ids.customer, reason: "blocker test" })
      .select("id")
      .single();
    assert.equal(request.error, null);
    const requestId = request.data!.id as string;

    const attempt = await admin.rpc("execute_account_deletion", { p_request_id: requestId });
    assert.ok(
      attempt.error,
      "expected the customer's active seeded transport request to block deletion",
    );

    await admin.from("account_deletion_requests").delete().eq("id", requestId);
  });

  await t.test("blocked by organisation ownership", async () => {
    const request = await admin
      .from("account_deletion_requests")
      .insert({ profile_id: ids.breeder1, reason: "blocker test" })
      .select("id")
      .single();
    assert.equal(request.error, null);
    const requestId = request.data!.id as string;

    const attempt = await admin.rpc("execute_account_deletion", { p_request_id: requestId });
    assert.ok(attempt.error, "expected breeder1's Cichy Las ownership to block deletion");

    await admin.from("account_deletion_requests").delete().eq("id", requestId);
  });

  await t.test("a nonexistent deletion request id is rejected", async () => {
    const attempt = await admin.rpc("execute_account_deletion", {
      p_request_id: "00000000-0000-0000-0000-000000000000",
    });
    assert.ok(attempt.error);
  });
});
