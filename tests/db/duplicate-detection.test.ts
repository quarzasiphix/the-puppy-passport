// Stage BO (supplemental queue): duplicate detection
// (20260101010600_risk_signal_type_duplicate_detection.sql,
// 20260101010700_duplicate_detection.sql). Two different mechanisms for two different kinds of
// duplicate: a hard, case/whitespace-insensitive unique constraint on animals.microchip_number
// (unambiguous -- a real chip can never belong to two animals), and an advisory risk_signals entry
// (Stage BN's infrastructure) when the same requester submits what looks like the same transport
// request twice within 24 hours -- fuzzy, so never auto-blocked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { as, ids, isBlocked, uniqueTestEmail } from "./helpers.ts";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

test("animals.microchip_number: unique, case/whitespace-insensitive, nulls allowed to repeat", async (t) => {
  const breeder = await as("breeder1");
  const admin = await as("admin");
  let firstId: string | undefined;
  let secondNullId: string | undefined;
  let thirdNullId: string | undefined;

  await t.test("setup: a real animal with a real chip number", async () => {
    const created = await breeder
      .from("animals")
      .insert({
        organization_id: ids.orgCichyLas,
        name: "Dup Test Dog",
        microchip_number: "982000123456789",
        listing_category: "breeder_puppy",
      })
      .select("id")
      .single();
    assert.equal(created.error, null);
    firstId = created.data!.id as string;
  });

  await t.test("an exact-duplicate chip number on a different animal is rejected", async () => {
    const attempt = await breeder
      .from("animals")
      .insert({
        organization_id: ids.orgCichyLas,
        name: "A different-looking dog, same chip",
        microchip_number: "982000123456789",
        listing_category: "breeder_puppy",
      })
      .select();
    // A unique-constraint violation (23505) is a data-integrity rejection, not an RLS/authorization
    // block -- isBlocked() is for the latter (permission-denied or silently-filtered-empty); here
    // we expect a real, loud Postgres error instead.
    assert.ok(attempt.error, "expected a duplicate chip number to be rejected");
  });

  await t.test("a case/whitespace variant of the same chip number is also rejected", async () => {
    const attempt = await breeder
      .from("animals")
      .insert({
        organization_id: ids.orgCichyLas,
        name: "Same chip, different casing",
        microchip_number: "  982000123456789  ".toUpperCase(),
        listing_category: "breeder_puppy",
      })
      .select();
    assert.ok(attempt.error, "expected a case/whitespace variant of the same chip to be rejected");
  });

  await t.test(
    "two different animals with no chip number at all is fine (nulls don't collide)",
    async () => {
      const a = await breeder
        .from("animals")
        .insert({
          organization_id: ids.orgCichyLas,
          name: "No chip 1",
          listing_category: "breeder_puppy",
        })
        .select("id")
        .single();
      assert.equal(a.error, null);
      secondNullId = a.data!.id as string;

      const b = await breeder
        .from("animals")
        .insert({
          organization_id: ids.orgCichyLas,
          name: "No chip 2",
          listing_category: "breeder_puppy",
        })
        .select("id")
        .single();
      assert.equal(b.error, null);
      thirdNullId = b.data!.id as string;
    },
  );

  await t.test("cleanup", async () => {
    for (const id of [firstId, secondNullId, thirdNullId]) {
      if (id) await admin.from("animals").delete().eq("id", id);
    }
  });
});

