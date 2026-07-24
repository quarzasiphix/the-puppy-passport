// Regression + access-control coverage for verified-organisation fundraising
// (supabase/migrations/20260101005600_fundraising.sql, docs/FUNDRAISING_POLICY.md). This feature
// is financially sensitive even in simulation, so every rule from the policy document gets a real
// test against the actual API — not just a read of the RLS SQL. See docs/DATABASE_TESTING.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { anon, as, ids, isBlocked } from "./helpers.ts";

// Builds one real, valid fixture chain (adoption application -> accepted quotation) for Reksio,
// the only seeded animal owned by an eligible (foundation) organisation. Returns a cleanup
// function; every test below must call it in a finally block regardless of outcome.
async function buildEligibleFixture() {
  const customer = await as("customer");
  const ops = await as("ops");
  const admin = await as("admin");

  // A buyer's INSERT must start as 'submitted' (locked by
  // prevent_buyer_writes_to_org_controlled_fields, 20260101008900) -- realistic fixture setup goes
  // through the real workflow: submit as the customer, then have an admin approve it, rather than
  // self-inserting an already-"approved" row.
  const application = await customer
    .from("buyer_applications")
    .insert({
      animal_id: ids.animalReksio,
      buyer_id: ids.customer,
      organization_id: ids.orgFundacja,
      application_type: "adoption",
    })
    .select("id")
    .single();
  assert.equal(application.error, null);
  const applicationId = application.data!.id as string;

  const approved = await admin
    .from("buyer_applications")
    .update({ status: "approved" })
    .eq("id", applicationId)
    .select("status")
    .single();
  assert.equal(approved.error, null);
  assert.equal(approved.data?.status, "approved");

  const quotation = await ops
    .from("quotations")
    .insert({
      transport_request_id: ids.transportReksio,
      service_type: "shared",
      total_price: 300,
      currency: "EUR",
      status: "accepted",
      created_by: ids.ops,
    })
    .select("id")
    .single();
  assert.equal(quotation.error, null);
  const quotationId = quotation.data!.id as string;

  return {
    applicationId,
    quotationId,
    cleanup: async () => {
      await ops.from("quotations").delete().eq("id", quotationId);
      await customer.from("buyer_applications").delete().eq("id", applicationId);
    },
  };
}

test("fundraising: an org cannot self-declare target_reached or partially_funded (20260101009100)", async (t) => {
  const fixture = await buildEligibleFixture();
  const foundation1 = await as("foundation1");
  const admin = await as("admin");
  let campaignId: string | undefined;

  await t.test("setup: an active campaign owned by the eligible org", async () => {
    const created = await foundation1
      .from("fundraising_campaigns")
      .insert({
        organisation_id: ids.orgFundacja,
        animal_id: ids.animalReksio,
        buyer_application_id: fixture.applicationId,
        transport_request_id: ids.transportReksio,
        quotation_id: fixture.quotationId,
        title: "Outcome-status lock test",
        target_amount: 300,
        currency: "EUR",
      })
      .select("id")
      .single();
    assert.equal(created.error, null);
    campaignId = created.data!.id as string;

    const activated = await foundation1
      .from("fundraising_campaigns")
      .update({ status: "active" })
      .eq("id", campaignId)
      .select("status")
      .single();
    assert.equal(activated.error, null);
    assert.equal(activated.data?.status, "active");
  });

  await t.test("the org cannot self-declare its own campaign target_reached", async () => {
    const attempt = await foundation1
      .from("fundraising_campaigns")
      .update({ status: "target_reached" })
      .eq("id", campaignId!)
      .select();
    assert.ok(
      isBlocked(attempt.data, attempt.error),
      "an organisation must not be able to publicly claim its own fundraiser reached its target",
    );
  });

  await t.test("the org cannot self-declare its own campaign partially_funded either", async () => {
    const attempt = await foundation1
      .from("fundraising_campaigns")
      .update({ status: "partially_funded" })
      .eq("id", campaignId!)
      .select();
    assert.ok(isBlocked(attempt.data, attempt.error));
  });

  await t.test("an admin can still set either outcome status", async () => {
    const set = await admin
      .from("fundraising_campaigns")
      .update({ status: "target_reached" })
      .eq("id", campaignId!)
      .select("status")
      .single();
    assert.equal(set.error, null);
    assert.equal(set.data?.status, "target_reached");
  });

  await t.test("cleanup", async () => {
    await admin.from("fundraising_campaigns").delete().eq("id", campaignId!);
    await fixture.cleanup();
  });
});

