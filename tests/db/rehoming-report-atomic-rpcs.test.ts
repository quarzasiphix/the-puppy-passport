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
  });

  await t.test("a retry is idempotent, no error", async () => {
    const retry = await admin.rpc("approve_rehoming_review", { p_review_id: reviewId! });
    assert.equal(retry.error, null, "an already-approved retry must succeed quietly");
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
    },
  );

  await t.test("a retry returns the exact same case instead of creating a duplicate", async () => {
    const retry = await admin.rpc("escalate_report_to_case", { p_report_id: reportId! });
    assert.equal(retry.error, null);
    assert.equal(retry.data, caseId, "a retry must return the existing case, not a new one");

    const cases = await admin.from("moderation_cases").select("id").eq("report_id", reportId!);
    assert.equal(cases.data?.length, 1, "no duplicate case must ever be created");
  });

  await t.test("cleanup", async () => {
    await admin.from("moderation_cases").delete().eq("id", caseId!);
    await admin.from("reports").delete().eq("id", reportId!);
  });
});
