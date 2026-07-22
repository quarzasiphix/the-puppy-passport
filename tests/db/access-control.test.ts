// Positive/negative access-control coverage across every major resource area, for every role that
// matters: anonymous visitor, buyer, breeder (approved + pending), foundation member, operations
// employee, driver, admin. Every assertion checks actual returned data (or its absence), never
// just an HTTP status — see docs/DATABASE_TESTING.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { anon, as, ids, isBlocked, isForbidden, isEmpty } from "./helpers.ts";

test("profiles and private contact data", async (t) => {
  await t.test("any authenticated user can read another profile's public columns", async () => {
    const buyer = await as("buyer");
    const { data, error } = await buyer
      .from("profiles")
      .select("display_name, city")
      .eq("id", ids.breeder1)
      .single();
    assert.equal(error, null);
    assert.equal(data?.display_name, "Anna Kowalska");
  });

  await t.test("no authenticated user can bulk-read another user's email/phone", async () => {
    const buyer = await as("buyer");
    const { data, error } = await buyer
      .from("profiles")
      .select("email, phone")
      .eq("id", ids.breeder1);
    assert.ok(
      isForbidden(error),
      `expected a permission error, got ${JSON.stringify({ data, error })}`,
    );
  });

  await t.test("a user can read their own full profile via get_my_profile()", async () => {
    const buyer = await as("buyer");
    const { data, error } = await buyer.rpc("get_my_profile");
    assert.equal(error, null);
    assert.equal(data?.email, "buyer@havenpaw.test");
    assert.equal(data?.phone, "+48 555 123 456");
  });

  await t.test(
    "anonymous visitors can read only the deliberately public display columns",
    async () => {
      // Intentional, documented design (20260101003100_profiles_anon_public_columns.sql): public
      // marketplace pages embed a kennel owner's display name for anonymous visitors, so anon gets
      // a narrow column grant for id/display_name/avatar_url/city/country — never email/phone/
      // first_name/last_name.
      const displayInfo = await anon()
        .from("profiles")
        .select("display_name")
        .eq("id", ids.breeder1);
      assert.equal(displayInfo.error, null);
      assert.equal(displayInfo.data?.[0]?.display_name, "Anna Kowalska");

      const sensitive = await anon().from("profiles").select("email, phone").eq("id", ids.breeder1);
      assert.ok(
        isForbidden(sensitive.error),
        `expected a permission error, got ${JSON.stringify(sensitive)}`,
      );

      const alsoSensitive = await anon()
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", ids.breeder1);
      assert.ok(isForbidden(alsoSensitive.error));
    },
  );
});

test("organisations and organisation membership", async (t) => {
  await t.test("anonymous visitors read an approved, public organisation", async () => {
    const { data, error } = await anon()
      .from("organisations")
      .select("name, verification_status")
      .eq("id", ids.orgCichyLas)
      .single();
    assert.equal(error, null);
    assert.equal(data?.name, "Cichy Las Kennel");
  });

  await t.test("an unrelated breeder cannot update another kennel's organisation", async () => {
    const breeder2 = await as("breeder2");
    const { data, error } = await breeder2
      .from("organisations")
      .update({ response_time: "hijacked" })
      .eq("id", ids.orgCichyLas)
      .select();
    assert.ok(isBlocked(data, error));

    const breeder1 = await as("breeder1");
    const { data: check } = await breeder1
      .from("organisations")
      .select("response_time")
      .eq("id", ids.orgCichyLas)
      .single();
    assert.notEqual(check?.response_time, "hijacked");
  });

  await t.test(
    "an unrelated breeder cannot add themselves as a member of another kennel",
    async () => {
      const breeder2 = await as("breeder2");
      const { data, error } = await breeder2
        .from("organisation_members")
        .insert({ org_id: ids.orgCichyLas, profile_id: ids.breeder2, member_role: "employee" })
        .select();
      assert.ok(isBlocked(data, error));
    },
  );

  await t.test("an owner can update their own organisation", async () => {
    const breeder1 = await as("breeder1");
    const { data, error } = await breeder1
      .from("organisations")
      .update({ response_time: "under 4 hours" })
      .eq("id", ids.orgCichyLas)
      .select("response_time");
    assert.equal(error, null);
    assert.equal(data?.[0]?.response_time, "under 4 hours");
  });
});