test("fundraising: only an approved foundation/shelter/rescue org can create a campaign", async () => {
  const fixture = await buildEligibleFixture();
  try {
    const breeder2 = await as("breeder2");
    const asKennel = await breeder2
      .from("fundraising_campaigns")
      .insert({
        organisation_id: ids.orgWolnaDolina,
        animal_id: ids.animalRico,
        buyer_application_id: fixture.applicationId,
        transport_request_id: ids.transportReksio,
        quotation_id: fixture.quotationId,
        title: "Should be blocked — kennel is not an eligible org type",
        target_amount: 100,
      })
      .select();
    assert.ok(
      isBlocked(asKennel.data, asKennel.error),
      "a kennel (commercial breeder) must never create a fundraiser",
    );

    const foundation1 = await as("foundation1");
    const asEligible = await foundation1
      .from("fundraising_campaigns")
      .insert({
        organisation_id: ids.orgFundacja,
        animal_id: ids.animalReksio,
        buyer_application_id: fixture.applicationId,
        transport_request_id: ids.transportReksio,
        quotation_id: fixture.quotationId,
        title: "Help Reksio reach his new home",
        target_amount: 300,
        currency: "EUR",
      })
      .select("id, status");
    assert.equal(
      asEligible.error,
      null,
      `expected the eligible org to succeed, got ${JSON.stringify(asEligible.error)}`,
    );
    assert.equal(asEligible.data?.[0]?.status, "draft");
    // Org owners have no DELETE policy on fundraising_campaigns at all (by design — a campaign
    // moves through states, it doesn't disappear; only admin can remove one outright), confirmed
    // while writing this test: the org's own delete silently affected 0 rows (RLS-filtered, no
    // error) rather than actually deleting it. Only admin can clean this up.
    const admin = await as("admin");
    await admin.from("fundraising_campaigns").delete().eq("id", asEligible.data![0].id);
  } finally {
    await fixture.cleanup();
  }
});

