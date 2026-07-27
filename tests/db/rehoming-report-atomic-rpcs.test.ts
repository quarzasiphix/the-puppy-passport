// Second follow-up to Stage XR-7 (docs/TRANSACTIONAL_WORKFLOW_BOUNDARIES_AUDIT.md):
// approve_rehoming_review() and escalate_report_to_case()
// (20260101013500_rehoming_report_atomic_rpcs.sql) replace 2 more of the 6 documented multi-write
// call sequences with single atomic RPCs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids } from "./helpers.ts";

test("approve_rehoming_review: non-admin rejected, admin approves atomically, idempotent retry", async (t) => {
  const admin = await as("admin");
  const customer = await as("customer");
  let animalId: string | undefined;
  let reviewId: string | undefined;

  await t.test("setup: a private-rehoming animal with a pending review", async () => {
    const animal = await customer
      .from("animals")
      .insert({
        listing_category: "private_rehoming",
        owner_profile_id: ids.customer,
        name: "RPC Approve Test Dog",
        is_published: true,
        availability_status: "draft",
      })
      .select("id")
      .single();
    assert.equal(animal.error, null);
    animalId = animal.data!.id as string;

    const review = await customer
      .from("rehoming_reviews")
      .insert({
        animal_id: animalId,
        owner_profile_id: ids.customer,
        reason_for_rehoming: "RPC test.",
        ownership_declaration: true,
      })
      .select("id")
      .single();
    assert.equal(review.error, null);
    reviewId = review.data!.id as string;
  });

  await t.test("a non-admin cannot approve it", async () => {
    const ops = await as("ops");
    const attempt = await ops.rpc("approve_rehoming_review", { p_review_id: reviewId! });
    assert.ok(attempt.error, "expected only an admin to be able to approve a rehoming review");
  });

  await t.test("a nonexistent review id is rejected", async () => {
    const attempt = await admin.rpc("approve_rehoming_review", {
      p_review_id: "00000000-0000-0000-0000-000000000000",
    });
    assert.ok(attempt.error);
  });

  await t.test("admin approves it: review and animal both update atomically", async () => {
    const call = await admin.rpc("approve_rehoming_review", { p_review_id: reviewId! });
    assert.equal(call.error, null);

    const review = await admin
      .from("rehoming_reviews")
      .select("admin_status, reviewed_at")
      .eq("id", reviewId!)
      .single();
    assert.equal(review.data?.admin_status, "approved");
    assert.ok(review.data?.reviewed_at);

    const animal = await admin
      .from("animals")
      .select("availability_status")
      .eq("id", animalId!)
      .single();
    assert.equal(animal.data?.availability_status, "available");

    // Stage YR-7 (admin command catalogue): approve_rehoming_review() previously left no
    // audit_logs trail at all, unlike its sibling admin-privileged RPCs.
    const audit = await admin
      .from("audit_logs")
      .select("actor_profile_id, action")
      .eq("target_id", reviewId!)
      .eq("action", "rehoming_review.approved")
      .single();
    assert.equal(audit.error, null);
    assert.equal(audit.data?.actor_profile_id, ids.admin);
  });

  await t.test("a retry is idempotent, no error, no duplicate audit entry", async () => {
    const retry = await admin.rpc("approve_rehoming_review", { p_review_id: reviewId! });
    assert.equal(retry.error, null, "an already-approved retry must succeed quietly");

    const auditRows = await admin
      .from("audit_logs")
      .select("id")
      .eq("target_id", reviewId!)
      .eq("action", "rehoming_review.approved");
    assert.equal(
      auditRows.data?.length,
      1,
      "the idempotent retry must not duplicate the audit entry",
    );
  });

  await t.test("cleanup", async () => {
    await admin.from("rehoming_reviews").delete().eq("id", reviewId!);
    await admin.from("animals").delete().eq("id", animalId!);
  });
});