test("animal listings", async (t) => {
  await t.test("anonymous visitors see a published animal from an approved org", async () => {
    const { data, error } = await anon()
      .from("animals")
      .select("name")
      .eq("id", ids.animalMaja)
      .single();
    assert.equal(error, null);
    assert.equal(data?.name, "Maja");
  });

  await t.test("anonymous visitors cannot see an unpublished (draft) animal", async () => {
    const { data, error } = await anon().from("animals").select("name").eq("id", ids.animalNero);
    assert.ok(isBlocked(data, error));
    assert.ok(isEmpty(data));
  });

  await t.test("an unrelated breeder cannot edit another kennel's animal", async () => {
    const breeder2 = await as("breeder2");
    const { data, error } = await breeder2
      .from("animals")
      .update({ description: "hijacked" })
      .eq("id", ids.animalMaja)
      .select();
    assert.ok(isBlocked(data, error));
  });
});

test("buyer and adoption applications", async (t) => {
  await t.test("the buyer who applied can read their own application", async () => {
    const buyer = await as("buyer");
    const { data, error } = await buyer
      .from("buyer_applications")
      .select("status")
      .eq("id", ids.applicationFabian)
      .single();
    assert.equal(error, null);
    assert.equal(data?.status, "approved");
  });

  await t.test("the kennel that owns the animal can read the application", async () => {
    const breeder1 = await as("breeder1");
    const { data, error } = await breeder1
      .from("buyer_applications")
      .select("status")
      .eq("id", ids.applicationFabian)
      .single();
    assert.equal(error, null);
    assert.equal(data?.status, "approved");
  });

  await t.test("an unrelated kennel cannot read the application", async () => {
    const breeder2 = await as("breeder2");
    const { data, error } = await breeder2
      .from("buyer_applications")
      .select("id")
      .eq("id", ids.applicationFabian);
    assert.ok(isBlocked(data, error));
  });

  await t.test("an unrelated customer cannot read the buyer's application", async () => {
    const customer = await as("customer");
    const { data, error } = await customer
      .from("buyer_applications")
      .select("id")
      .eq("id", ids.applicationFabian);
    assert.ok(isBlocked(data, error));
  });
});

test("transport requests", async (t) => {
  await t.test("the requester reads their own transport request", async () => {
    const customer = await as("customer");
    const { data, error } = await customer
      .from("transport_requests")
      .select("animal_name")
      .eq("id", ids.transportWarsawAmsterdam)
      .single();
    assert.equal(error, null);
    assert.equal(data?.animal_name, "Fitch");
  });

  await t.test("an unrelated buyer cannot read another customer's transport request", async () => {
    const buyer = await as("buyer");
    const { data, error } = await buyer
      .from("transport_requests")
      .select("id")
      .eq("id", ids.transportWarsawAmsterdam);
    assert.ok(isBlocked(data, error));
  });

  await t.test("ops staff can read any transport request", async () => {
    const ops = await as("ops");
    const { data, error } = await ops
      .from("transport_requests")
      .select("animal_name")
      .eq("id", ids.transportWarsawAmsterdam)
      .single();
    assert.equal(error, null);
    assert.equal(data?.animal_name, "Fitch");
  });

  await t.test("anonymous visitors cannot read transport requests at all", async () => {
    const { data, error } = await anon()
      .from("transport_requests")
      .select("id")
      .eq("id", ids.transportWarsawAmsterdam);
    assert.ok(isBlocked(data, error));
  });

  await t.test(
    "a driver sees only the request assigned to them, not the requester's other ones",
    async () => {
      const driver = await as("driver");
      const assigned = await driver
        .from("transport_requests")
        .select("id")
        .eq("id", ids.transportWarsawAmsterdam);
      assert.equal(assigned.error, null);
      assert.equal(assigned.data?.length, 1);

      const unassigned = await driver
        .from("transport_requests")
        .select("id")
        .eq("id", ids.transportBerlin);
      assert.ok(isBlocked(unassigned.data, unassigned.error));
    },
  );
});

