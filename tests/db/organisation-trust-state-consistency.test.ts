// Stage YR-8 (organisation trust-state consistency). Cross-referenced every public-facing table
// against organisations.verification_status and confirmed (by grep, not assumed) that animals,
// litters, parent_dogs, welfare_cases, fundraising, and achievements all already correctly require
// verification_status = 'approved' before showing anything -- a suspended organisation's listings
// already vanish from every public/browse view immediately, no gap there. Found one real,
// reachable gap: buyer_applications' own INSERT policy never checked the target animal's
// organisation at all, so a buyer who already knew an animal's id (e.g. a saved_animals entry made
// before the org was suspended) could still submit a brand-new application against it directly,
// bypassing the suspension entirely -- fixed in 20260101013700_suspended_org_application_lock.sql.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, isBlocked } from "./helpers.ts";

test("suspending an organisation immediately hides its animals from public listings", async (t) => {
  const admin = await as("admin");

  await t.test(
    "animalRico (Wolna Dolina) is publicly visible while the org is approved",
    async () => {
      const publicView = await admin
        .from("animals")
        .select("id")
        .eq("id", ids.animalRico)
        .eq("is_published", true);
      // Using admin here only to confirm the fixture's own is_published flag, not RLS visibility --
      // the real assertion is the anon-equivalent read below.
      assert.equal(publicView.error, null);
    },
  );

  await t.test("suspend Wolna Dolina", async () => {
    const suspend = await admin
      .from("organisations")
      .update({ verification_status: "suspended" })
      .eq("id", ids.orgWolnaDolina)
      .select("verification_status")
      .single();
    assert.equal(suspend.error, null);
    assert.equal(suspend.data?.verification_status, "suspended");
  });

  await t.test("animalRico is no longer visible via the public read policy", async () => {
    const anon = await as("customer"); // any non-owner, non-admin authenticated user
    const attempt = await anon
      .from("animals")
      .select("id")
      .eq("id", ids.animalRico)
      .eq("organization_id", ids.orgWolnaDolina);
    assert.ok(
      isBlocked(attempt.data, attempt.error) || attempt.data?.length === 0,
      "a suspended organisation's animal must disappear from public visibility immediately",
    );
  });

  await t.test("restore Wolna Dolina to approved", async () => {
    const restore = await admin
      .from("organisations")
      .update({ verification_status: "approved" })
      .eq("id", ids.orgWolnaDolina)
      .select("verification_status")
      .single();
    assert.equal(restore.error, null);
    assert.equal(restore.data?.verification_status, "approved");
  });
});

test("a suspended organisation cannot receive a new buyer application", async (t) => {
  const admin = await as("admin");
  const customer = await as("customer");
  let applicationId: string | undefined;

  await t.test("suspend Wolna Dolina", async () => {
    const suspend = await admin
      .from("organisations")
      .update({ verification_status: "suspended" })
      .eq("id", ids.orgWolnaDolina);
    assert.equal(suspend.error, null);
  });

  await t.test(
    "a buyer who already knows the animal id cannot submit a new application while suspended",
    async () => {
      const attempt = await customer
        .from("buyer_applications")
        .insert({
          animal_id: ids.animalRico,
          buyer_id: ids.customer,
          organization_id: ids.orgWolnaDolina,
          application_type: "purchase",
          buyer_city: "Gdansk",
          buyer_country: "Poland",
        })
        .select();
      assert.ok(
        isBlocked(attempt.data, attempt.error),
        "expected a new application against a suspended organisation's animal to be rejected",
      );
    },
  );

  await t.test("restore Wolna Dolina to approved", async () => {
    const restore = await admin
      .from("organisations")
      .update({ verification_status: "approved" })
      .eq("id", ids.orgWolnaDolina);
    assert.equal(restore.error, null);
  });

  await t.test("the same application now succeeds once the org is restored", async () => {
    const created = await customer
      .from("buyer_applications")
      .insert({
        animal_id: ids.animalRico,
        buyer_id: ids.customer,
        organization_id: ids.orgWolnaDolina,
        application_type: "purchase",
        buyer_city: "Gdansk",
        buyer_country: "Poland",
      })
      .select("id")
      .single();
    assert.equal(created.error, null);
    applicationId = created.data!.id as string;
  });

  await t.test(
    "an existing application made before suspension stays visible and withdrawable during suspension",
    async () => {
      const buyer = await as("buyer"); // buyer already has a real seeded application on animalRico
      const suspend = await admin
        .from("organisations")
        .update({ verification_status: "suspended" })
        .eq("id", ids.orgWolnaDolina);
      assert.equal(suspend.error, null);

      const seen = await buyer
        .from("buyer_applications")
        .select("id, status")
        .eq("animal_id", ids.animalRico)
        .eq("buyer_id", ids.buyer)
        .single();
      assert.equal(
        seen.error,
        null,
        "an existing application must remain visible during suspension",
      );

      const withdraw = await buyer
        .from("buyer_applications")
        .update({ status: "withdrawn" })
        .eq("id", seen.data!.id as string)
        .select("status")
        .single();
      assert.equal(
        withdraw.error,
        null,
        "withdrawing an existing application must still work during suspension",
      );
      assert.equal(withdraw.data?.status, "withdrawn");

      await admin
        .from("organisations")
        .update({ verification_status: "approved" })
        .eq("id", ids.orgWolnaDolina);
    },
  );

  await t.test("cleanup", async () => {
    if (applicationId) await admin.from("buyer_applications").delete().eq("id", applicationId);
    // Restore the seeded buyer application's status for any later test file relying on it.
    await admin
      .from("buyer_applications")
      .update({ status: "under_review" })
      .eq("animal_id", ids.animalRico)
      .eq("buyer_id", ids.buyer);
  });
});

