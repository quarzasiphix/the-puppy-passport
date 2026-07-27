// Stage BN (supplemental queue): explainable risk signals
// (20260101010500_risk_signals.sql). Covers: a real, durably-committed event (repeatedly hitting
// the transport_amendment_request rate-limit threshold with genuinely successful calls) produces a
// signal, crossing the threshold again later increments rather than duplicates, a client cannot
// insert or update the table directly (no INSERT/UPDATE policy exists at all), an unrelated user
// cannot read another profile's signals, ops staff can read and review, and a signal alone never
// blocks or suspends anything by itself (it's advisory only).
//
// Deliberately drives 15 *successful* amendment requests, not 21 rejected ones: an earlier version
// of this migration tried recording the signal inside enforce_rate_limit() right before it raises
// on rejection, but PostgREST runs each RPC call as one transaction, and an uncaught raise rolls
// back everything in that call -- including any insert made earlier in the same call. Proven by
// actually driving a real account past the limit and finding rate_limit_events never grew past
// what the successful calls alone had already committed. The real, redesigned wiring is a trigger
// on rate_limit_events that fires once an actor's count of committed (i.e. accepted) uses of a
// given rate-limited action crosses a real fraction of that action's configured max_count --
// transport_amendment_request's threshold is 15 (max_count 20, see 20260101010500).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { as, ids, isBlocked, isForbidden, uniqueTestEmail } from "./helpers.ts";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

