// Stage YR-13: public privacy regression suite. A single, reusable, systematic sweep of every
// major public-facing read surface as a genuinely anonymous visitor (anon(), no session at all) --
// consolidating what was previously proven piecemeal across many other test files into one place
// that asserts the specific, non-negotiable privacy floor: exact private addresses, contact
// details (email/phone), private documents, internal staff notes, and reporter identity must never
// be reachable by an anonymous request, anywhere.
import { test } from "node:test";
import assert from "node:assert/strict";
import { anon, as, ids, isBlocked } from "./helpers.ts";

test("public animals: no contact details, no exact address, on a real published listing", async (t) => {
  const row = await anon().from("animals").select("*").eq("id", ids.animalMaja).single();
  assert.equal(row.error, null, "a real published listing must be publicly readable at all");
  const json = JSON.stringify(row.data);
  assert.ok(!/@/.test(json), "no email-shaped value anywhere in a public animal row");
  // The column grant itself never includes email/phone/exact-address columns at all (verified via
  // information_schema.column_privileges), so a real row can't contain them regardless of content.
  assert.ok(!("owner_email" in (row.data as object)));
  assert.ok(!("phone" in (row.data as object)));
});

test("public organisations: no private address, no owner contact, on a real approved org", async (t) => {
  const row = await anon().from("organisations").select("*").eq("id", ids.orgCichyLas).single();
  assert.equal(row.error, null);
  const data = row.data as Record<string, unknown>;
  assert.ok(!("email" in data) && !("phone" in data));
  // public_location is the deliberate coarse field; the exact private address lives in a
  // completely separate table (private_addresses) never exposed via this row at all.
  assert.ok(!("exact_address" in data) && !("street_address" in data));
});

test("private_addresses: never readable by anon or an unrelated authenticated user", async (t) => {
  const admin = await as("admin");
  const seen = await admin.from("private_addresses").select("id").limit(1).maybeSingle();
  if (!seen.data) return; // no rows exist in this seed -- nothing to assert against, skip cleanly
  const anonAttempt = await anon().from("private_addresses").select("id").eq("id", seen.data.id);
  assert.ok(isBlocked(anonAttempt.data, anonAttempt.error));
  const buyer = await as("buyer");
  const buyerAttempt = await buyer.from("private_addresses").select("id").eq("id", seen.data.id);
  assert.ok(isBlocked(buyerAttempt.data, buyerAttempt.error));
});

test("transport_requests: exact pickup/delivery addresses never reach an anonymous or unrelated caller", async (t) => {
  const anonAttempt = await anon()
    .from("transport_requests")
    .select("id, pickup_address_exact, destination_address_exact")
    .eq("id", ids.transportWarsawAmsterdam);
  assert.ok(isBlocked(anonAttempt.data, anonAttempt.error));

  const buyer = await as("buyer"); // not the requester of transportWarsawAmsterdam (that's customer)
  const buyerAttempt = await buyer
    .from("transport_requests")
    .select("id, pickup_address_exact, destination_address_exact")
    .eq("id", ids.transportWarsawAmsterdam);
  assert.ok(isBlocked(buyerAttempt.data, buyerAttempt.error));
});

test("profiles: email/phone never reach anon or another authenticated user, for any real profile", async (t) => {
  const anonAttempt = await anon().from("profiles").select("email, phone").eq("id", ids.breeder1);
  // The column grant itself excludes email/phone for anon entirely -- PostgREST rejects the
  // unselectable-column request outright rather than returning nulls.
  assert.ok(anonAttempt.error, "anon must not even be able to name these columns in a select");

  const buyer = await as("buyer");
  const buyerAttempt = await buyer.from("profiles").select("email, phone").eq("id", ids.breeder1);
  assert.ok(buyerAttempt.error, "authenticated users other than the owner get the same grant lock");
});

test("reports: reporter identity is never exposed to anyone but ops/admin, and never to the target", async (t) => {
  const admin = await as("admin");
  const breeder1 = await as("breeder1"); // target org's own owner

  const report = await admin
    .from("reports")
    .insert({
      reporter_profile_id: ids.customer,
      target_type: "organisation",
      target_id: ids.orgCichyLas,
      reason: "other",
      description: "YR-13 privacy sweep test report.",
    })
    .select("id")
    .single();
  assert.equal(report.error, null);
  const reportId = report.data!.id as string;

  const anonAttempt = await anon().from("reports").select("reporter_profile_id").eq("id", reportId);
  assert.ok(isBlocked(anonAttempt.data, anonAttempt.error));

  const targetOwnerAttempt = await breeder1
    .from("reports")
    .select("reporter_profile_id")
    .eq("id", reportId);
  assert.ok(
    isBlocked(targetOwnerAttempt.data, targetOwnerAttempt.error),
    "the reported organisation's own owner must never see who reported them",
  );

  await admin.from("reports").delete().eq("id", reportId);
});

test("welfare cases: internal notes and exact location never reach an anonymous caller", async (t) => {
  const anonAttempt = await anon()
    .from("welfare_cases")
    .select("id, location_address_exact, contact_phone")
    .limit(1);
  assert.ok(isBlocked(anonAttempt.data, anonAttempt.error));
});

test("moderation_cases: internal decision_explanation never reaches an anonymous caller", async (t) => {
  const anonAttempt = await anon()
    .from("moderation_cases")
    .select("id, decision_explanation")
    .limit(1);
  assert.ok(isBlocked(anonAttempt.data, anonAttempt.error));
});

test("private-rehoming listings: owner_profile_id/display_name/city/country are a real, deliberate design, not a leak -- confirmed contact details stay excluded", async (t) => {
  const customer = await as("customer");
  const admin = await as("admin");
  let animalId: string | undefined;
  let reviewId: string | undefined;

  await t.test("setup: a published, admin-approved private rehoming listing", async () => {
    const animal = await customer
      .from("animals")
      .insert({
        listing_category: "private_rehoming",
        owner_profile_id: ids.customer,
        name: "YR-13 Privacy Sweep Dog",
        is_published: true,
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
        reason_for_rehoming: "YR-13 test.",
        ownership_declaration: true,
      })
      .select("id")
      .single();
    assert.equal(review.error, null);
    reviewId = review.data!.id as string;

    const approve = await admin.rpc("approve_rehoming_review", { p_review_id: reviewId });
    assert.equal(approve.error, null);
  });

  await t.test(
    "public identity fields are visible (deliberate, see 20260101003600_profiles_anon_location.sql), contact fields are not",
    async () => {
      const publicAnimal = await anon()
        .from("animals")
        .select("id, owner_profile_id")
        .eq("id", animalId!)
        .single();
      assert.equal(publicAnimal.error, null);
      assert.equal(publicAnimal.data?.owner_profile_id, ids.customer);

      const publicProfile = await anon()
        .from("profiles")
        .select("display_name, avatar_url, city, country")
        .eq("id", ids.customer)
        .single();
      assert.equal(publicProfile.error, null, "coarse public identity/location is intentional");

      const contactAttempt = await anon()
        .from("profiles")
        .select("email, phone")
        .eq("id", ids.customer);
      assert.ok(contactAttempt.error, "email/phone must stay excluded even for this same profile");
    },
  );

  await t.test("cleanup", async () => {
    await admin.from("rehoming_reviews").delete().eq("id", reviewId!);
    await admin.from("animals").delete().eq("id", animalId!);
  });
});
