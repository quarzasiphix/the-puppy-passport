// Stage BL addendum (supplemental queue): support case management
// (20260101010400_support_cases.sql). Covers the concrete required behaviours from the detailed
// spec: server-controlled actor, ownership-scoped access, internal-note privacy (same shape as
// messages.is_internal from Stage R), no self-assignment of staff, atomic claim with audit
// (same shape as claim_moderation_case from Stage BM), and reopen semantics.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, isBlocked } from "./helpers.ts";

test("support_cases: a customer can create and read their own case", async (t) => {
  const customer = await as("customer");
  let caseId: string | undefined;

  await t.test("creating a case server-controls the requester actor", async () => {
    const created = await customer
      .from("support_cases")
      .insert({
        subject: "Can't upload my document",
        category: "transport",
        requester_profile_id: ids.customer,
      })
      .select("id, requester_profile_id, status")
      .single();
    assert.equal(created.error, null);
    assert.equal(created.data?.requester_profile_id, ids.customer);
    assert.equal(created.data?.status, "open");
    caseId = created.data!.id as string;
  });

  await t.test("a customer cannot forge requester_profile_id to someone else", async () => {
    const attempt = await customer
      .from("support_cases")
      .insert({ subject: "Forged actor attempt", requester_profile_id: ids.buyer })
      .select();
    assert.ok(isBlocked(attempt.data, attempt.error));
  });

  await t.test("the customer can read their own case", async () => {
    const seen = await customer.from("support_cases").select("id").eq("id", caseId!).single();
    assert.equal(seen.error, null);
  });

  await t.test("an unrelated user cannot read this case", async () => {
    const buyer = await as("buyer");
    const attempt = await buyer.from("support_cases").select("id").eq("id", caseId!);
    assert.ok(isBlocked(attempt.data, attempt.error));
  });

  await t.test("the customer cannot set staff-only fields on their own case", async () => {
    const priorityAttempt = await customer
      .from("support_cases")
      .update({ priority: "urgent" })
      .eq("id", caseId!)
      .select();
    assert.ok(isBlocked(priorityAttempt.data, priorityAttempt.error));

    const assignAttempt = await customer
      .from("support_cases")
      .update({ assigned_staff_id: ids.customer })
      .eq("id", caseId!)
      .select();
    assert.ok(isBlocked(assignAttempt.data, assignAttempt.error), "customer cannot assign staff");

    const statusAttempt = await customer
      .from("support_cases")
      .update({ status: "resolved" })
      .eq("id", caseId!)
      .select();
    assert.ok(isBlocked(statusAttempt.data, statusAttempt.error), "customer cannot self-resolve");
  });

  await t.test("cleanup", async () => {
    const admin = await as("admin");
    await admin.from("support_cases").delete().eq("id", caseId!);
  });
});

test("support_case_messages: customer-visible messages, internal notes stay hidden", async (t) => {
  const customer = await as("customer");
  const ops = await as("ops");
  let caseId: string | undefined;

  await t.test("setup: a real case", async () => {
    const created = await customer
      .from("support_cases")
      .insert({ subject: "Question about my application", requester_profile_id: ids.customer })
      .select("id")
      .single();
    assert.equal(created.error, null);
    caseId = created.data!.id as string;
  });

  await t.test("the customer can post a normal message", async () => {
    const msg = await customer
      .from("support_case_messages")
      .insert({ case_id: caseId!, sender_profile_id: ids.customer, body: "Any update?" })
      .select("id, is_internal")
      .single();
    assert.equal(msg.error, null);
    assert.equal(msg.data?.is_internal, false);
  });

  await t.test("the customer cannot post an internal note", async () => {
    const attempt = await customer
      .from("support_case_messages")
      .insert({
        case_id: caseId!,
        sender_profile_id: ids.customer,
        body: "Fake internal note",
        is_internal: true,
      })
      .select();
    assert.ok(isBlocked(attempt.data, attempt.error));
  });

  await t.test("an unrelated user cannot post a message on this case", async () => {
    const buyer = await as("buyer");
    const attempt = await buyer
      .from("support_case_messages")
      .insert({
        case_id: caseId!,
        sender_profile_id: ids.buyer,
        body: "I should not see this case.",
      })
      .select();
    assert.ok(isBlocked(attempt.data, attempt.error));
  });

  await t.test("ops posts a real internal note; the customer cannot see it", async () => {
    const note = await ops
      .from("support_case_messages")
      .insert({
        case_id: caseId!,
        sender_profile_id: ids.ops,
        body: "Internal: escalate to compliance.",
        is_internal: true,
      })
      .select("id")
      .single();
    assert.equal(note.error, null);

    const customerView = await customer
      .from("support_case_messages")
      .select("id")
      .eq("id", note.data!.id as string);
    assert.ok(isBlocked(customerView.data, customerView.error));

    const opsView = await ops
      .from("support_case_messages")
      .select("id, is_internal")
      .eq("id", note.data!.id as string)
      .single();
    assert.equal(opsView.error, null);
    assert.equal(opsView.data?.is_internal, true);
  });

  await t.test("cleanup", async () => {
    const admin = await as("admin");
    await admin.from("support_cases").delete().eq("id", caseId!);
  });
});

