// End-to-end workflow coverage: each test drives a real multi-step Havenpaw scenario across two
// or more personas, against the real local Supabase API, asserting actual state at each step
// rather than just "no error was thrown". See docs/DATABASE_TESTING.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, isBlocked } from "./helpers.ts";

test("workflow: buyer applies for a puppy, breeder reviews it", async (t) => {
  const buyer = await as("buyer");
  const breeder1 = await as("breeder1");
  let applicationId: string | undefined;

  await t.test("buyer submits an application for an available puppy", async () => {
    const created = await buyer
      .from("buyer_applications")
      .insert({
        animal_id: ids.animalMaja,
        buyer_id: ids.buyer,
        organization_id: ids.orgCichyLas,
        application_type: "purchase",
        message: "Workflow test application for Maja.",
      })
      .select("id, status")
      .single();
    assert.equal(created.error, null);
    assert.equal(created.data?.status, "submitted");
    applicationId = created.data!.id as string;
  });

  await t.test("the kennel reviews and approves the application", async () => {
    const updated = await breeder1
      .from("buyer_applications")
      .update({ status: "approved", breeder_response: "Welcome to the family, Maja!" })
      .eq("id", applicationId!)
      .select("status, breeder_response")
      .single();
    assert.equal(updated.error, null);
    assert.equal(updated.data?.status, "approved");
  });

  await t.test("the buyer sees the updated status", async () => {
    const seen = await buyer
      .from("buyer_applications")
      .select("status")
      .eq("id", applicationId!)
      .single();
    assert.equal(seen.error, null);
    assert.equal(seen.data?.status, "approved");
  });

  await t.test("cleanup", async () => {
    await buyer.from("buyer_applications").delete().eq("id", applicationId!);
  });
});

test("workflow: foundation receives an adoption enquiry", async (t) => {
  const customer = await as("customer");
  const foundation1 = await as("foundation1");
  const breeder1 = await as("breeder1");
  let applicationId: string | undefined;

  await t.test("a private customer expresses interest in an adoption animal", async () => {
    const created = await customer
      .from("buyer_applications")
      .insert({
        animal_id: ids.animalReksio,
        buyer_id: ids.customer,
        organization_id: ids.orgFundacja,
        application_type: "adoption",
        message: "Workflow test adoption enquiry for Reksio.",
      })
      .select("id")
      .single();
    assert.equal(created.error, null);
    applicationId = created.data!.id as string;
  });

  await t.test("the foundation can see the enquiry", async () => {
    const seen = await foundation1
      .from("buyer_applications")
      .select("id")
      .eq("id", applicationId!)
      .single();
    assert.equal(seen.error, null);
  });

  await t.test("an unrelated kennel cannot see the enquiry", async () => {
    const blocked = await breeder1.from("buyer_applications").select("id").eq("id", applicationId!);
    assert.ok(isBlocked(blocked.data, blocked.error));
  });

  await t.test("cleanup", async () => {
    await customer.from("buyer_applications").delete().eq("id", applicationId!);
  });
});

