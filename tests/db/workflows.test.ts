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

  await t.test(
    "OPEN FINDING: suspending a breeder's role does not revoke their organisation-management access",
    async () => {
      // Found while building this suite (2026-07-22): owns_org()-gated policies (organisations,
      // animals, litters, parent_dogs, buyer_applications-as-org-owner) check only
      // organisations.owner_user_id, never user_roles.status. Suspending a breeder's `breeder`
      // role today has NO effect on their ability to keep managing their kennel. This test
      // asserts the correct behaviour and is expected to currently FAIL — intentionally left
      // failing rather than deleted, per the same reasoning as the transport-status finding in
      // security-regressions.test.ts. See the task report for detail.
      const admin = await as("admin");
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
        // Best-effort revert of the org row itself in case the update above went through (which,
        // per this open finding, it currently does).
        await admin
          .from("organisations")
          .update({ response_time: "same day" })
          .eq("id", ids.orgWolnaDolina);
      }
    },
  );
});
