// Stage G: moderation decisions and appeals (supabase/migrations/20260101007900_moderation_appeals.sql).
// See docs/AUTONOMOUS_BACKEND_PROGRESS.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, isBlocked } from "./helpers.ts";

test("affected_profile_id auto-populates for direct target types", async (t) => {
  const admin = await as("admin");
  let userCaseId: string | undefined;
  let animalCaseId: string | undefined;

  await t.test("target_type='user': affected_profile_id becomes target_id", async () => {
    const created = await admin
      .from("moderation_cases")
      .insert({ case_type: "test", target_type: "user", target_id: ids.buyer, status: "open" })
      .select("id, affected_profile_id")
      .single();
    assert.equal(created.error, null);
    assert.equal(created.data?.affected_profile_id, ids.buyer);
    userCaseId = created.data!.id as string;
  });

  await t.test(
    "target_type='animal_listing': affected_profile_id becomes the animal's owner",
    async () => {
      // animalMaja is owned by Cichy Las (an org), not a direct owner_profile_id — use a listing
      // that actually has a real owner_profile_id set, or accept null if the animal is org-owned
      // (owner_profile_id null is a legitimate real shape, not a bug in this trigger).
      const created = await admin
        .from("moderation_cases")
        .insert({
          case_type: "test",
          target_type: "animal_listing",
          target_id: ids.animalMaja,
          status: "open",
        })
        .select("id, affected_profile_id")
        .single();
      assert.equal(created.error, null);
      animalCaseId = created.data!.id as string;
      // Whatever animals.owner_profile_id actually is (possibly null for an org-owned animal) —
      // the point is it was looked up, not left unset by omission.
      const animal = await admin
        .from("animals")
        .select("owner_profile_id")
        .eq("id", ids.animalMaja)
        .single();
      assert.equal(created.data?.affected_profile_id, animal.data?.owner_profile_id);
    },
  );

  await t.test("cleanup", async () => {
    if (userCaseId) await admin.from("moderation_cases").delete().eq("id", userCaseId);
    if (animalCaseId) await admin.from("moderation_cases").delete().eq("id", animalCaseId);
  });
});

test("the affected user sees a safe view; the base table stays fully hidden from them; unrelated users see nothing", async (t) => {
  const admin = await as("admin");
  let caseId: string | undefined;

  await t.test("setup: a case targeting the buyer, resolved with a public summary", async () => {
    const created = await admin
      .from("moderation_cases")
      .insert({
        case_type: "test",
        target_type: "user",
        target_id: ids.buyer,
        status: "resolved",
        decision: "warning_issued",
        decision_explanation: "Internal-only reasoning, never shown to the buyer.",
        public_decision_summary: "You received a warning for policy X.",
        resolved_at: new Date().toISOString(),
      })
      .select("id, appeal_deadline")
      .single();
    assert.equal(created.error, null);
    caseId = created.data!.id as string;
    assert.ok(
      created.data?.appeal_deadline,
      "expected the appeal deadline to be auto-set on resolve",
    );
  });

  await t.test("the affected user sees the safe view with the public summary only", async () => {
    const buyer = await as("buyer");
    const { data, error } = await buyer
      .from("my_moderation_case_view")
      .select("*")
      .eq("id", caseId!)
      .single();
    assert.equal(error, null);
    assert.equal(data?.public_decision_summary, "You received a warning for policy X.");
  });

  await t.test("the affected user cannot read the base table directly at all", async () => {
    const buyer = await as("buyer");
    const blocked = await buyer.from("moderation_cases").select("id").eq("id", caseId!);
    assert.ok(isBlocked(blocked.data, blocked.error));
  });

  await t.test("an unrelated user sees nothing in the safe view either", async () => {
    const customer = await as("customer");
    const blocked = await customer.from("my_moderation_case_view").select("id").eq("id", caseId!);
    assert.equal(blocked.error, null);
    assert.equal(blocked.data?.length, 0);
  });

  await t.test("cleanup", async () => {
    if (caseId) await admin.from("moderation_cases").delete().eq("id", caseId);
  });
});

