// Stage CJP (third/fourth supplemental queue): rate-limit configuration
// (20260101011900_support_case_rate_limits.sql). support_cases/support_case_messages had no rate
// limit at all -- the exact "reachable, unlimited" shape Stage J already closed for
// reports/messages/welfare cases/applications, just never checked for this newer table. Both new
// triggers reuse the existing enforce_rate_limit() (server-derived actor, deterministic window,
// stable error) -- these tests prove the trigger genuinely fires on the real table, not just that
// the underlying RPC works (already proven by tests/db/rate-limit-events-archival.test.ts).
//
// Filling the bucket directly via enforce_rate_limit() (already a directly-callable RPC) is far
// faster than actually inserting 60 real support cases, and -- critically -- uses a disposable
// throwaway account so it can never exhaust the shared `customer`/`admin` personas' real quota for
// this same action_key, which tests/db/support-cases.test.ts (running in the same non-reset suite)
// relies on staying available.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { as } from "./helpers.ts";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

async function disposableAccount(): Promise<{
  client: ReturnType<typeof createClient>;
  id: string;
}> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const email = `cjp-rate-limit-test-${Date.now()}-${Math.random().toString(36).slice(2)}@anemalo.test`;
  const signUp = await client.auth.signUp({ email, password: "password123" });
  assert.equal(signUp.error, null);
  const id = signUp.data.user?.id;
  assert.ok(id);
  return { client, id: id! };
}

test("support_cases: creation is rate-limited", async (t) => {
  const admin = await as("admin");
  let account: { client: ReturnType<typeof createClient>; id: string };

  await t.test("setup: a disposable account", async () => {
    account = await disposableAccount();
  });

  await t.test("an ordinary case creation succeeds (not blocked by default)", async () => {
    const call = await account.client
      .from("support_cases")
      .insert({ requester_profile_id: account.id, subject: "CJP rate-limit test case 1" })
      .select("id")
      .single();
    assert.equal(call.error, null);
  });

  await t.test(
    "filling the bucket to the configured limit (60/hour) blocks the next attempt",
    async () => {
      // Already consumed 1 slot above; fill the remaining 59 directly via enforce_rate_limit() --
      // far faster than 59 real inserts, and exercises the exact same actor+action_key+window the
      // trigger itself uses, so the real insert below genuinely tests the trigger's own rejection.
      for (let i = 0; i < 59; i++) {
        const fill = await account.client.rpc("enforce_rate_limit", {
          p_action_key: "support_case_creation",
          p_max_count: 60,
          p_window: "1 hour",
        });
        assert.equal(fill.error, null, `fill call ${i} must succeed while under the limit`);
      }

      const blocked = await account.client
        .from("support_cases")
        .insert({
          requester_profile_id: account.id,
          subject: "CJP rate-limit test case (should be blocked)",
        })
        .select("id");
      assert.ok(blocked.error, "the 61st support case creation in the window must be rejected");
      assert.match(blocked.error!.message, /too many times/i);
    },
  );

  await t.test("cleanup: remove the one real case this test created", async () => {
    const deleted = await admin
      .from("support_cases")
      .delete()
      .eq("requester_profile_id", account.id);
    assert.equal(deleted.error, null);
  });
});

test("support_case_messages: sending is rate-limited", async (t) => {
  const admin = await as("admin");
  let account: { client: ReturnType<typeof createClient>; id: string };
  let caseId: string | undefined;

  await t.test("setup: a disposable account with a real support case", async () => {
    account = await disposableAccount();
    const created = await account.client
      .from("support_cases")
      .insert({ requester_profile_id: account.id, subject: "CJP message rate-limit test" })
      .select("id")
      .single();
    assert.equal(created.error, null);
    caseId = created.data!.id as string;
  });

  await t.test("an ordinary message succeeds (not blocked by default)", async () => {
    const call = await account.client
      .from("support_case_messages")
      .insert({ case_id: caseId!, sender_profile_id: account.id, body: "Hello, message 1." });
    assert.equal(call.error, null);
  });

  await t.test(
    "filling the bucket to the configured limit (30/minute) blocks the next attempt",
    async () => {
      for (let i = 0; i < 29; i++) {
        const fill = await account.client.rpc("enforce_rate_limit", {
          p_action_key: "support_case_message_send",
          p_max_count: 30,
          p_window: "1 minute",
        });
        assert.equal(fill.error, null, `fill call ${i} must succeed while under the limit`);
      }

      const blocked = await account.client.from("support_case_messages").insert({
        case_id: caseId!,
        sender_profile_id: account.id,
        body: "Message 31 (should be blocked).",
      });
      assert.ok(blocked.error, "the 31st message in one minute must be rejected");
      assert.match(blocked.error!.message, /too many times/i);
    },
  );

  await t.test("cleanup: remove the disposable case (messages cascade)", async () => {
    const deleted = await admin.from("support_cases").delete().eq("id", caseId!);
    assert.equal(deleted.error, null);
  });
});
