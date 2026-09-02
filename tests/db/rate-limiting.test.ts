// Stage J: abuse prevention (supabase/migrations/20260101008200_rate_limiting_and_abuse_prevention.sql,
// 20260101008300_rate_limit_key_rpcs.sql). See docs/RATE_LIMITING_AND_ABUSE_PROTECTION.md and
// docs/AUTONOMOUS_BACKEND_PROGRESS.md.
//
// Deliberately does NOT drive any real, shared persona's real action_key up to its production
// threshold: this suite reuses a fixed set of ~10 personas across every test file and never resets
// the database between files, and several of the personas that can perform these real actions at
// all are effectively the *only* eligible one in the seed data (foundation1 is the only approved
// foundation/shelter/rescue org member, so it's the only account that can ever create a real
// welfare_cases row). Deliberately exhausting a shared persona's quota for a real action_key would
// break every other test file that legitimately reuses that same persona for that same action
// later in the same suite run — found the hard way while first writing this file with an
// exhaust-to-threshold design, which broke welfare-cases.test.ts, transport-domain.test.ts and
// transport-timeline.test.ts once run order put this file first.
//
// Instead: (1) the core enforce_rate_limit() mechanism (threshold, per-actor isolation, per-
// action_key isolation, window behaviour) is proven completely in isolation using a fresh,
// per-run-unique action_key nothing else in the suite will ever touch; (2) each real trigger/RPC's
// *wiring* to enforce_rate_limit is proven by performing exactly one real action and confirming it
// produced exactly one new rate_limit_events row with the right actor and action_key — real,
// meaningful coverage that the protection is actually connected, without needing to exhaust
// anyone's real quota.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids } from "./helpers.ts";

test("enforce_rate_limit: threshold, per-actor isolation, and independent action keys", async (t) => {
  const buyer = await as("buyer");
  const customer = await as("customer");
  const actionKey = `test_action_${Date.now()}`;

  await t.test("the first N calls (under the threshold) succeed", async () => {
    for (let i = 0; i < 3; i++) {
      const { error } = await buyer.rpc("enforce_rate_limit", {
        p_action_key: actionKey,
        p_max_count: 3,
        p_window: "1 hour",
      });
      assert.equal(error, null, `call ${i + 1} should have succeeded`);
    }
  });

  await t.test("the (N+1)th call within the window is rejected", async () => {
    const { error } = await buyer.rpc("enforce_rate_limit", {
      p_action_key: actionKey,
      p_max_count: 3,
      p_window: "1 hour",
    });
    assert.ok(error, "expected the 4th call to exceed the threshold and be rejected");
  });

  await t.test("a different actor's count is completely independent", async () => {
    const { error } = await customer.rpc("enforce_rate_limit", {
      p_action_key: actionKey,
      p_max_count: 3,
      p_window: "1 hour",
    });
    assert.equal(error, null, "a different user must not be affected by the buyer's count");
  });

  await t.test("a different action_key for the same actor is completely independent", async () => {
    const { error } = await buyer.rpc("enforce_rate_limit", {
      p_action_key: `${actionKey}_other`,
      p_max_count: 3,
      p_window: "1 hour",
    });
    assert.equal(error, null, "a different action_key must not share the exhausted count");
  });

  await t.test(
    "a zero-second window means the count from a moment ago no longer applies",
    async () => {
      const { error } = await buyer.rpc("enforce_rate_limit", {
        p_action_key: actionKey,
        p_max_count: 3,
        p_window: "0 seconds",
      });
      assert.equal(
        error,
        null,
        "a zero-length window should never see stale rows as still counting",
      );
    },
  );
});

// Verifies a specific real trigger/RPC is actually wired to enforce_rate_limit, by confirming one
// real action produces exactly one new rate_limit_events row for the right actor/action_key.
async function assertActionIsWired(input: {
  actorId: string;
  actionKey: string;
  performAction: () => Promise<{ error: { message?: string } | null }>;
  cleanup?: () => Promise<void>;
}) {
  const admin = await as("admin");
  const before = await admin
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("actor_profile_id", input.actorId)
    .eq("action_key", input.actionKey);
  assert.equal(before.error, null);

  const result = await input.performAction();
  assert.equal(
    result.error,
    null,
    "the real action itself should have succeeded (under threshold)",
  );

  const after = await admin
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("actor_profile_id", input.actorId)
    .eq("action_key", input.actionKey);
  assert.equal(after.error, null);
  assert.equal(
    (after.count ?? 0) - (before.count ?? 0),
    1,
    `expected exactly one new rate_limit_events row for ${input.actionKey}`,
  );

  if (input.cleanup) await input.cleanup();
}