test("escalate_report_to_case: non-moderator rejected, escalates atomically, idempotent retry returns the same case", async (t) => {
  const admin = await as("admin");
  let reportId: string | undefined;
  let caseId: string | undefined;

  await t.test("setup: an open report", async () => {
    const report = await admin
      .from("reports")
      .insert({
        reporter_profile_id: ids.buyer,
        target_type: "organisation",
        target_id: ids.orgWolnaDolina,
        reason: "other",
        description: "Atomic-RPC escalation test report.",
      })
      .select("id, status")
      .single();
    assert.equal(report.error, null);
    assert.equal(report.data?.status, "open");
    reportId = report.data!.id as string;
  });

  await t.test("a non-moderator cannot escalate it", async () => {
    const buyer = await as("buyer");
    const attempt = await buyer.rpc("escalate_report_to_case", { p_report_id: reportId! });
    assert.ok(attempt.error, "expected only a moderator/admin to be able to escalate a report");
  });

  await t.test("a nonexistent report id is rejected", async () => {
    const attempt = await admin.rpc("escalate_report_to_case", {
      p_report_id: "00000000-0000-0000-0000-000000000000",
    });
    assert.ok(attempt.error);
  });

  await t.test(
    "admin escalates it: a real case is created, the report is marked escalated",
    async () => {
      const call = await admin.rpc("escalate_report_to_case", { p_report_id: reportId! });
      assert.equal(call.error, null);
      caseId = call.data as string;
      assert.ok(caseId);

      const report = await admin.from("reports").select("status").eq("id", reportId!).single();
      assert.equal(report.data?.status, "escalated");

      const moderationCase = await admin
        .from("moderation_cases")
        .select("report_id, case_type, status")
        .eq("id", caseId)
        .single();
      assert.equal(moderationCase.data?.report_id, reportId);
      assert.equal(moderationCase.data?.case_type, "report_escalation");
      assert.equal(moderationCase.data?.status, "open");

      // Stage YR-7 (admin command catalogue): escalate_report_to_case() previously left no
      // audit_logs trail at all, unlike its sibling moderator-privileged RPCs.
      const audit = await admin
        .from("audit_logs")
        .select("actor_profile_id, action")
        .eq("target_id", reportId!)
        .eq("action", "report.escalated")
        .single();
      assert.equal(audit.error, null);
      assert.equal(audit.data?.actor_profile_id, ids.admin);
    },
  );

  await t.test("a retry returns the exact same case instead of creating a duplicate", async () => {
    const retry = await admin.rpc("escalate_report_to_case", { p_report_id: reportId! });
    assert.equal(retry.error, null);
    assert.equal(retry.data, caseId, "a retry must return the existing case, not a new one");

    const cases = await admin.from("moderation_cases").select("id").eq("report_id", reportId!);
    assert.equal(cases.data?.length, 1, "no duplicate case must ever be created");

    const auditRows = await admin
      .from("audit_logs")
      .select("id")
      .eq("target_id", reportId!)
      .eq("action", "report.escalated");
    assert.equal(
      auditRows.data?.length,
      1,
      "the idempotent retry must not duplicate the audit entry",
    );
  });

  await t.test("cleanup", async () => {
    await admin.from("moderation_cases").delete().eq("id", caseId!);
    await admin.from("reports").delete().eq("id", reportId!);
  });
});

// Stage YR-15 (raw API bypass audit): escalate_report_to_case()'s own duplicate-prevention check
// only protects callers going through the RPC -- "moderators and admins manage all moderation
// cases" is a real, correct `for all` RLS policy (moderators are fully trusted staff), so a raw
// direct insert bypassing the RPC entirely could previously still create a second case for the
// same report. Closed with a real unique constraint (the strongest enforcement, works regardless
// of which path is used to write) -- this proves the raw-API path specifically, not just the RPC.
test("moderation_cases.report_id: a raw direct insert cannot create a duplicate case for an already-escalated report", async (t) => {
  const admin = await as("admin");
  let reportId: string | undefined;
  let firstCaseId: string | undefined;

  await t.test("setup: a report already escalated via the real RPC", async () => {
    const report = await admin
      .from("reports")
      .insert({
        reporter_profile_id: ids.buyer,
        target_type: "organisation",
        target_id: ids.orgWolnaDolina,
        reason: "other",
        description: "YR-15 raw-bypass test report.",
      })
      .select("id")
      .single();
    assert.equal(report.error, null);
    reportId = report.data!.id as string;

    const escalate = await admin.rpc("escalate_report_to_case", { p_report_id: reportId });
    assert.equal(escalate.error, null);
    firstCaseId = escalate.data as string;
  });

  await t.test(
    "a raw direct insert for the same report_id is rejected by the database itself",
    async () => {
      const attempt = await admin
        .from("moderation_cases")
        .insert({
          report_id: reportId!,
          case_type: "report_escalation",
          target_type: "organisation",
          target_id: ids.orgWolnaDolina,
          status: "open",
        })
        .select();
      assert.ok(attempt.error, "expected the unique constraint to reject a duplicate raw insert");

      const cases = await admin.from("moderation_cases").select("id").eq("report_id", reportId!);
      assert.equal(cases.data?.length, 1, "still exactly one case, the original from the RPC");
      assert.equal(cases.data?.[0]?.id, firstCaseId);
    },
  );

  await t.test("cleanup", async () => {
    await admin.from("moderation_cases").delete().eq("report_id", reportId!);
    await admin.from("reports").delete().eq("id", reportId!);
  });
});
