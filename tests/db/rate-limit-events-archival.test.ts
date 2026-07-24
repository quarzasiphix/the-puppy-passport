// Stage BU (supplemental queue): archival (20260101010900_rate_limit_events_archival.sql).
// enforce_rate_limit() now opportunistically deletes the *calling actor's own* stale rows for the
// *same action_key* every time it runs, before counting -- the pruning the original Stage J
// migration's own comment already proposed but never actually wrote. Proven here using a very
// short custom window passed directly to enforce_rate_limit() (it's a real, directly callable RPC,
// not restricted to the hardcoded windows its other callers use) rather than backdating rows --
// this test suite has no service-role/direct-SQL path available, only the same PostgREST client
// every other test uses, and a tiny real wait is a normal, fast way to prove real time-based
// pruning without needing one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids } from "./helpers.ts";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("enforce_rate_limit: prunes the caller's own stale rows for the same action before counting", async (t) => {
  const customer = await as("customer");
  const admin = await as("admin");
  const actionKey = `archival_probe_${Date.now()}`;

  await t.test("a call with no prior rows just records one row", async () => {
    const call = await customer.rpc("enforce_rate_limit", {
      p_action_key: actionKey,
      p_max_count: 1000,
      p_window: "100 milliseconds",
    });
    assert.equal(call.error, null);

    const rows = await admin
      .from("rate_limit_events")
      .select("id")
      .eq("actor_profile_id", ids.customer)
      .eq("action_key", actionKey);
    assert.equal(rows.error, null);
    assert.equal(rows.data?.length, 1);
  });

  await t.test(
    "a second call inside the same window adds a row, doesn't prune the first",
    async () => {
      const call = await customer.rpc("enforce_rate_limit", {
        p_action_key: actionKey,
        p_max_count: 1000,
        p_window: "100 milliseconds",
      });
      assert.equal(call.error, null);

      const rows = await admin
        .from("rate_limit_events")
        .select("id")
        .eq("actor_profile_id", ids.customer)
        .eq("action_key", actionKey);
      assert.equal(rows.error, null);
      assert.equal(rows.data?.length, 2, "both rows are still inside the 100ms window");
    },
  );

  await t.test(
    "once the window has genuinely elapsed, the next call prunes the stale rows first",
    async () => {
      await sleep(250);

      const call = await customer.rpc("enforce_rate_limit", {
        p_action_key: actionKey,
        p_max_count: 1000,
        p_window: "100 milliseconds",
      });
      assert.equal(call.error, null);

      const rows = await admin
        .from("rate_limit_events")
        .select("id")
        .eq("actor_profile_id", ids.customer)
        .eq("action_key", actionKey);
      assert.equal(rows.error, null);
      assert.equal(
        rows.data?.length,
        1,
        "the two stale rows were pruned; only this new call's row remains",
      );
    },
  );

  await t.test(
    "pruning is scoped to this actor+action only -- other actors/actions are untouched",
    async () => {
      const otherActionKey = `${actionKey}_other`;
      const buyer = await as("buyer");

      // A different action_key for the same actor, and the same action_key for a different actor --
      // neither should ever be touched by the probe calls above.
      await customer.rpc("enforce_rate_limit", {
        p_action_key: otherActionKey,
        p_max_count: 1000,
        p_window: "1 hour",
      });
      await buyer.rpc("enforce_rate_limit", {
        p_action_key: actionKey,
        p_max_count: 1000,
        p_window: "1 hour",
      });

      await sleep(250);
      await customer.rpc("enforce_rate_limit", {
        p_action_key: actionKey,
        p_max_count: 1000,
        p_window: "100 milliseconds",
      });

      const otherActionRows = await admin
        .from("rate_limit_events")
        .select("id")
        .eq("actor_profile_id", ids.customer)
        .eq("action_key", otherActionKey);
      assert.equal(
        otherActionRows.data?.length,
        1,
        "a different action_key for the same actor is untouched",
      );

      const otherActorRows = await admin
        .from("rate_limit_events")
        .select("id")
        .eq("actor_profile_id", ids.buyer)
        .eq("action_key", actionKey);
      assert.equal(
        otherActorRows.data?.length,
        1,
        "the same action_key for a different actor is untouched",
      );
    },
  );

  // No cleanup step: rate_limit_events only ever grants SELECT to authenticated (by design, see
  // 20260101008200) -- not even admin can DELETE a row directly, only enforce_rate_limit()'s own
  // internal delete (running as the function owner, not through the authenticated role's grants)
  // ever removes one. This matches the table's own established behaviour throughout this session's
  // very long run: dozens of `test_action_*` probe rows from earlier stages' tests already sit in
  // this table permanently, harmlessly, for exactly this reason -- this stage's own fix is what
  // will eventually prune these too, the next time (if ever) the same actor+action_key pair recurs.
});