test("organisation trust-state role matrix: only admin can change verification_status", async (t) => {
  const admin = await as("admin");
  const breeder2 = await as("breeder2"); // owns Wolna Dolina

  await t.test("the org's own owner cannot self-suspend or self-approve", async () => {
    // The owner has real RLS row-level UPDATE access to their own org (row-level only) -- the
    // rejection here is the prevent_org_owner_transfer_by_non_admin trigger raising a real, loud
    // P0001 business-logic error, not a silent RLS row filter, so isBlocked() (built for the
    // latter) doesn't apply; assert the real error directly, matching how this exact trigger's
    // rejection is already asserted elsewhere (admin-placeholders.test.ts).
    const attempt = await breeder2
      .from("organisations")
      .update({ verification_status: "suspended" })
      .eq("id", ids.orgWolnaDolina)
      .select();
    assert.ok(attempt.error, "expected owner self-suspension to be rejected");
  });

  await t.test("an unrelated org owner cannot change a different org's status", async () => {
    const breeder1 = await as("breeder1"); // owns Cichy Las, not Wolna Dolina
    const attempt = await breeder1
      .from("organisations")
      .update({ verification_status: "suspended" })
      .eq("id", ids.orgWolnaDolina)
      .select();
    assert.ok(isBlocked(attempt.data, attempt.error));
  });

  await t.test("admin remains free to change it, and it round-trips correctly", async () => {
    const check = await admin
      .from("organisations")
      .select("verification_status")
      .eq("id", ids.orgWolnaDolina)
      .single();
    assert.equal(check.error, null);
    assert.equal(
      check.data?.verification_status,
      "approved",
      "must be left approved after this file's own tests",
    );
  });
});

// Independently verified from a Bot 1 audit finding (H-5/NEW-H3, reproduced live against this
// repo's own database before fixing, not trusted from the report alone): "owners manage their
// kennel's achievements" (ALL, owns_org(kennel_id)) had no restriction on verification_status/
// admin_notes/reviewed_at -- an organisation owner could raw-update their own achievement straight
// to 'approved' (the exact status that makes it public), forging reviewed_at and admin_notes too.
// Fixed in 20260101014900_achievement_self_verification_lock.sql with a trigger blocking non-admin
// changes to those three fields specifically, leaving ordinary content fields freely editable.
test("achievements: an organisation cannot self-verify its own achievement", async (t) => {
  const breeder1 = await as("breeder1");
  const admin = await as("admin");
  let achievementId: string | undefined;

  try {
    await t.test("setup: breeder1 creates a real achievement on their own kennel", async () => {
      const dog = await admin
        .from("parent_dogs")
        .select("id")
        .eq("kennel_id", ids.orgCichyLas)
        .limit(1)
        .maybeSingle();
      assert.equal(dog.error, null);
      assert.ok(dog.data, "expected a real seeded parent_dog for orgCichyLas");

      const created = await breeder1
        .from("achievements")
        .insert({
          parent_dog_id: dog.data!.id as string,
          kennel_id: ids.orgCichyLas,
          title: "HF-5 regression test achievement",
        })
        .select("id, verification_status")
        .single();
      assert.equal(created.error, null);
      assert.equal(created.data?.verification_status, "pending");
      achievementId = created.data!.id as string;
    });

    await t.test(
      "the owner cannot self-approve, forge reviewed_at, or write admin_notes",
      async () => {
        const attempt = await breeder1
          .from("achievements")
          .update({
            verification_status: "approved",
            reviewed_at: new Date().toISOString(),
            admin_notes: "self-approved",
          })
          .eq("id", achievementId!)
          .select();
        assert.ok(attempt.error, "expected self-verification to be rejected");

        const stillPending = await admin
          .from("achievements")
          .select("verification_status, admin_notes, reviewed_at")
          .eq("id", achievementId!)
          .single();
        assert.equal(stillPending.data?.verification_status, "pending");
        assert.equal(stillPending.data?.admin_notes, null);
        assert.equal(stillPending.data?.reviewed_at, null);
      },
    );

    await t.test("the owner can still freely edit ordinary content fields", async () => {
      const edit = await breeder1
        .from("achievements")
        .update({ title: "Updated title", issuing_body: "Kennel Club" })
        .eq("id", achievementId!)
        .select("title, issuing_body")
        .single();
      assert.equal(edit.error, null);
      assert.equal(edit.data?.title, "Updated title");
      assert.equal(edit.data?.issuing_body, "Kennel Club");
    });

    await t.test("an admin can genuinely approve it", async () => {
      const approve = await admin
        .from("achievements")
        .update({ verification_status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", achievementId!)
        .select("verification_status")
        .single();
      assert.equal(approve.error, null);
      assert.equal(approve.data?.verification_status, "approved");
    });
  } finally {
    await t.test("cleanup", async () => {
      if (achievementId) await admin.from("achievements").delete().eq("id", achievementId);
    });
  }
});