test("workflow: private rehoming stays hidden until admin approval", async (t) => {
  const customer = await as("customer");
  const admin = await as("admin");
  let animalId: string | undefined;
  let reviewId: string | undefined;

  await t.test("owner publishes a private-rehoming animal and submits it for review", async () => {
    const animal = await customer
      .from("animals")
      .insert({
        listing_category: "private_rehoming",
        owner_profile_id: ids.customer,
        name: "Workflow Test Rehoming Dog",
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
        reason_for_rehoming: "Workflow test — moving abroad.",
        ownership_declaration: true,
      })
      .select("id, admin_status")
      .single();
    assert.equal(review.error, null);
    assert.equal(review.data?.admin_status, "pending");
    reviewId = review.data!.id as string;
  });

  await t.test("the animal is not publicly visible while pending", async () => {
    const publicView = await as("buyer").then((c) =>
      c.from("animals").select("id").eq("id", animalId!),
    );
    assert.ok(isBlocked(publicView.data, publicView.error));
  });

  await t.test("an admin approves the review", async () => {
    const approved = await admin
      .from("rehoming_reviews")
      .update({ admin_status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", reviewId!)
      .select("admin_status")
      .single();
    assert.equal(approved.error, null);
    assert.equal(approved.data?.admin_status, "approved");
  });

  await t.test("the animal becomes publicly visible", async () => {
    const publicView = await as("buyer").then((c) =>
      c.from("animals").select("name").eq("id", animalId!).single(),
    );
    assert.equal(publicView.error, null);
    assert.equal(publicView.data?.name, "Workflow Test Rehoming Dog");
  });

  await t.test("cleanup", async () => {
    await admin.from("rehoming_reviews").delete().eq("id", reviewId!);
    await customer.from("animals").delete().eq("id", animalId!);
  });
});

test("workflow: transport request submission through to a sent quotation", async (t) => {
  const customer = await as("customer");
  const ops = await as("ops");
  let requestId: string | undefined;

  await t.test("customer creates and submits a transport request", async () => {
    // The seed data inserts request_number literals directly (TR-2026-000001..7) without ever
    // advancing public.transport_request_seq, so leaving request_number null here and letting the
    // set_transport_request_number() trigger auto-generate from that same untouched sequence would
    // collide with a seeded row. Supplying our own unique value sidesteps that entirely (the
    // trigger only generates one when the column is null, so this is a supported path).
    const requestNumber = `TR-TEST-${Date.now()}`;
    const draft = await customer
      .from("transport_requests")
      .insert({
        requester_profile_id: ids.customer,
        request_number: requestNumber,
        request_purpose: "own_dog",
        animal_name: "Workflow Test Dog",
        pickup_country: "Poland",
        pickup_city: "Warsaw",
        destination_country: "Germany",
        destination_city: "Munich",
        status: "draft",
      })
      .select("id, request_number, status")
      .single();
    assert.equal(draft.error, null);
    assert.equal(draft.data?.request_number, requestNumber);
    requestId = draft.data!.id as string;

    const submitted = await customer
      .from("transport_requests")
      .update({ status: "submitted" })
      .eq("id", requestId)
      .select("status")
      .single();
    assert.equal(submitted.error, null);
    assert.equal(submitted.data?.status, "submitted");

    const history = await customer
      .from("transport_status_history")
      .insert({ transport_request_id: requestId, status: "submitted", changed_by: ids.customer })
      .select("id");
    assert.equal(history.error, null);
  });

  await t.test(
    "operations reviews the request and prepares a quotation (draft, not customer-visible)",
    async () => {
      const quotation = await ops
        .from("quotations")
        .insert({
          transport_request_id: requestId!,
          service_type: "individual",
          total_price: 450,
          currency: "EUR",
          status: "draft",
          created_by: ids.ops,
        })
        .select("id")
        .single();
      assert.equal(quotation.error, null);
      const quotationId = quotation.data!.id as string;

      const invisible = await customer.from("quotations").select("id").eq("id", quotationId);
      assert.ok(isBlocked(invisible.data, invisible.error));

      const sent = await ops
        .from("quotations")
        .update({ status: "sent" })
        .eq("id", quotationId)
        .select("status")
        .single();
      assert.equal(sent.error, null);
      assert.equal(sent.data?.status, "sent");

      const visible = await customer
        .from("quotations")
        .select("status")
        .eq("id", quotationId)
        .single();
      assert.equal(visible.error, null);
      assert.equal(visible.data?.status, "sent");

      await ops.from("quotations").delete().eq("id", quotationId);
    },
  );

  await t.test("an unrelated buyer cannot access this customer's request", async () => {
    const buyer = await as("buyer");
    const blocked = await buyer.from("transport_requests").select("id").eq("id", requestId!);
    assert.ok(isBlocked(blocked.data, blocked.error));
  });

  await t.test(
    "driver sees the request only once assigned, and can then progress its status",
    async () => {
      const driver = await as("driver");
      const beforeAssignment = await driver
        .from("transport_requests")
        .select("id")
        .eq("id", requestId!);
      assert.ok(isBlocked(beforeAssignment.data, beforeAssignment.error));

      const assigned = await ops
        .from("transport_requests")
        .update({
          status: "driver_assigned",
          assigned_driver_id: ids.driverRecord,
          assigned_vehicle_id: ids.vehicle,
        })
        .eq("id", requestId!)
        .select("status")
        .single();
      assert.equal(assigned.error, null);
      assert.equal(assigned.data?.status, "driver_assigned");

      const afterAssignment = await driver
        .from("transport_requests")
        .select("id")
        .eq("id", requestId!)
        .single();
      assert.equal(afterAssignment.error, null);

      const progressed = await driver
        .from("transport_requests")
        .update({ status: "pickup_confirmed" })
        .eq("id", requestId!)
        .select("status")
        .single();
      assert.equal(progressed.error, null);
      assert.equal(progressed.data?.status, "pickup_confirmed");

      const logged = await driver
        .from("transport_status_history")
        .insert({
          transport_request_id: requestId!,
          status: "pickup_confirmed",
          changed_by: ids.driver,
        })
        .select("id");
      assert.equal(logged.error, null);
    },
  );

  await t.test("cleanup", async () => {
    await ops.from("transport_requests").delete().eq("id", requestId!);
  });
});

test("workflow: reporting an organisation creates a moderation case", async (t) => {
  const buyer = await as("buyer");
  const admin = await as("admin");
  let reportId: string | undefined;
  let caseId: string | undefined;

  await t.test("a buyer reports an organisation", async () => {
    const report = await buyer
      .from("reports")
      .insert({
        reporter_profile_id: ids.buyer,
        target_type: "organisation",
        target_id: ids.orgWolnaDolina,
        reason: "false_breeder_information",
        description: "Workflow test report.",
      })
      .select("id")
      .single();
    assert.equal(report.error, null);
    reportId = report.data!.id as string;
  });

  await t.test("an admin escalates it into a moderation case", async () => {
    const modCase = await admin
      .from("moderation_cases")
      .insert({
        report_id: reportId!,
        case_type: "organisation_report",
        target_type: "organisation",
        target_id: ids.orgWolnaDolina,
        status: "investigating",
      })
      .select("id, status")
      .single();
    assert.equal(modCase.error, null);
    assert.equal(modCase.data?.status, "investigating");
    caseId = modCase.data!.id as string;
  });

  await t.test("the reporter cannot see the resulting case, only their own report", async () => {
    const ownReport = await buyer.from("reports").select("id").eq("id", reportId!).single();
    assert.equal(ownReport.error, null);

    const theCase = await buyer.from("moderation_cases").select("id").eq("id", caseId!);
    assert.ok(isBlocked(theCase.data, theCase.error));
  });

  await t.test("cleanup", async () => {
    await admin.from("moderation_cases").delete().eq("id", caseId!);
    await buyer.from("reports").delete().eq("id", reportId!);
  });
});

test("workflow: a suspended role's effect depends on ownership vs. role-gated access", async (t) => {
  await t.test("suspending ops staff correctly revokes their staff-only access", async () => {
    const admin = await as("admin");
    const suspend = await admin
      .from("user_roles")
      .update({ status: "suspended" })
      .eq("user_id", ids.ops)
      .eq("role", "operations")
      .select("status");
    assert.equal(suspend.error, null);

    try {
      const ops = await as("ops");
      const attempt = await ops
        .from("transport_requests")
        .select("id")
        .eq("id", ids.transportKrakow);
      assert.ok(
        isBlocked(attempt.data, attempt.error),
        "a suspended ops account must lose is_ops_staff()-gated access",
      );
    } finally {
      await admin
        .from("user_roles")
        .update({ status: "active" })
        .eq("user_id", ids.ops)
        .eq("role", "operations");
    }

    // Confirm the revert actually took: ops staff access must be restored for every later test.
    const ops = await as("ops");
    const restored = await ops
      .from("transport_requests")
      .select("id")
      .eq("id", ids.transportKrakow);
    assert.equal(restored.error, null);
  });

  // Found at Stage BD: is_my_driver_id()/is_assigned_driver_for_request() (and the
  // transport_documents/Storage driver-access policies built directly on the same shape) checked
  // only drivers.profile_id = auth.uid(), never user_roles.status -- the exact same bug class
  // 20260101006100_owns_org_checks_active_role.sql already fixed for organisation ownership, just
  // never applied to drivers. Fixed by 20260101009800_driver_id_checks_active_role.sql.
  await t.test("suspending a driver's role revokes their assigned-job access", async () => {
    const admin = await as("admin");
    const suspend = await admin
      .from("user_roles")
      .update({ status: "suspended" })
      .eq("user_id", ids.driver)
      .eq("role", "driver")
      .select("status");
    assert.equal(suspend.error, null);

    try {
      const driver = await as("driver");
      const attempt = await driver
        .from("transport_requests")
        .select("id")
        .eq("id", ids.transportWarsawAmsterdam);
      assert.ok(
        isBlocked(attempt.data, attempt.error),
        "a suspended driver must lose access to their assigned request",
      );
    } finally {
      await admin
        .from("user_roles")
        .update({ status: "active" })
        .eq("user_id", ids.driver)
        .eq("role", "driver");
    }

    // Confirm the revert actually took: driver access must be restored for every later test.
    const driver = await as("driver");
    const restored = await driver
      .from("transport_requests")
      .select("id")
      .eq("id", ids.transportWarsawAmsterdam);
    assert.equal(restored.error, null);
  });

  // Fixed by 20260101006100_owns_org_checks_active_role.sql. Root cause: owns_org()-gated policies
  // (organisations, animals, litters, parent_dogs, buyer_applications-as-org-owner) checked only
  // organisations.owner_user_id, never user_roles.status — suspending the exact role that earned
  // someone their organisation in the first place (owner_role_for_org_type() mirrors
  // approve_user_verification()'s creation-time mapping: kennel -> breeder, shelter ->
  // shelter_member, foundation/rescue -> foundation_member) had no effect on their ability to keep
  // managing it. Each org_type below is tested explicitly, plus that a non-owner member's read
  // access and an admin's access are both unaffected — this must revoke management, not lock out
  // everyone.
  const admin = await as("admin");

  await t.test(
    "suspending a kennel-owning breeder's role revokes org-management access",
    async () => {
      const suspend = await admin
        .from("user_roles")
        .update({ status: "suspended" })
        .eq("user_id", ids.breeder2)
        .eq("role", "breeder")
        .select("status");
      assert.equal(suspend.error, null);

      try {
        const breeder2 = await as("breeder2");
        const attempt = await breeder2
          .from("organisations")
          .update({ response_time: "should be blocked" })
          .eq("id", ids.orgWolnaDolina)
          .select();
        assert.ok(
          isBlocked(attempt.data, attempt.error),
          "a suspended breeder must not retain organisation-management access",
        );
      } finally {
        await admin
          .from("user_roles")
          .update({ status: "active" })
          .eq("user_id", ids.breeder2)
          .eq("role", "breeder");
      }

      const breeder2 = await as("breeder2");
      const restored = await breeder2
        .from("organisations")
        .update({ response_time: "same day" })
        .eq("id", ids.orgWolnaDolina)
        .select();
      assert.equal(
        restored.error,
        null,
        "management access must come back once the role is reactivated",
      );
    },
  );

  await t.test(
    "suspending a foundation-owning member's role revokes org-management access",
    async () => {
      const suspend = await admin
        .from("user_roles")
        .update({ status: "suspended" })
        .eq("user_id", ids.foundation1)
        .eq("role", "foundation_member")
        .select("status");
      assert.equal(suspend.error, null);

      try {
        const foundation1 = await as("foundation1");
        const attempt = await foundation1
          .from("organisations")
          .update({ response_time: "should be blocked" })
          .eq("id", ids.orgFundacja)
          .select();
        assert.ok(
          isBlocked(attempt.data, attempt.error),
          "a suspended foundation_member must not retain organisation-management access",
        );
      } finally {
        await admin
          .from("user_roles")
          .update({ status: "active" })
          .eq("user_id", ids.foundation1)
          .eq("role", "foundation_member");
      }

      const foundation1 = await as("foundation1");
      const restored = await foundation1
        .from("organisations")
        .select("id")
        .eq("id", ids.orgFundacja);
      assert.equal(restored.error, null, "access must come back once the role is reactivated");
    },
  );

  await t.test(
    "suspending a shelter-owning member's role revokes org-management access (ad-hoc fixture: no shelter org is seeded)",
    async (t) => {
      // No shelter-type organisation exists in supabase/seed.sql, so this builds one: grant
      // breederPending an active shelter_member role (their seeded role is a *different*,
      // unrelated 'breeder'/'pending' row — user_roles is keyed on (user_id, role), so this
      // doesn't touch it) and a real organisation of type 'shelter' they own, exactly the shape
      // approve_user_verification() would have produced for a real shelter verification.
      let orgId: string | undefined;
      await t.test("setup: grant an active shelter_member role and a shelter org", async () => {
        const role = await admin
          .from("user_roles")
          .upsert(
            { user_id: ids.breederPending, role: "shelter_member", status: "active" },
            { onConflict: "user_id,role" },
          )
          .select("status");
        assert.equal(role.error, null);

        const org = await admin
          .from("organisations")
          .insert({
            org_type: "shelter",
            name: "Regression Test Shelter",
            slug: `regression-test-shelter-${Date.now()}`,
            verification_status: "approved",
            is_public: true,
            owner_user_id: ids.breederPending,
          })
          .select("id")
          .single();
        assert.equal(org.error, null);
        orgId = org.data!.id as string;
      });

      await t.test("an active shelter_member can manage their shelter", async () => {
        const breederPending = await as("breederPending");
        const attempt = await breederPending
          .from("organisations")
          .update({ response_time: "same day" })
          .eq("id", orgId!)
          .select();
        assert.equal(
          attempt.error,
          null,
          "an active shelter_member must be able to manage their org",
        );
        assert.equal(attempt.data?.length, 1);
      });

      await t.test("suspending the shelter_member role blocks management", async () => {
        const suspend = await admin
          .from("user_roles")
          .update({ status: "suspended" })
          .eq("user_id", ids.breederPending)
          .eq("role", "shelter_member");
        assert.equal(suspend.error, null);

        const breederPending = await as("breederPending");
        const attempt = await breederPending
          .from("organisations")
          .update({ response_time: "should be blocked" })
          .eq("id", orgId!)
          .select();
        assert.ok(
          isBlocked(attempt.data, attempt.error),
          "a suspended shelter_member must not retain organisation-management access",
        );
      });

      await t.test("cleanup", async () => {
        if (orgId) await admin.from("organisations").delete().eq("id", orgId);
        await admin
          .from("user_roles")
          .delete()
          .eq("user_id", ids.breederPending)
          .eq("role", "shelter_member");
      });
    },
  );

  await t.test(
    "suspending a rescue-owning member's role revokes org-management access (ad-hoc fixture: no rescue org is seeded)",
    async (t) => {
      // Same reasoning as the shelter case above, using foundationPending — approve_user_verification
      // grants 'foundation_member' for every non-shelter organisation type, including 'rescue'.
      let orgId: string | undefined;
      await t.test("setup: grant an active foundation_member role and a rescue org", async () => {
        const role = await admin
          .from("user_roles")
          .upsert(
            { user_id: ids.foundationPending, role: "foundation_member", status: "active" },
            { onConflict: "user_id,role" },
          )
          .select("status");
        assert.equal(role.error, null);

        const org = await admin
          .from("organisations")
          .insert({
            org_type: "rescue",
            name: "Regression Test Rescue",
            slug: `regression-test-rescue-${Date.now()}`,
            verification_status: "approved",
            is_public: true,
            owner_user_id: ids.foundationPending,
          })
          .select("id")
          .single();
        assert.equal(org.error, null);
        orgId = org.data!.id as string;
      });

      await t.test("an active foundation_member can manage their rescue org", async () => {
        const foundationPending = await as("foundationPending");
        const attempt = await foundationPending
          .from("organisations")
          .update({ response_time: "same day" })
          .eq("id", orgId!)
          .select();
        assert.equal(attempt.error, null);
        assert.equal(attempt.data?.length, 1);
      });

      await t.test("suspending the foundation_member role blocks management", async () => {
        const suspend = await admin
          .from("user_roles")
          .update({ status: "suspended" })
          .eq("user_id", ids.foundationPending)
          .eq("role", "foundation_member");
        assert.equal(suspend.error, null);

        const foundationPending = await as("foundationPending");
        const attempt = await foundationPending
          .from("organisations")
          .update({ response_time: "should be blocked" })
          .eq("id", orgId!)
          .select();
        assert.ok(isBlocked(attempt.data, attempt.error));
      });

      await t.test("cleanup", async () => {
        if (orgId) await admin.from("organisations").delete().eq("id", orgId);
        await admin
          .from("user_roles")
          .delete()
          .eq("user_id", ids.foundationPending)
          .eq("role", "foundation_member");
      });
    },
  );

  await t.test(
    "an active (non-owner) organisation member is unaffected by the owner's role suspension",
    async (t) => {
      let memberRowId: string | undefined;
      await t.test(
        "setup: add breederPending as a non-owner staff member on Wolna Dolina",
        async () => {
          const member = await admin
            .from("organisation_members")
            .insert({
              org_id: ids.orgWolnaDolina,
              profile_id: ids.breederPending,
              member_role: "employee",
            })
            .select("id")
            .single();
          assert.equal(member.error, null);
          memberRowId = member.data!.id as string;
        },
      );

      await t.test("the member keeps read access while the owner's role is suspended", async () => {
        const suspend = await admin
          .from("user_roles")
          .update({ status: "suspended" })
          .eq("user_id", ids.breeder2)
          .eq("role", "breeder");
        assert.equal(suspend.error, null);

        try {
          const breederPending = await as("breederPending");
          const read = await breederPending
            .from("organisations")
            .select("id")
            .eq("id", ids.orgWolnaDolina);
          assert.equal(read.error, null);
          assert.equal(
            read.data?.length,
            1,
            "a non-owner member's read access must not depend on the owner's role status",
          );
        } finally {
          await admin
            .from("user_roles")
            .update({ status: "active" })
            .eq("user_id", ids.breeder2)
            .eq("role", "breeder");
        }
      });

      await t.test("cleanup", async () => {
        if (memberRowId) await admin.from("organisation_members").delete().eq("id", memberRowId);
      });
    },
  );

  await t.test("an admin's organisation access never depends on owns_org()", async () => {
    const attempt = await admin
      .from("organisations")
      .update({ response_time: "same day" })
      .eq("id", ids.orgWolnaDolina)
      .select();
    assert.equal(
      attempt.error,
      null,
      "admins manage all organisations regardless of ownership/role status",
    );
  });

  // Stage IR-7: no seeded user anywhere in supabase/seed.sql has the 'moderator' role -- every
  // other test in this whole session that exercises is_moderator()-gated access (reports/
  // moderation_cases/appeals) does so as `admin`, which also always satisfies is_moderator() via
  // its own `or is_admin()` clause. That means the *moderator* half of that OR has never actually
  // been exercised by any test, and specifically its suspension behaviour (does suspending a
  // *moderator* role, as opposed to an admin, actually revoke moderation access?) has zero
  // coverage. has_role() itself (checked `status = 'active'`) is the same shared helper already
  // proven correct for every other role in this file, so this is expected to already work -- this
  // closes the coverage gap, the same "already correct, just untested" shape as Stage BH.
  await t.test(
    "suspending a moderator's role revokes moderation-case access (ad-hoc fixture: no moderator is seeded)",
    async (t) => {
      let caseId: string | undefined;

      await t.test("setup: grant an active moderator role and a real moderation case", async () => {
        const role = await admin
          .from("user_roles")
          .upsert(
            { user_id: ids.breederPending, role: "moderator", status: "active" },
            { onConflict: "user_id,role" },
          )
          .select("status");
        assert.equal(role.error, null);

        const created = await admin
          .from("moderation_cases")
          .insert({
            case_type: "report_review",
            target_type: "user",
            target_id: ids.buyer,
          })
          .select("id")
          .single();
        assert.equal(created.error, null);
        caseId = created.data!.id as string;
      });

      await t.test("an active moderator can manage the case", async () => {
        const moderatorAccount = await as("breederPending");
        const attempt = await moderatorAccount
          .from("moderation_cases")
          .update({ status: "investigating" })
          .eq("id", caseId!)
          .select();
        assert.equal(attempt.error, null, "an active moderator must be able to manage cases");
        assert.equal(attempt.data?.length, 1);
      });

      await t.test("suspending the moderator role blocks case management", async () => {
        const suspend = await admin
          .from("user_roles")
          .update({ status: "suspended" })
          .eq("user_id", ids.breederPending)
          .eq("role", "moderator");
        assert.equal(suspend.error, null);

        const moderatorAccount = await as("breederPending");
        const attempt = await moderatorAccount
          .from("moderation_cases")
          .update({ status: "resolved" })
          .eq("id", caseId!)
          .select();
        assert.ok(
          isBlocked(attempt.data, attempt.error),
          "a suspended moderator must not retain moderation-case access",
        );
      });

      await t.test("cleanup", async () => {
        if (caseId) await admin.from("moderation_cases").delete().eq("id", caseId);
        await admin
          .from("user_roles")
          .delete()
          .eq("user_id", ids.breederPending)
          .eq("role", "moderator");
      });
    },
  );
});
