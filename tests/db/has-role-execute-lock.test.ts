// Stage IR-13 (integration-readiness queue): migration rehearsal.
// 20260101012600_has_role_execute_lock.sql. has_role(p_user_id uuid, p_role platform_role) is the
// only role-check helper in this schema that accepts an arbitrary *other* user's id rather than
// only ever answering about the caller -- unlike is_admin()/is_moderator()/owns_org() etc, which
// were all correctly grant-hardened already. It was never explicitly revoked from PUBLIC, so any
// caller (including anonymous) could call it directly via PostgREST's exposed /rpc/has_role and
// probe whether an arbitrary real profile id currently holds any given platform role -- a role-
// membership enumeration oracle. Every real call site now either routes through another SECURITY
// DEFINER wrapper (is_admin/is_moderator/is_ops_staff/is_my_driver_id/is_assigned_driver_for_
// request/owns_org/the new is_active_driver()) or is has_role() itself with PUBLIC revoked -- the
// migration's own comment documents a real first-draft mistake (two RLS policies called
// has_role() directly, not through a wrapper) caught by running the full suite before committing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { anon, as } from "./helpers.ts";

test("has_role is no longer directly callable by anyone, anon or authenticated", async (t) => {
  await t.test("an anonymous caller cannot call has_role directly", async () => {
    const attempt = await anon().rpc("has_role", {
      p_user_id: "00000000-0000-0000-0000-000000000000",
      p_role: "admin",
    });
    assert.ok(attempt.error, "expected a permission error before the function body even runs");
  });

  await t.test(
    "an ordinary authenticated caller cannot use it to probe another real user's role either",
    async () => {
      const customer = await as("customer");
      const attempt = await customer.rpc("has_role", {
        p_user_id: "00000000-0000-0000-0000-000000000000",
        p_role: "admin",
      });
      assert.ok(
        attempt.error,
        "expected the direct grant to be gone for every role, not just anon",
      );
    },
  );
});

test("internal role checks that call has_role() under the hood still work correctly", async (t) => {
  // is_admin()/is_moderator() are themselves SECURITY DEFINER and call has_role(auth.uid(), ...)
  // internally -- that internal call executes under the wrapper function's own owner privileges,
  // not the invoking role's, so it must be completely unaffected by revoking PUBLIC's direct
  // grant on has_role() itself. Proven end-to-end via the real, directly-callable RPC surface.
  await t.test("is_admin() still correctly reports true for the real admin persona", async () => {
    const admin = await as("admin");
    const result = await admin.rpc("is_admin");
    assert.equal(result.error, null);
    assert.equal(result.data, true);
  });

  await t.test("is_admin() still correctly reports false for an ordinary user", async () => {
    const customer = await as("customer");
    const result = await customer.rpc("is_admin");
    assert.equal(result.error, null);
    assert.equal(result.data, false);
  });

  // is_active_driver() is the new wrapper this migration added specifically to fix the two RLS
  // policies that used to call has_role() directly -- role-suspension-blocks-driver-access itself
  // is already covered end-to-end in tests/db/workflows.test.ts; this just proves the new wrapper
  // is directly callable and correct in isolation, the same shape as the is_admin() checks above.
  await t.test(
    "is_active_driver() correctly reports true for the real driver persona",
    async () => {
      const driver = await as("driver");
      const result = await driver.rpc("is_active_driver");
      assert.equal(result.error, null);
      assert.equal(result.data, true);
    },
  );

  await t.test("is_active_driver() correctly reports false for a non-driver", async () => {
    const customer = await as("customer");
    const result = await customer.rpc("is_active_driver");
    assert.equal(result.error, null);
    assert.equal(result.data, false);
  });
});
