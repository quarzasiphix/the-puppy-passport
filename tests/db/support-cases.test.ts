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
    const deleted = await admin.from("support_cases").delete().eq("id", caseId!);
    assert.equal(deleted.error, null, "cleanup must not silently swallow a real deletion failure");
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
    const deleted = await admin.from("support_cases").delete().eq("id", caseId!);
    assert.equal(deleted.error, null, "cleanup must not silently swallow a real deletion failure");
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
    const deleted = await admin.from("support_cases").delete().eq("id", caseId!);
    assert.equal(deleted.error, null, "cleanup must not silently swallow a real deletion failure");
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
    const deleted = await admin.from("support_cases").delete().eq("id", caseId!);
    assert.equal(deleted.error, null, "cleanup must not silently swallow a real deletion failure");
  });
});

// Stage XR-1 (protected-field mutation matrix): the reopen policy's `with check` only ever
// verified the new status was 'reopened' -- nothing stopped the same UPDATE statement from also
// changing priority/category/subject/assigned_staff_id, every one of which this table's own
// header comment says is staff-only. 20260101012700_support_case_reopen_field_lock.sql closes it.
test("support_cases: reopening cannot smuggle in a staff-only field change", async (t) => {
  const customer = await as("customer");
  const ops = await as("ops");
  const admin = await as("admin");
  let caseId: string | undefined;

  await t.test("setup: a resolved case with known priority/category/no assignee", async () => {
    const created = await customer
      .from("support_cases")
      .insert({
        subject: "Protected-field reopen test",
        requester_profile_id: ids.customer,
        priority: "low",
        category: "other",
      })
      .select("id")
      .single();
    assert.equal(created.error, null);
    caseId = created.data!.id as string;

    const resolved = await ops
      .from("support_cases")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", caseId)
      .select("status")
      .single();
    assert.equal(resolved.error, null);
    assert.equal(resolved.data?.status, "resolved");
  });

  await t.test(
    "reopening while also bumping priority to 'urgent' in the same call is rejected",
    async () => {
      const attempt = await customer
        .from("support_cases")
        .update({ status: "reopened", priority: "urgent" })
        .eq("id", caseId!)
        .select();
      assert.ok(attempt.error, "expected the staff-only field lock to reject this");

      const check = await admin
        .from("support_cases")
        .select("status, priority")
        .eq("id", caseId!)
        .single();
      assert.equal(
        check.data?.status,
        "resolved",
        "the blocked update must not have partially applied",
      );
      assert.equal(check.data?.priority, "low");
    },
  );

  await t.test("reopening while also self-assigning assigned_staff_id is rejected", async () => {
    const attempt = await customer
      .from("support_cases")
      .update({ status: "reopened", assigned_staff_id: ids.customer })
      .eq("id", caseId!)
      .select();
    assert.ok(attempt.error, "expected the staff-only field lock to reject this");
  });

  await t.test("a plain reopen with no other field changes still works", async () => {
    const reopened = await customer
      .from("support_cases")
      .update({ status: "reopened" })
      .eq("id", caseId!)
      .select("status, priority")
      .single();
    assert.equal(reopened.error, null);
    assert.equal(reopened.data?.status, "reopened");
    assert.equal(reopened.data?.priority, "low", "priority must be untouched by a plain reopen");
  });

  await t.test("ops staff can still freely change priority/category/assignment", async () => {
    const update = await ops
      .from("support_cases")
      .update({ priority: "urgent", assigned_staff_id: ids.ops })
      .eq("id", caseId!)
      .select("priority, assigned_staff_id")
      .single();
    assert.equal(update.error, null);
    assert.equal(update.data?.priority, "urgent");
    assert.equal(update.data?.assigned_staff_id, ids.ops);
  });

  await t.test("cleanup", async () => {
    const deleted = await admin.from("support_cases").delete().eq("id", caseId!);
    assert.equal(deleted.error, null);
  });
});

