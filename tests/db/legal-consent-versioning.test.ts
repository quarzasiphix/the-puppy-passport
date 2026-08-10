// Stage BK (supplemental queue): legal-document/consent versioning.
// 20260101010200_legal_consent_versioning.sql adds a real, auditable record of what a user
// actually consented to and when, matching the promise already made on the signup page ("By
// creating an account, you agree to Anemalo's Terms and Privacy"). Tests the DB layer directly
// (RLS, constraints) plus the exact sequence of operations signUp() performs server-side
// (src/lib/auth/actions.ts) against a disposable throwaway account -- this harness talks to
// Supabase directly, not through the app server, so it can't invoke the TanStack Start server
// function itself, but it can prove every underlying database operation that function relies on
// actually works end to end.
import { test } from "node:test";
import assert from "node:assert/strict";
import { anon, as, freshClient, ids, uniqueTestEmail } from "./helpers.ts";

test("legal_document_versions: publicly readable, exactly one current per document type", async () => {
  const anonClient = anon();
  const { data, error } = await anonClient
    .from("legal_document_versions")
    .select("document_type, version, is_current")
    .eq("is_current", true);
  assert.equal(error, null);
  const types = (data ?? []).map((r) => r.document_type);
  assert.equal(
    new Set(types).size,
    types.length,
    "expected at most one current row per document_type",
  );
  assert.ok(types.includes("terms") && types.includes("privacy") && types.includes("cookies"));
});

test("user_consents: a user can only record consent to a real current version, never a made-up one", async (t) => {
  const customer = await as("customer");
  const admin = await as("admin");
  let consentId: string | undefined;

  await t.test("consenting to the real current terms version succeeds", async () => {
    const current = await customer
      .from("legal_document_versions")
      .select("version")
      .eq("document_type", "terms")
      .eq("is_current", true)
      .single();
    assert.equal(current.error, null);

    const consent = await customer
      .from("user_consents")
      .insert({ profile_id: ids.customer, document_type: "terms", version: current.data!.version })
      .select("id")
      .single();
    assert.equal(consent.error, null);
    consentId = consent.data!.id as string;
  });

  await t.test("consenting to a made-up version is rejected", async () => {
    const attempt = await customer
      .from("user_consents")
      .insert({ profile_id: ids.customer, document_type: "privacy", version: "not-a-real-version" })
      .select();
    assert.ok(attempt.error, "expected a fabricated version string to be rejected");
  });

  await t.test("a user cannot record consent on someone else's behalf", async () => {
    const attempt = await customer
      .from("user_consents")
      .insert({ profile_id: ids.buyer, document_type: "terms", version: "2026-07-24-draft" })
      .select();
    assert.ok(attempt.error, "expected a forged profile_id to be rejected");
  });

  await t.test(
    "consent history is append-only -- no update or delete for ordinary users",
    async () => {
      const updateAttempt = await customer
        .from("user_consents")
        .update({ version: "2026-07-24-draft" })
        .eq("id", consentId!)
        .select();
      assert.equal(
        updateAttempt.data?.length ?? 0,
        0,
        "expected no rows to be updatable by the user",
      );

      const deleteAttempt = await customer
        .from("user_consents")
        .delete()
        .eq("id", consentId!)
        .select();
      assert.equal(
        deleteAttempt.data?.length ?? 0,
        0,
        "expected no rows to be deletable by the user",
      );
    },
  );

  await t.test("an unrelated user cannot read this consent record", async () => {
    const buyer = await as("buyer");
    const attempt = await buyer.from("user_consents").select("id").eq("id", consentId!);
    assert.equal(attempt.data?.length ?? 0, 0);
  });

  await t.test("cleanup", async () => {
    const del = await admin.from("user_consents").delete().eq("id", consentId!);
    assert.equal(del.error, null, "cleanup delete must actually succeed, not fail silently");
  });
});

test("signup consent recording: the exact sequence signUp() performs works end to end", async () => {
  const disposableClient = freshClient();
  const email = uniqueTestEmail("consent-signup-test");
  const signUp = await disposableClient.auth.signUp({ email, password: "password123" });
  assert.equal(signUp.error, null);
  const userId = signUp.data.user!.id;

  // The exact query signUp() runs: fetch the current terms/privacy versions...
  const currentVersions = await disposableClient
    .from("legal_document_versions")
    .select("document_type, version")
    .in("document_type", ["terms", "privacy"])
    .eq("is_current", true);
  assert.equal(currentVersions.error, null);
  assert.equal(currentVersions.data?.length, 2);

  // ...then record consent for the new user to both.
  const recorded = await disposableClient.from("user_consents").insert(
    currentVersions.data!.map((v) => ({
      profile_id: userId,
      document_type: v.document_type,
      version: v.version,
    })),
  );
  assert.equal(recorded.error, null);

  const admin = await as("admin");
  const check = await admin
    .from("user_consents")
    .select("document_type, version")
    .eq("profile_id", userId);
  assert.equal(check.error, null);
  assert.equal(check.data?.length, 2);
});