test("fundraising: cannot create a campaign for a purchase application, an unaccepted quotation, or a duplicate quotation", async () => {
  // Deliberately the "buyer" persona, not "customer" — buildEligibleFixture() below also creates
  // an adoption application for customer+Reksio, and buyer_applications_active_unique is keyed on
  // (buyer_id, animal_id) regardless of application_type, so reusing the same buyer for both would
  // collide with itself rather than actually testing anything.
  const buyer = await as("buyer");
  const ops = await as("ops");
  const admin = await as("admin");
  const foundation1 = await as("foundation1");

  // A purchase-type application must never be usable to back a fundraiser (never fund buying an
  // animal — docs/FUNDRAISING_POLICY.md). Realistic fixture: submit as the buyer, then admin
  // approves (a buyer's own INSERT must start as 'submitted', see buildEligibleFixture above).
  const purchaseApplication = await buyer
    .from("buyer_applications")
    .insert({
      animal_id: ids.animalReksio,
      buyer_id: ids.buyer,
      organization_id: ids.orgFundacja,
      application_type: "purchase",
    })
    .select("id")
    .single();
  assert.equal(purchaseApplication.error, null);
  const purchaseApplicationId = purchaseApplication.data!.id as string;

  const approvedPurchase = await admin
    .from("buyer_applications")
    .update({ status: "approved" })
    .eq("id", purchaseApplicationId);
  assert.equal(approvedPurchase.error, null);

  const sentQuotation = await ops
    .from("quotations")
    .insert({
      transport_request_id: ids.transportReksio,
      service_type: "shared",
      total_price: 300,
      currency: "EUR",
      status: "sent", // not accepted
      created_by: ids.ops,
    })
    .select("id")
    .single();
  assert.equal(sentQuotation.error, null);
  const sentQuotationId = sentQuotation.data!.id as string;

  try {
    const withPurchaseApplication = await foundation1
      .from("fundraising_campaigns")
      .insert({
        organisation_id: ids.orgFundacja,
        animal_id: ids.animalReksio,
        buyer_application_id: purchaseApplicationId,
        transport_request_id: ids.transportReksio,
        quotation_id: sentQuotationId,
        title: "Should be blocked — purchase application",
        target_amount: 300,
      })
      .select();
    assert.ok(isBlocked(withPurchaseApplication.data, withPurchaseApplication.error));

    const fixture = await buildEligibleFixture();
    try {
      const withUnacceptedQuotation = await foundation1
        .from("fundraising_campaigns")
        .insert({
          organisation_id: ids.orgFundacja,
          animal_id: ids.animalReksio,
          buyer_application_id: fixture.applicationId,
          transport_request_id: ids.transportReksio,
          quotation_id: sentQuotationId,
          title: "Should be blocked — quotation not accepted",
          target_amount: 300,
        })
        .select();
      assert.ok(isBlocked(withUnacceptedQuotation.data, withUnacceptedQuotation.error));

      const first = await foundation1
        .from("fundraising_campaigns")
        .insert({
          organisation_id: ids.orgFundacja,
          animal_id: ids.animalReksio,
          buyer_application_id: fixture.applicationId,
          transport_request_id: ids.transportReksio,
          quotation_id: fixture.quotationId,
          title: "First campaign for this quotation",
          target_amount: 300,
        })
        .select("id")
        .single();
      assert.equal(first.error, null);

      try {
        const duplicate = await foundation1
          .from("fundraising_campaigns")
          .insert({
            organisation_id: ids.orgFundacja,
            animal_id: ids.animalReksio,
            buyer_application_id: fixture.applicationId,
            transport_request_id: ids.transportReksio,
            quotation_id: fixture.quotationId,
            title: "Should be blocked — duplicate campaign for the same quotation",
            target_amount: 300,
          })
          .select();
        // Not isBlocked() — this is a unique-constraint violation (23505), not an RLS
        // permission-denied or a silently-empty result, so it needs its own explicit check.
        assert.notEqual(
          duplicate.error,
          null,
          "a second non-terminal campaign against the same quotation must be rejected",
        );
        assert.equal((duplicate.error as { code?: string } | null)?.code, "23505");
      } finally {
        const admin = await as("admin");
        await admin.from("fundraising_campaigns").delete().eq("id", first.data!.id);
      }
    } finally {
      await fixture.cleanup();
    }
  } finally {
    await ops.from("quotations").delete().eq("id", sentQuotationId);
    await buyer.from("buyer_applications").delete().eq("id", purchaseApplicationId);
  }
});