test("risk_signals: repeatedly crossing a real rate-limit threshold produces a signal, later crossings increment it", async (t) => {
  const admin = await as("admin");
  const ops = await as("ops");
  let signedUp: Awaited<ReturnType<typeof as>> | undefined;
  let subjectId: string | undefined;
  let requestId: string | undefined;

  await t.test("setup: a disposable account with a real submitted transport request", async () => {
    const disposableClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const email = uniqueTestEmail("risk-signal");
    const signUp = await disposableClient.auth.signUp({ email, password: "password123" });
    assert.equal(signUp.error, null);
    subjectId = signUp.data.user!.id;
    signedUp = disposableClient;

    const created = await signedUp
      .from("transport_requests")
      .insert({
        requester_profile_id: subjectId,
        request_number: `TR-RISK-${Date.now()}`,
        request_purpose: "own_dog",
        animal_name: "Test Dog",
        pickup_country: "Poland",
        pickup_city: "Warsaw",
        destination_country: "Germany",
        destination_city: "Berlin",
        status: "submitted",
      })
      .select("id")
      .single();
    assert.equal(created.error, null);
    requestId = created.data!.id as string;
  });

  await t.test(
    "cleanup any pre-existing signal for this fresh account (should be none)",
    async () => {
      const pre = await admin
        .from("risk_signals")
        .select("id")
        .eq("subject_profile_id", subjectId!)
        .eq("signal_type", "repeated_rate_limit_hits");
      assert.equal(pre.error, null);
      assert.equal(pre.data?.length, 0);
    },
  );

  await t.test("15 genuinely successful amendment requests cross the real threshold", async () => {
    for (let i = 0; i < 15; i++) {
      const attempt = await signedUp!.rpc("request_transport_amendment", {
        p_transport_request_id: requestId!,
        p_field_name: "pickup_area_approx",
        p_new_value: `Approx area ${i}`,
      });
      assert.equal(
        attempt.error,
        null,
        `amendment ${i} should succeed (well under the 20/hour cap)`,
      );
    }
  });

  await t.test("a real signal now exists, explainable and rule-versioned", async () => {
    const signal = await admin
      .from("risk_signals")
      .select(
        "signal_type, source_event_type, rule_version, explanation, occurrence_count, reviewed",
      )
      .eq("subject_profile_id", subjectId!)
      .eq("signal_type", "repeated_rate_limit_hits")
      .single();
    assert.equal(signal.error, null);
    assert.equal(signal.data?.source_event_type, "transport_amendment_request");
    assert.equal(signal.data?.rule_version, "v1");
    assert.ok(signal.data?.explanation.includes("transport_amendment_request"));
    assert.equal(signal.data?.occurrence_count, 1);
    assert.equal(signal.data?.reviewed, false);
  });

  await t.test(
    "no new signal row is created by further calls short of a fresh crossing",
    async () => {
      const attempt = await signedUp!.rpc("request_transport_amendment", {
        p_transport_request_id: requestId!,
        p_field_name: "pickup_area_approx",
        p_new_value: "One more",
      });
      assert.equal(attempt.error, null);

      const rows = await admin
        .from("risk_signals")
        .select("id, occurrence_count")
        .eq("subject_profile_id", subjectId!)
        .eq("signal_type", "repeated_rate_limit_hits");
      assert.equal(rows.error, null);
      assert.equal(rows.data?.length, 1, "must stay a single row, not duplicate");
      assert.equal(
        rows.data![0].occurrence_count,
        1,
        "count 16 is past the threshold, not a fresh crossing",
      );
    },
  );

  await t.test("a signal alone never blocks the account from doing anything else", async () => {
    const unrelated = await signedUp!.from("profiles").select("id").eq("id", subjectId!).single();
    assert.equal(
      unrelated.error,
      null,
      "the flagged account can still read its own profile normally",
    );
  });

  await t.test(
    "ops staff can read the signal; the flagged user cannot see it themselves",
    async () => {
      const opsView = await ops
        .from("risk_signals")
        .select("id")
        .eq("subject_profile_id", subjectId!);
      assert.equal(opsView.error, null);
      assert.ok((opsView.data?.length ?? 0) >= 1);

      const selfView = await signedUp!
        .from("risk_signals")
        .select("id")
        .eq("subject_profile_id", subjectId!);
      assert.ok(
        isBlocked(selfView.data, selfView.error),
        "a user cannot read their own risk signals",
      );
    },
  );

  await t.test("an unrelated non-staff user cannot read this signal either", async () => {
    const buyer = await as("buyer");
    const attempt = await buyer
      .from("risk_signals")
      .select("id")
      .eq("subject_profile_id", subjectId!);
    assert.ok(isBlocked(attempt.data, attempt.error));
  });

  await t.test("no client can insert or update a risk_signals row directly", async () => {
    const insertAttempt = await ops.from("risk_signals").insert({
      signal_type: "repeated_rate_limit_hits",
      subject_profile_id: subjectId!,
      source_event_type: "forged",
      rule_version: "v1",
      explanation: "forged row",
    });
    assert.ok(isForbidden(insertAttempt.error) || insertAttempt.error !== null);

    const updateAttempt = await ops
      .from("risk_signals")
      .update({ occurrence_count: 999 })
      .eq("subject_profile_id", subjectId!);
    assert.ok(isForbidden(updateAttempt.error) || updateAttempt.error !== null);
  });

  await t.test("ops staff can mark the signal reviewed as a false positive", async () => {
    const signalRow = await admin
      .from("risk_signals")
      .select("id")
      .eq("subject_profile_id", subjectId!)
      .eq("signal_type", "repeated_rate_limit_hits")
      .single();
    assert.equal(signalRow.error, null);

    const review = await ops.rpc("mark_risk_signal_reviewed", {
      p_signal_id: signalRow.data!.id as string,
      p_is_false_positive: true,
      p_resolution_notes: "Legitimate retry storm during test run, not abuse.",
    });
    assert.equal(review.error, null);

    const reviewed = await ops
      .from("risk_signals")
      .select("reviewed, is_false_positive, reviewed_by, resolution_notes")
      .eq("id", signalRow.data!.id as string)
      .single();
    assert.equal(reviewed.error, null);
    assert.equal(reviewed.data?.reviewed, true);
    assert.equal(reviewed.data?.is_false_positive, true);
    assert.equal(reviewed.data?.reviewed_by, ids.ops);

    // Stage YR-7 (admin command catalogue): mark_risk_signal_reviewed() previously left no
    // audit_logs trail, unlike its sibling ops-privileged RPCs.
    const audit = await admin
      .from("audit_logs")
      .select("actor_profile_id, action")
      .eq("target_id", signalRow.data!.id as string)
      .eq("action", "risk_signal.reviewed")
      .single();
    assert.equal(audit.error, null);
    assert.equal(audit.data?.actor_profile_id, ids.ops);
  });

  await t.test("a non-staff user cannot call mark_risk_signal_reviewed", async () => {
    const buyer = await as("buyer");
    const signalRow = await admin
      .from("risk_signals")
      .select("id")
      .eq("subject_profile_id", subjectId!)
      .eq("signal_type", "repeated_rate_limit_hits")
      .single();
    const attempt = await buyer.rpc("mark_risk_signal_reviewed", {
      p_signal_id: signalRow.data!.id as string,
      p_is_false_positive: false,
    });
    assert.ok(attempt.error, "expected only ops staff to be able to review a signal");
  });

  await t.test(
    "cleanup: remove the disposable account's signal and transport request",
    async () => {
      await admin.from("risk_signals").delete().eq("subject_profile_id", subjectId!);
      await admin.from("transport_requests").delete().eq("id", requestId!);
    },
  );
});
