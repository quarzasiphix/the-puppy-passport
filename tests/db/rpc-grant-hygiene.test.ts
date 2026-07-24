// Stage BR (supplemental queue): API contracts / RPC grant hygiene
// (20260101010800_rpc_grant_hygiene.sql). Four RPCs (approve_user_verification, get_my_profile,
// start_application_conversation, start_transport_conversation) relied solely on an internal
// auth.uid()/role check, never an explicit `revoke all ... from public` -- Postgres grants EXECUTE
// to PUBLIC by default on every new function, so a later `grant ... to authenticated` alone never
// actually revokes the anon role's implicit access. Functionally safe either way (every internal
// check already rejects a null/non-admin caller unconditionally), but this proves the *added*
// defense-in-depth layer really does reject at the grant level now, matching the same pattern
// already proven for get_invitation_by_token/claim_moderation_case/etc.
import { test } from "node:test";
import assert from "node:assert/strict";
import { anon, as } from "./helpers.ts";

test("RPC grant hygiene: an anonymous caller cannot execute any of the four newly-hardened RPCs", async (t) => {
  await t.test("approve_user_verification is unreachable by anon", async () => {
    const attempt = await anon().rpc("approve_user_verification", {
      p_verification_id: "00000000-0000-0000-0000-000000000000",
    });
    assert.ok(attempt.error, "expected anon to be rejected before the function body even runs");
  });

  await t.test("get_my_profile is unreachable by anon", async () => {
    const attempt = await anon().rpc("get_my_profile");
    assert.ok(attempt.error, "expected anon to be rejected");
  });

  await t.test("start_application_conversation is unreachable by anon", async () => {
    const attempt = await anon().rpc("start_application_conversation", {
      p_animal_id: "00000000-0000-0000-0000-000000000000",
      p_buyer_id: "00000000-0000-0000-0000-000000000000",
    });
    assert.ok(attempt.error, "expected anon to be rejected");
  });

  await t.test("start_transport_conversation is unreachable by anon", async () => {
    const attempt = await anon().rpc("start_transport_conversation", {
      p_transport_request_id: "00000000-0000-0000-0000-000000000000",
    });
    assert.ok(attempt.error, "expected anon to be rejected");
  });
});

test("RPC grant hygiene: a real authenticated (non-admin) caller can still reach these RPCs and gets the same business-logic rejection as before", async (t) => {
  const customer = await as("customer");

  await t.test(
    "approve_user_verification: non-admin still correctly rejected, but reaches the function body",
    async () => {
      const attempt = await customer.rpc("approve_user_verification", {
        p_verification_id: "00000000-0000-0000-0000-000000000000",
      });
      assert.ok(attempt.error);
      assert.match(attempt.error!.message, /only admins can approve verifications/);
    },
  );

  await t.test(
    "get_my_profile: an authenticated user still gets their own profile back",
    async () => {
      const result = await customer.rpc("get_my_profile");
      assert.equal(result.error, null);
      assert.ok(result.data, "expected the real profile row, not a rejection");
    },
  );
});