test("quotations", async (t) => {
  await t.test("the requester reads an accepted quotation on their own request", async () => {
    const customer = await as("customer");
    const { data, error } = await customer
      .from("quotations")
      .select("status")
      .eq("transport_request_id", ids.transportWarsawAmsterdam)
      .single();
    assert.equal(error, null);
    assert.equal(data?.status, "accepted");
  });

  await t.test("an unrelated buyer cannot read another customer's quotation", async () => {
    const buyer = await as("buyer");
    const { data, error } = await buyer
      .from("quotations")
      .select("id")
      .eq("transport_request_id", ids.transportWarsawAmsterdam);
    assert.ok(isBlocked(data, error));
  });

  await t.test("a draft quotation is invisible even to the requester it's for", async () => {
    const ops = await as("ops");
    const created = await ops
      .from("quotations")
      .insert({
        transport_request_id: ids.transportBerlin,
        service_type: "express",
        status: "draft",
        total_price: 999,
      })
      .select("id")
      .single();
    assert.equal(created.error, null);
    const draftId = created.data!.id as string;

    try {
      const customer = await as("customer");
      const { data, error } = await customer.from("quotations").select("id").eq("id", draftId);
      assert.ok(isBlocked(data, error));
    } finally {
      await ops.from("quotations").delete().eq("id", draftId);
    }
  });
});

test("saved animals and followed breeders", async (t) => {
  await t.test("a buyer reads their own saved animals", async () => {
    const buyer = await as("buyer");
    const { data, error } = await buyer
      .from("saved_animals")
      .select("animal_id")
      .eq("buyer_id", ids.buyer);
    assert.equal(error, null);
    assert.ok((data?.length ?? 0) > 0);
  });

  await t.test("an unrelated user cannot read another buyer's saved-animals list", async () => {
    const breeder1 = await as("breeder1");
    const { data, error } = await breeder1
      .from("saved_animals")
      .select("id")
      .eq("buyer_id", ids.buyer);
    assert.ok(isBlocked(data, error));
  });

  await t.test("a buyer can follow a kennel and read their own follow, others cannot", async () => {
    const buyer = await as("buyer");
    const created = await buyer
      .from("follows")
      .insert({ follower_profile_id: ids.buyer, followed_organization_id: ids.orgWolnaDolina })
      .select("id")
      .single();
    assert.equal(created.error, null);
    const followId = created.data!.id as string;

    try {
      const breeder2 = await as("breeder2");
      const { data, error } = await breeder2.from("follows").select("id").eq("id", followId);
      assert.ok(isBlocked(data, error));
    } finally {
      await buyer.from("follows").delete().eq("id", followId);
    }
  });
});

test("moderation cases", async (t) => {
  await t.test("a reporter sees their own report but never any moderation case", async () => {
    const customer = await as("customer");
    const report = await customer
      .from("reports")
      .insert({
        reporter_profile_id: ids.customer,
        target_type: "animal_listing",
        target_id: ids.animalMaja,
        reason: "other",
        description: "access-control test report",
      })
      .select("id")
      .single();
    assert.equal(report.error, null);
    const reportId = report.data!.id as string;

    try {
      const admin = await as("admin");
      const modCase = await admin
        .from("moderation_cases")
        .insert({
          report_id: reportId,
          case_type: "listing_report",
          target_type: "animal_listing",
          target_id: ids.animalMaja,
        })
        .select("id")
        .single();
      assert.equal(modCase.error, null);
      const caseId = modCase.data!.id as string;

      try {
        const ownReport = await customer.from("reports").select("id").eq("id", reportId).single();
        assert.equal(ownReport.error, null);

        const caseAsReporter = await customer
          .from("moderation_cases")
          .select("id")
          .eq("id", caseId);
        assert.ok(isBlocked(caseAsReporter.data, caseAsReporter.error));

        const buyer = await as("buyer");
        const reportAsBuyer = await buyer.from("reports").select("id").eq("id", reportId);
        assert.ok(isBlocked(reportAsBuyer.data, reportAsBuyer.error));
      } finally {
        await admin.from("moderation_cases").delete().eq("id", caseId);
      }
    } finally {
      await customer.from("reports").delete().eq("id", reportId);
    }
  });
});