test("claim_support_case: atomic claim, audited, no silent steal", async (t) => {
  const customer = await as("customer");
  const ops = await as("ops");
  const admin = await as("admin");
  let caseId: string | undefined;

  await t.test("setup: a real open case", async () => {
    const created = await customer
      .from("support_cases")
      .insert({ subject: "Billing question", requester_profile_id: ids.customer })
      .select("id")
      .single();
    assert.equal(created.error, null);
    caseId = created.data!.id as string;
  });

  await t.test("a customer cannot call claim_support_case at all", async () => {
    const attempt = await customer.rpc("claim_support_case", { p_case_id: caseId! });
    assert.ok(attempt.error, "expected only ops staff to be able to claim a case");
  });

  await t.test("ops claims it: status moves to triaged, assignment recorded, audited", async () => {
    const call = await ops.rpc("claim_support_case", { p_case_id: caseId! });
    assert.equal(call.error, null);

    const claimed = await ops
      .from("support_cases")
      .select("assigned_staff_id, status")
      .eq("id", caseId!)
      .single();
    assert.equal(claimed.error, null);
    assert.equal(claimed.data?.assigned_staff_id, ids.ops);
    assert.equal(claimed.data?.status, "triaged");

    const audit = await admin
      .from("audit_logs")
      .select("actor_profile_id, action")
      .eq("target_id", caseId!)
      .eq("action", "support_case.claimed")
      .single();
    assert.equal(audit.error, null);
    assert.equal(audit.data?.actor_profile_id, ids.ops);
  });

  await t.test("cleanup", async () => {
    await admin.from("support_cases").delete().eq("id", caseId!);
  });
});

test("support_cases: reopening preserves message history", async (t) => {
  const customer = await as("customer");
  const ops = await as("ops");
  const admin = await as("admin");
  let caseId: string | undefined;
  let messageId: string | undefined;

  await t.test("setup: a case resolved by ops, with a real message already on it", async () => {
    const created = await customer
      .from("support_cases")
      .insert({ subject: "Reopen test", requester_profile_id: ids.customer })
      .select("id")
      .single();
    assert.equal(created.error, null);
    caseId = created.data!.id as string;

    const msg = await customer
      .from("support_case_messages")
      .insert({ case_id: caseId, sender_profile_id: ids.customer, body: "Original question." })
      .select("id")
      .single();
    assert.equal(msg.error, null);
    messageId = msg.data!.id as string;

    const resolved = await ops
      .from("support_cases")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", caseId)
      .select("status")
      .single();
    assert.equal(resolved.error, null);
    assert.equal(resolved.data?.status, "resolved");
  });

  await t.test("the customer can reopen their own resolved case", async () => {
    const reopened = await customer
      .from("support_cases")
      .update({ status: "reopened" })
      .eq("id", caseId!)
      .select("status")
      .single();
    assert.equal(reopened.error, null);
    assert.equal(reopened.data?.status, "reopened");
  });

  await t.test("the original message is still there after reopening", async () => {
    const msg = await customer
      .from("support_case_messages")
      .select("id, body")
      .eq("id", messageId!)
      .single();
    assert.equal(msg.error, null);
    assert.equal(msg.data?.body, "Original question.");
  });

  await t.test(
    "a customer cannot reopen straight from an open/in_progress case (not terminal)",
    async () => {
      const freshCase = await customer
        .from("support_cases")
        .insert({ subject: "Not yet resolved", requester_profile_id: ids.customer })
        .select("id")
        .single();
      assert.equal(freshCase.error, null);
      const attempt = await customer
        .from("support_cases")
        .update({ status: "reopened" })
        .eq("id", freshCase.data!.id as string)
        .select();
      assert.ok(isBlocked(attempt.data, attempt.error));
      await admin
        .from("support_cases")
        .delete()
        .eq("id", freshCase.data!.id as string);
    },
  );

  await t.test("cleanup", async () => {
    await admin.from("support_cases").delete().eq("id", caseId!);
  });
});