test("report submission is wired to rate limiting (30/hour)", async (t) => {
  const admin = await as("admin");
  const breeder2 = await as("breeder2");
  let reportId: string | undefined;

  await t.test("one real report creates one rate_limit_events row", async () => {
    await assertActionIsWired({
      actorId: ids.breeder2,
      actionKey: "report_submission",
      performAction: async () => {
        const { data, error } = await breeder2
          .from("reports")
          .insert({
            reporter_profile_id: ids.breeder2,
            target_type: "organisation",
            target_id: ids.orgWolnaDolina,
            reason: "other",
            description: "Rate-limit wiring check.",
          })
          .select("id")
          .single();
        reportId = data?.id as string | undefined;
        return { error };
      },
    });
  });

  await t.test("cleanup", async () => {
    if (reportId) await admin.from("reports").delete().eq("id", reportId);
  });
});

test("welfare case submission is wired to rate limiting (50/day)", async (t) => {
  const foundation1 = await as("foundation1");
  let caseId: string | undefined;

  await t.test("one real welfare case creates one rate_limit_events row", async () => {
    await assertActionIsWired({
      actorId: ids.foundation1,
      actionKey: "welfare_case_submission",
      performAction: async () => {
        const { data, error } = await foundation1
          .from("welfare_cases")
          .insert({
            organisation_id: ids.orgFundacja,
            created_by: ids.foundation1,
            reason: "Rate-limit wiring check.",
            status: "submitted",
          })
          .select("id")
          .single();
        caseId = data?.id as string | undefined;
        return { error };
      },
    });
  });

  await t.test("cleanup", async () => {
    if (caseId) await foundation1.from("welfare_cases").delete().eq("id", caseId);
  });
});

test("transport draft creation is wired to rate limiting (100/hour)", async (t) => {
  const admin = await as("admin");
  let requestId: string | undefined;

  await t.test(
    "one real create_transport_draft() call creates one rate_limit_events row",
    async () => {
      // Uses the admin persona specifically: create_transport_draft() only requires authentication,
      // no special role, and admin is not otherwise exercised for this action anywhere else in the
      // suite (unlike customer/buyer/foundation1/breeder1, all of which create real transport drafts
      // extensively elsewhere) — the safest available choice for a real end-to-end wiring check.
      await assertActionIsWired({
        actorId: ids.admin,
        actionKey: "transport_draft_creation",
        performAction: async () => {
          const { data, error } = await admin.rpc("create_transport_draft", { p_request: {} });
          requestId = data as string | undefined;
          return { error };
        },
      });
    },
  );

  await t.test("cleanup", async () => {
    if (requestId) await admin.from("transport_requests").delete().eq("id", requestId);
  });
});

test("enforce_rate_limit is reachable with the real create_transport_draft threshold value", async () => {
  // Confirms the *number* 100/hour genuinely rejects a 101st call, using a synthetic action_key
  // rather than the real 'transport_draft_creation' key shared with production usage elsewhere in
  // the suite — proves the threshold value itself works without touching any real persona's real
  // quota.
  const admin = await as("admin");
  const key = `transport_draft_creation_threshold_check_${Date.now()}`;
  let lastError: { message?: string } | null = null;
  for (let i = 0; i < 101; i++) {
    const { error } = await admin.rpc("enforce_rate_limit", {
      p_action_key: key,
      p_max_count: 100,
      p_window: "1 hour",
    });
    lastError = error;
    if (error) break;
  }
  assert.ok(lastError, "expected the 101st call to exceed a 100-count threshold");
});

test("organisation invitations are wired to rate limiting (100/hour)", async (t) => {
  const foundation1 = await as("foundation1");
  let invitationId: string | undefined;

  await t.test("one real invite_org_member() call creates one rate_limit_events row", async () => {
    await assertActionIsWired({
      actorId: ids.foundation1,
      actionKey: "org_invitation",
      performAction: async () => {
        const { data, error } = await foundation1.rpc("invite_org_member", {
          p_org_id: ids.orgFundacja,
          p_email: `rate-limit-wiring-check-${Date.now()}@anemalo.test`,
          p_role: "volunteer",
        });
        invitationId = data as string | undefined;
        return { error };
      },
    });
  });

  await t.test("cleanup", async () => {
    if (invitationId)
      await foundation1.rpc("revoke_org_invitation", { p_invitation_id: invitationId });
  });
});

test("rate_limit_events access: admin-only read, no direct write for anyone", async (t) => {
  const buyer = await as("buyer");

  await t.test("an ordinary user cannot bulk-read rate_limit_events", async () => {
    const blocked = await buyer.from("rate_limit_events").select("id");
    assert.equal(blocked.data?.length ?? 0, 0);
  });

  await t.test("an ordinary user cannot insert a rate_limit_events row directly", async () => {
    const attempt = await buyer
      .from("rate_limit_events")
      .insert({ actor_profile_id: ids.buyer, action_key: "direct_insert_attempt" })
      .select();
    assert.ok(attempt.error, "expected a direct insert to be rejected — no insert policy exists");
  });

  await t.test("admin can read rate_limit_events", async () => {
    const admin = await as("admin");
    const { data, error } = await admin.from("rate_limit_events").select("id").limit(1);
    assert.equal(error, null);
    assert.ok(Array.isArray(data));
  });
});