test("fundraising: public visibility, contributions, and the anonymity/total distinction", async (t) => {
  const fixture = await buildEligibleFixture();
  const foundation1 = await as("foundation1");
  const admin = await as("admin");

  const created = await foundation1
    .from("fundraising_campaigns")
    .insert({
      organisation_id: ids.orgFundacja,
      animal_id: ids.animalReksio,
      buyer_application_id: fixture.applicationId,
      transport_request_id: ids.transportReksio,
      quotation_id: fixture.quotationId,
      title: "Help Reksio reach his new home",
      target_amount: 300,
    })
    .select("id")
    .single();
  assert.equal(created.error, null);
  const campaignId = created.data!.id as string;

  try {
    await t.test("draft campaigns are invisible to anon and to an unrelated org", async () => {
      const asAnon = await anon().from("fundraising_campaigns").select("id").eq("id", campaignId);
      assert.ok(isBlocked(asAnon.data, asAnon.error));
      const breeder1 = await as("breeder1");
      const asOther = await breeder1
        .from("fundraising_campaigns")
        .select("id")
        .eq("id", campaignId);
      assert.ok(isBlocked(asOther.data, asOther.error));
    });

    await t.test(
      "an org cannot self-approve, self-activate or self-complete their own campaign",
      async () => {
        const selfApprove = await foundation1
          .from("fundraising_campaigns")
          .update({ status: "approved" })
          .eq("id", campaignId)
          .select();
        assert.ok(isBlocked(selfApprove.data, selfApprove.error));
      },
    );

    await t.test("admin activates it, then it becomes publicly visible", async () => {
      const activated = await admin
        .from("fundraising_campaigns")
        .update({ status: "active" })
        .eq("id", campaignId)
        .select("status")
        .single();
      assert.equal(activated.error, null);
      assert.equal(activated.data?.status, "active");

      const asAnon = await anon()
        .from("fundraising_campaigns")
        .select("title")
        .eq("id", campaignId)
        .single();
      assert.equal(asAnon.error, null);
      assert.equal(asAnon.data?.title, "Help Reksio reach his new home");
    });

    await t.test(
      "only a real, simulated contribution to an active campaign is accepted",
      async () => {
        const buyer = await as("buyer");
        const nonSimulated = await buyer
          .from("fundraising_contributions")
          .insert({
            campaign_id: campaignId,
            supporter_profile_id: ids.buyer,
            amount: 20,
            is_simulated: false,
          })
          .select();
        assert.ok(
          isBlocked(nonSimulated.data, nonSimulated.error),
          "no real payment path exists yet",
        );
      },
    );

    await t.test(
      "anonymity hides attribution from the public list, never from the total",
      async () => {
        const buyer = await as("buyer");
        const customer = await as("customer");

        const named = await buyer
          .from("fundraising_contributions")
          .insert({
            campaign_id: campaignId,
            supporter_profile_id: ids.buyer,
            amount: 50,
            payment_status: "completed",
            display_publicly: true,
            public_message: "Good luck Reksio!",
          })
          .select("id")
          .single();
        assert.equal(named.error, null);

        const anonymous = await customer
          .from("fundraising_contributions")
          .insert({
            campaign_id: campaignId,
            supporter_profile_id: ids.customer,
            amount: 75,
            payment_status: "completed",
            display_publicly: false,
          })
          .select("id")
          .single();
        assert.equal(anonymous.error, null);

        try {
          const publicRows = await anon()
            .from("public_fundraising_contributions")
            .select("amount, public_message")
            .eq("campaign_id", campaignId);
          assert.equal(publicRows.error, null);
          assert.equal(
            publicRows.data?.length,
            1,
            "only the non-anonymous contribution is a public row",
          );
          assert.equal(publicRows.data?.[0]?.amount, 50);

          const total = await anon()
            .from("public_fundraising_totals")
            .select("total_collected")
            .eq("campaign_id", campaignId)
            .single();
          assert.equal(total.error, null);
          assert.equal(
            Number(total.data?.total_collected),
            125,
            "the total must include the anonymous contribution's amount even though it has no public row",
          );
        } finally {
          await admin.from("fundraising_contributions").delete().eq("id", named.data!.id);
          await admin.from("fundraising_contributions").delete().eq("id", anonymous.data!.id);
        }
      },
    );

    await t.test(
      "the campaign's purpose is locked once a completed contribution exists",
      async () => {
        const buyer = await as("buyer");
        const contribution = await buyer
          .from("fundraising_contributions")
          .insert({
            campaign_id: campaignId,
            supporter_profile_id: ids.buyer,
            amount: 10,
            payment_status: "completed",
          })
          .select("id")
          .single();
        assert.equal(contribution.error, null);

        try {
          const attempt = await foundation1
            .from("fundraising_campaigns")
            .update({ animal_id: ids.animalMaja })
            .eq("id", campaignId)
            .select();
          // Not isBlocked() here — this is a custom trigger exception (P0001), not an RLS
          // permission-denied or a silently-empty result, so it needs its own explicit check.
          assert.notEqual(
            attempt.error,
            null,
            "the animal/transport/quotation/org must not be changeable after a completed contribution",
          );
          assert.equal((attempt.error as { code?: string } | null)?.code, "P0001");
        } finally {
          await admin.from("fundraising_contributions").delete().eq("id", contribution.data!.id);
        }
      },
    );
  } finally {
    await admin.from("fundraising_campaigns").delete().eq("id", campaignId);
    await fixture.cleanup();
  }
});