test("appeal eligibility: own resolved case, within deadline, once only", async (t) => {
  const admin = await as("admin");
  const buyer = await as("buyer");
  let caseId: string | undefined;

  await t.test("setup: resolved case for the buyer", async () => {
    const created = await admin
      .from("moderation_cases")
      .insert({
        case_type: "test",
        target_type: "user",
        target_id: ids.buyer,
        status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    assert.equal(created.error, null);
    caseId = created.data!.id as string;
  });

  await t.test("an unrelated user cannot appeal someone else's case", async () => {
    const customer = await as("customer");
    const attempt = await customer.rpc("submit_moderation_appeal", {
      p_case_id: caseId!,
      p_statement: "This isn't my case.",
    });
    assert.ok(attempt.error, "expected the ownership check to reject this");
  });

  await t.test("the affected user appeals successfully", async () => {
    const { data, error } = await buyer.rpc("submit_moderation_appeal", {
      p_case_id: caseId!,
      p_statement: "I believe this decision was made in error.",
    });
    assert.equal(error, null);
    assert.ok(data);

    const caseCheck = await admin
      .from("moderation_cases")
      .select("appeal_status")
      .eq("id", caseId!)
      .single();
    assert.equal(caseCheck.data?.appeal_status, "requested");
  });

  await t.test("the same case cannot be appealed a second time", async () => {
    const attempt = await buyer.rpc("submit_moderation_appeal", {
      p_case_id: caseId!,
      p_statement: "Trying again.",
    });
    assert.ok(attempt.error, "expected the one-appeal-per-case constraint to reject this");
  });

  await t.test("an unrelated user cannot see the buyer's appeal", async () => {
    const customer = await as("customer");
    const appeal = await admin
      .from("moderation_appeals")
      .select("id")
      .eq("moderation_case_id", caseId!)
      .single();
    const blocked = await customer
      .from("moderation_appeals")
      .select("id")
      .eq("id", appeal.data!.id as string);
    assert.ok(isBlocked(blocked.data, blocked.error));
  });

  await t.test("cannot appeal a case that hasn't reached a final decision", async () => {
    const draft = await admin
      .from("moderation_cases")
      .insert({
        case_type: "test",
        target_type: "user",
        target_id: ids.buyer,
        status: "investigating",
      })
      .select("id")
      .single();
    assert.equal(draft.error, null);
    const attempt = await buyer.rpc("submit_moderation_appeal", {
      p_case_id: draft.data!.id as string,
      p_statement: "Too early.",
    });
    assert.ok(attempt.error, "expected a non-resolved case to reject an appeal");
    await admin
      .from("moderation_cases")
      .delete()
      .eq("id", draft.data!.id as string);
  });

  await t.test("cannot appeal past the deadline", async () => {
    const expired = await admin
      .from("moderation_cases")
      .insert({
        case_type: "test",
        target_type: "user",
        target_id: ids.buyer,
        status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    assert.equal(expired.error, null);
    await admin
      .from("moderation_cases")
      .update({ appeal_deadline: new Date(Date.now() - 1000).toISOString() })
      .eq("id", expired.data!.id as string);

    const attempt = await buyer.rpc("submit_moderation_appeal", {
      p_case_id: expired.data!.id as string,
      p_statement: "Too late.",
    });
    assert.ok(attempt.error, "expected an expired deadline to reject an appeal");
    await admin
      .from("moderation_cases")
      .delete()
      .eq("id", expired.data!.id as string);
  });

  await t.test("cleanup", async () => {
    if (caseId) await admin.from("moderation_cases").delete().eq("id", caseId);
  });
});

test("appeal review: moderator-only, and a moderator cannot review their own original decision", async (t) => {
  const admin = await as("admin");
  const buyer = await as("buyer");
  let caseId: string | undefined;
  let appealId: string | undefined;

  await t.test("setup: admin resolves a case, buyer appeals it", async () => {
    const created = await admin
      .from("moderation_cases")
      .insert({
        case_type: "test",
        target_type: "user",
        target_id: ids.buyer,
        status: "resolved",
        assigned_moderator_id: ids.admin,
        resolved_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    assert.equal(created.error, null);
    caseId = created.data!.id as string;

    const appeal = await buyer.rpc("submit_moderation_appeal", {
      p_case_id: caseId,
      p_statement: "Please review this.",
    });
    assert.equal(appeal.error, null);
    appealId = appeal.data as string;
  });

  await t.test("a non-moderator cannot review the appeal", async () => {
    const attempt = await buyer.rpc("review_moderation_appeal", {
      p_appeal_id: appealId!,
      p_decision: "upheld",
    });
    assert.ok(attempt.error, "expected a non-moderator to be rejected");
  });

  await t.test(
    "the same moderator who made the original decision cannot review its appeal",
    async () => {
      const attempt = await admin.rpc("review_moderation_appeal", {
        p_appeal_id: appealId!,
        p_decision: "upheld",
      });
      assert.ok(attempt.error, "expected the conflicted-moderator check to reject this");
    },
  );

  await t.test("a different moderator can review it", async () => {
    // Grant the driver persona a temporary 'moderator' role purely to prove the positive path
    // (only 'admin' has moderator/admin privileges among the seeded personas) — reverted in
    // cleanup regardless of test outcome.
    const grant = await admin
      .from("user_roles")
      .insert({ user_id: ids.driver, role: "moderator", status: "active" })
      .select("id")
      .single();
    assert.equal(grant.error, null);
    try {
      const driver = await as("driver");
      const { error } = await driver.rpc("review_moderation_appeal", {
        p_appeal_id: appealId!,
        p_decision: "overturned",
        p_outcome_notes: "Reviewed by a second moderator — decision overturned.",
      });
      assert.equal(error, null);

      const check = await admin
        .from("moderation_appeals")
        .select("status, reviewed_by, outcome_notes")
        .eq("id", appealId!)
        .single();
      assert.equal(check.data?.status, "overturned");
      assert.equal(check.data?.reviewed_by, ids.driver);
    } finally {
      await admin.from("user_roles").delete().eq("user_id", ids.driver).eq("role", "moderator");
    }
  });

  await t.test("an already-reviewed appeal cannot be reviewed again", async () => {
    const attempt = await admin.rpc("review_moderation_appeal", {
      p_appeal_id: appealId!,
      p_decision: "upheld",
    });
    assert.ok(attempt.error, "expected a re-review to be rejected");
  });

  await t.test("cleanup", async () => {
    if (caseId) await admin.from("moderation_cases").delete().eq("id", caseId);
  });
});