test("transport_requests: submitting a lookalike request twice raises an advisory risk signal, never blocks it", async (t) => {
  // risk_signals has no DELETE policy for anyone, by design (Stage BN) -- a signal is closed out
  // via mark_risk_signal_reviewed(), never deleted, so staff can't quietly erase evidence of a
  // flagged pattern. That means a test run against a *shared* persona would leave a permanent
  // signal row behind with no way to clean it up, corrupting every later run's "no signal yet"
  // assertion (hit exactly this while writing this test). Using a disposable signed-up account
  // instead sidesteps the problem entirely, the same reasoning Stage BN's own test already used.
  const admin = await as("admin");
  const ops = await as("ops");
  const disposableClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  let subjectId: string | undefined;
  let firstId: string | undefined;
  let secondId: string | undefined;

  await t.test("setup: a disposable account", async () => {
    const email = uniqueTestEmail("dup-request");
    const signUp = await disposableClient.auth.signUp({ email, password: "password123" });
    assert.equal(signUp.error, null);
    subjectId = signUp.data.user!.id;
  });

  await t.test("a first real submitted request", async () => {
    const created = await disposableClient
      .from("transport_requests")
      .insert({
        requester_profile_id: subjectId,
        request_number: `TR-DUP-${Date.now()}-1`,
        request_purpose: "own_dog",
        animal_name: "Duplicate Test Puppy",
        pickup_country: "Poland",
        pickup_city: "Gdansk",
        destination_country: "Germany",
        destination_city: "Munich",
        status: "submitted",
      })
      .select("id")
      .single();
    assert.equal(created.error, null);
    firstId = created.data!.id as string;
  });

  await t.test("no signal yet -- one submission alone is not a duplicate", async () => {
    const signal = await admin
      .from("risk_signals")
      .select("id")
      .eq("subject_profile_id", subjectId!)
      .eq("signal_type", "possible_duplicate_transport_request");
    assert.equal(signal.error, null);
    assert.equal(signal.data?.length, 0);
  });

  await t.test(
    "a second, lookalike submission from the same requester succeeds (never blocked)",
    async () => {
      const created = await disposableClient
        .from("transport_requests")
        .insert({
          requester_profile_id: subjectId,
          request_number: `TR-DUP-${Date.now()}-2`,
          request_purpose: "own_dog",
          animal_name: "duplicate test puppy", // same name, different case -- still a match
          pickup_country: "Poland",
          pickup_city: "Gdansk",
          destination_country: "Germany",
          destination_city: "Munich",
          status: "submitted",
        })
        .select("id")
        .single();
      assert.equal(created.error, null, "a possible duplicate is flagged, never rejected outright");
      secondId = created.data!.id as string;
    },
  );

  await t.test("a real, explainable advisory signal now exists", async () => {
    const signal = await admin
      .from("risk_signals")
      .select("signal_type, source_event_type, rule_version, explanation, reviewed")
      .eq("subject_profile_id", subjectId!)
      .eq("signal_type", "possible_duplicate_transport_request")
      .single();
    assert.equal(signal.error, null);
    assert.equal(signal.data?.source_event_type, "transport_requests");
    assert.equal(signal.data?.rule_version, "v1");
    assert.ok(signal.data?.explanation.includes(firstId!));
    assert.equal(signal.data?.reviewed, false);
  });

  await t.test("ops staff can see it; the flagged requester themselves cannot", async () => {
    const opsView = await ops
      .from("risk_signals")
      .select("id")
      .eq("subject_profile_id", subjectId!)
      .eq("signal_type", "possible_duplicate_transport_request");
    assert.equal(opsView.error, null);
    assert.equal(opsView.data?.length, 1);

    const selfView = await disposableClient
      .from("risk_signals")
      .select("id")
      .eq("subject_profile_id", subjectId!);
    assert.ok(isBlocked(selfView.data, selfView.error));
  });

  await t.test(
    "a request for a genuinely different animal/route does not trigger a false positive",
    async () => {
      const created = await disposableClient
        .from("transport_requests")
        .insert({
          requester_profile_id: subjectId,
          request_number: `TR-DUP-${Date.now()}-3`,
          request_purpose: "own_dog",
          animal_name: "A completely different animal",
          pickup_country: "Poland",
          pickup_city: "Wroclaw",
          destination_country: "Spain",
          destination_city: "Madrid",
          status: "submitted",
        })
        .select("id")
        .single();
      assert.equal(created.error, null);

      const rows = await admin
        .from("risk_signals")
        .select("occurrence_count")
        .eq("subject_profile_id", subjectId!)
        .eq("signal_type", "possible_duplicate_transport_request")
        .single();
      assert.equal(
        rows.data?.occurrence_count,
        1,
        "a genuinely different request must not add to the count",
      );

      await admin
        .from("transport_requests")
        .delete()
        .eq("id", created.data!.id as string);
    },
  );

  await t.test("cleanup: remove the disposable account's transport requests", async () => {
    for (const id of [firstId, secondId]) {
      if (id) await admin.from("transport_requests").delete().eq("id", id);
    }
  });
});