test("audit logs", async (t) => {
  await t.test("ops staff can write and read back an audit log entry", async () => {
    const ops = await as("ops");
    const created = await ops
      .from("audit_logs")
      .insert({
        actor_profile_id: ids.ops,
        action: "access_control_test",
        target_type: "transport_request",
        target_id: ids.transportWarsawAmsterdam,
      })
      .select("id")
      .single();
    assert.equal(created.error, null);
    const logId = created.data!.id as string;

    try {
      const readBack = await ops.from("audit_logs").select("action").eq("id", logId).single();
      assert.equal(readBack.error, null);
      assert.equal(readBack.data?.action, "access_control_test");

      const customer = await as("customer");
      const asCustomer = await customer.from("audit_logs").select("id").eq("id", logId);
      assert.ok(isBlocked(asCustomer.data, asCustomer.error));
    } finally {
      await ops.from("audit_logs").delete().eq("id", logId);
    }
  });
});

test("private documents and storage access", async (t) => {
  const path = `${ids.transportWarsawAmsterdam}/access-control-test.txt`;
  // A plain string body, not a web Blob — @supabase/supabase-js's storage upload in this Node
  // environment silently mishandles a Blob (upload reports success but the object doesn't
  // actually persist correctly, so even the uploader's own download 404s). Confirmed against the
  // real storage API directly (curl, and a plain-string upload) before writing this workaround.
  const contents = "not a real document — access-control test fixture";

  await t.test("the requester can upload and read their own transport document", async () => {
    const customer = await as("customer");
    try {
      const upload = await customer.storage.from("transport-documents").upload(path, contents, {
        contentType: "text/plain",
        upsert: true,
      });
      assert.equal(upload.error, null);

      const download = await customer.storage.from("transport-documents").download(path);
      assert.equal(download.error, null);

      const buyer = await as("buyer");
      const deniedDownload = await buyer.storage.from("transport-documents").download(path);
      assert.notEqual(deniedDownload.error, null);

      const ops = await as("ops");
      const opsDownload = await ops.storage.from("transport-documents").download(path);
      assert.equal(opsDownload.error, null);
    } finally {
      // Only ops/admin can delete transport-documents objects — requesters have no self-delete
      // policy by design (see docs/PRODUCTION_READINESS_REPORT.md).
      const ops = await as("ops");
      await ops.storage.from("transport-documents").remove([path]);
    }
  });

  await t.test(
    "OPEN FINDING: an assigned driver cannot actually read their job's documents (storage column-shadowing bug)",
    async () => {
      // migration 20260101003400_transport_documents_storage_driver_access.sql's policy source
      // reads `(storage.foldername(name))[1]::uuid` intending the bare `name` to mean
      // storage.objects.name (the object's own path) — the same pattern every other storage
      // policy in 20260101002200_storage.sql correctly uses. But this policy's subquery joins in
      // `public.drivers d`, which ALSO has a `name` column (the driver's personal name), and
      // Postgres resolves the unqualified `name` to `d.name` instead — the exact "column-shadowing
      // silently returns the wrong result" bug class already fixed once for
      // `conversations`/`conversation_participants` (both share an `id` column), reintroduced here
      // via a different pair of same-named columns. Confirmed live: `select policyname, qual from
      // pg_policies where tablename='objects' and policyname ilike '%driver%'` shows the stored
      // policy literally reading `storage.foldername(d.name)`, not `storage.foldername(objects.
      // name)`. A driver's personal name has no `/`, so `storage.foldername()` returns nothing to
      // index, `tr.id = NULL` is never true, and the policy silently denies every request
      // regardless of assignment. This test asserts the CORRECT behaviour and is expected to
      // currently FAIL — left in, unfixed, so it stays visible. The fix is qualifying the
      // reference (`storage.foldername(objects.name)`), not touching drivers.name or reverting
      // this test. See the task report for full detail.
      const customer = await as("customer");
      const upload = await customer.storage.from("transport-documents").upload(path, contents, {
        contentType: "text/plain",
        upsert: true,
      });
      assert.equal(upload.error, null);

      try {
        // a1 (ids.transportWarsawAmsterdam) is assigned to driver@havenpaw.test and its status
        // ('ready_for_scheduling') is not one of the excluded draft/submitted/rejected/cancelled
        // states, so the assigned driver should be able to read the file for this active job.
        const driver = await as("driver");
        const driverDownload = await driver.storage.from("transport-documents").download(path);
        assert.equal(
          driverDownload.error,
          null,
          `expected the assigned driver to read this file, got ${JSON.stringify(driverDownload.error)}`,
        );
      } finally {
        const ops = await as("ops");
        await ops.storage.from("transport-documents").remove([path]);
      }
    },
  );
});