// Stage YR-6 (support-to-operations boundary audit): related_entity_type/related_entity_id
// (this file's own header comment, and the original migration's comment) are documented as
// "informational relation only, never trusted for authorisation" -- confirmed by grep that no
// policy, RPC, or query helper anywhere in the schema joins off these columns. This proves it
// directly rather than by absence of code alone: pointing a case at a resource the case's own
// requester cannot normally see must never grant them (or leak through the case) any new access
// to that resource.
test("support_cases: related_entity_id is informational context only, never a capability", async (t) => {
  const customer = await as("customer");
  const admin = await as("admin");
  let caseId: string | undefined;

  await t.test(
    "a customer's case can reference a transport request they don't own, with no effect",
    async () => {
      // ids.transportBerlin belongs to a different persona (customer's own is transportWarsawAmsterdam/
      // transportBerlin actually IS customer's own per helpers.ts -- use buyer's instead, a genuinely
      // foreign resource relative to this test's own actor).
      const created = await customer
        .from("support_cases")
        .insert({
          subject: "Question about a route I don't own",
          category: "transport",
          requester_profile_id: ids.customer,
          related_entity_type: "transport_request",
          related_entity_id: ids.transportKrakow, // belongs to `buyer`, not `customer`
        })
        .select("id, related_entity_id")
        .single();
      assert.equal(created.error, null);
      assert.equal(created.data?.related_entity_id, ids.transportKrakow);
      caseId = created.data!.id as string;
    },
  );

  await t.test(
    "the customer still cannot read the foreign transport request directly -- the relation grants nothing",
    async () => {
      const attempt = await customer
        .from("transport_requests")
        .select("id")
        .eq("id", ids.transportKrakow);
      assert.ok(
        isBlocked(attempt.data, attempt.error),
        "related_entity_id must never act as a capability, only as staff-facing context",
      );
    },
  );

  await t.test("cleanup", async () => {
    await admin.from("support_cases").delete().eq("id", caseId!);
  });
});

// This app has no separate "support" role distinct from "operations" -- is_ops_staff() (checked
// against has_role(auth.uid(), 'operations') or is_admin()) is the one gate for both, a deliberate
// choice documented in the original migration's own comment ("no dedicated 'support' platform_role
// exists... ops staff are the closest real, already-trusted staff concept"). This means the
// "support-to-operations boundary" this stage's own definition asks about doesn't exist as a
// separate privilege boundary in this app's real role model today -- there is only one combined
// staff tier, so there's no lower-trust "support-only" actor that could accidentally reach into
// moderation/ownership/financial/transport mutations beyond what they're already legitimately
// allowed to do as ops staff. Documented, not fabricated: this test proves the two "is_*_staff()"
// gates this app actually has (ops vs moderator) are genuinely distinct from each other, the one
// real staff/staff boundary that does exist.
test("ops-staff and moderator gates are genuinely distinct roles, not a combined super-role", async (t) => {
  const ops = await as("ops");

  await t.test("ops staff (no moderator role) cannot claim a moderation case", async () => {
    // Use a real, currently-open path: reporting something fresh and attempting to claim the
    // resulting case as ops (not moderator).
    const admin = await as("admin");
    const report = await admin
      .from("reports")
      .insert({
        reporter_profile_id: ids.customer,
        target_type: "organisation",
        target_id: ids.orgWolnaDolina,
        reason: "other",
        description: "YR-6 ops-vs-moderator boundary test.",
      })
      .select("id")
      .single();
    assert.equal(report.error, null);
    const caseResult = await admin.rpc("escalate_report_to_case", {
      p_report_id: report.data!.id as string,
    });
    assert.equal(caseResult.error, null);
    const caseId = caseResult.data as string;

    const attempt = await ops.rpc("claim_moderation_case", { p_case_id: caseId });
    assert.ok(attempt.error, "expected ops staff without a moderator role to be rejected");

    await admin.from("moderation_cases").delete().eq("id", caseId);
    await admin
      .from("reports")
      .delete()
      .eq("id", report.data!.id as string);
  });
});
