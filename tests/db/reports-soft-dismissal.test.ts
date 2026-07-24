// Stage CJG (third/fourth supplemental queue): soft-deletion/archival semantics
// (20260101011400_reports_soft_dismissal.sql). dismissReport() (src/lib/queries/moderation.ts)
// used to hard-delete a reports row -- permanently destroying evidence that could matter for
// detecting a real abuse pattern (repeated reports from the same reporter, all dismissed). Reports
// now carry a real status column; dismissal is a status change, not a delete. Ops/admin's raw
// DELETE capability on reports is deliberately left intact at the RLS layer (a report could
// legitimately need real removal in a rare case, e.g. defamatory content) -- only the *normal*
// day-to-day dismiss workflow is now non-destructive by default.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids } from "./helpers.ts";

test("reports: dismissal is a status change, the row survives", async (t) => {
  const buyer = await as("buyer");
  const admin = await as("admin");
  let reportId: string | undefined;

  await t.test("a buyer files a real report", async () => {
    const report = await buyer
      .from("reports")
      .insert({
        reporter_profile_id: ids.buyer,
        target_type: "organisation",
        target_id: ids.orgWolnaDolina,
        reason: "false_breeder_information",
        description: "Stage CJG soft-dismissal test report.",
      })
      .select("id, status")
      .single();
    assert.equal(report.error, null);
    assert.equal(report.data?.status, "open");
    reportId = report.data!.id as string;
  });

  await t.test("an admin dismisses it (status update, matching dismissReport())", async () => {
    const dismissed = await admin
      .from("reports")
      .update({ status: "dismissed" })
      .eq("id", reportId!)
      .select("id, status, description")
      .single();
    assert.equal(dismissed.error, null);
    assert.equal(dismissed.data?.status, "dismissed");
    assert.equal(
      dismissed.data?.description,
      "Stage CJG soft-dismissal test report.",
      "the report content must survive dismissal, not be deleted",
    );
  });

  await t.test("the dismissed report still exists and is readable by staff", async () => {
    const stillThere = await admin
      .from("reports")
      .select("id, status")
      .eq("id", reportId!)
      .single();
    assert.equal(stillThere.error, null);
    assert.equal(stillThere.data?.status, "dismissed");
  });

  await t.test("cleanup", async () => {
    await admin.from("reports").delete().eq("id", reportId!);
  });
});
