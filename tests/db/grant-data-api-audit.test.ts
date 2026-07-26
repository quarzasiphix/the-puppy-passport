// Stage XR-3 (append-only queue): grant/Data API exposure audit. Cross-referenced every table's
// live `information_schema.role_table_grants` against `pg_policies` (a real query against the
// running local instance, not a static guess) for `anon`/`authenticated` grants with no matching
// RLS policy of that command type -- the "broad grant" half of RLS-vs-grant, the mirror image of
// what `db:preflight`'s check 1 (Stage CA) already catches (a policy with no grant, which 403s).
// Found exactly 2 real table-level cases (excluding several `public_*`/`*_view` views, which are
// correctly grant-only with no `pg_policies` row of their own -- protection comes from the base
// tables their query touches, not a view-level policy, a real limitation of this kind of check
// worth documenting rather than a bug):
//
// 1. `rehoming_reviews` grants `anon` SELECT with zero anon-scoped policy -- confirmed deliberate
//    and documented (20260101003000_rehoming_reviews_anon_grant.sql): `animals`' own public
//    listing policy for anon references `rehoming_reviews` in an EXISTS subquery, and Postgres
//    requires table-level privilege on every table a query plan touches, even inside another
//    table's RLS subquery -- anon genuinely needs the grant just for that subquery to evaluate at
//    all, while RLS on `rehoming_reviews` itself (owner/admin only) still hides every row.
// 2. `audit_logs` grants `authenticated` UPDATE/DELETE (part of a deliberate blanket
//    `select, insert, update, delete` grant applied to ~25 tables at once in
//    20260101002900_table_grants.sql, "RLS remains the actual row-level security boundary; these
//    GRANTs only open the outer gate") with zero UPDATE/DELETE policy for anyone at all --
//    `audit_logs` is meant to be genuinely append-only (docs/DATABASE_INVARIANTS.md already
//    documents this), so the broader grant is inert, not a live gap, but had no direct regression
//    test proving it before this stage.
//
// These tests prove both findings are real and currently safe, and act as the "drift test" this
// stage's own definition asks for: if a future migration ever accidentally added a permissive
// UPDATE/DELETE policy to audit_logs, or genuinely opened rehoming_reviews rows to anon, one of
// these tests would start failing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { anon, as, ids } from "./helpers.ts";

test("audit_logs: the broad authenticated UPDATE/DELETE grant is fully inert -- RLS blocks both for every role", async (t) => {
  const admin = await as("admin");
  let logId: string | undefined;

  await t.test("setup: a real audit_logs row", async () => {
    const created = await admin
      .from("audit_logs")
      .insert({
        actor_profile_id: ids.admin,
        action: "xr3.grant_audit_test",
        target_type: "test",
        target_id: ids.admin,
      })
      .select("id")
      .single();
    assert.equal(created.error, null);
    logId = created.data!.id as string;
  });

  await t.test(
    "even an admin cannot UPDATE an audit_logs row despite the table grant",
    async () => {
      const attempt = await admin
        .from("audit_logs")
        .update({ action: "tampered" })
        .eq("id", logId!)
        .select();
      assert.equal(
        attempt.data?.length ?? 0,
        0,
        "expected zero rows updated (no UPDATE policy exists)",
      );
    },
  );

  await t.test(
    "even an admin cannot DELETE an audit_logs row despite the table grant",
    async () => {
      const attempt = await admin.from("audit_logs").delete().eq("id", logId!).select();
      assert.equal(
        attempt.data?.length ?? 0,
        0,
        "expected zero rows deleted (no DELETE policy exists)",
      );

      const stillThere = await admin.from("audit_logs").select("action").eq("id", logId!).single();
      assert.equal(stillThere.error, null);
      assert.equal(
        stillThere.data?.action,
        "xr3.grant_audit_test",
        "the row must be completely untouched",
      );
    },
  );

  await t.test("cleanup note", () => {
    // Deliberately not deleted -- audit_logs is genuinely append-only (that's the entire point of
    // this test), so there is no real cleanup path; a stray "xr3.grant_audit_test" row is a
    // harmless, correctly-permanent artifact of proving the invariant, the same as every other
    // audit entry this whole session's tests have produced.
  });
});

test("rehoming_reviews: the anon SELECT grant exists only for a cross-table RLS subquery, and leaks nothing directly", async (t) => {
  const admin = await as("admin");
  let reviewId: string | undefined;

  await t.test("setup: a real rehoming_reviews row (via the admin-only ALL policy)", async () => {
    const created = await admin
      .from("rehoming_reviews")
      .insert({
        animal_id: ids.animalMaja,
        owner_profile_id: ids.breeder1,
        reason_for_rehoming: "XR-3 grant audit test.",
        ownership_declaration: true,
      })
      .select("id")
      .single();
    assert.equal(created.error, null);
    reviewId = created.data!.id as string;
  });

  await t.test(
    "anon's SELECT succeeds at the grant level (no permission error) but RLS returns zero rows",
    async () => {
      const attempt = await anon().from("rehoming_reviews").select("id").eq("id", reviewId!);
      assert.equal(attempt.error, null, "the grant must let the query execute, not 403");
      assert.equal(attempt.data?.length, 0, "RLS must still hide the row completely from anon");
    },
  );

  await t.test("cleanup", async () => {
    const deleted = await admin.from("rehoming_reviews").delete().eq("id", reviewId!);
    assert.equal(deleted.error, null);
  });
});
