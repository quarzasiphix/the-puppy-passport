// Regression coverage for the transport data-model hardening pass (docs/adr/TRANSPORT_DATA_MODEL.md):
// create_transport_draft() atomicity and animal-entitlement checks, the transport_request_animals /
// transport_parties tables, the post-draft snapshot lock (on transport_requests directly and via
// transport_request_animals/transport_parties row edits), and the amendment workflow. See
// docs/DATABASE_TESTING.md for the harness this file follows.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, isBlocked } from "./helpers.ts";

test("create_transport_draft: happy path with multiple animals and parties", async (t) => {
  const customer = await as("customer");
  let requestId: string | undefined;

  await t.test("customer creates a draft with two animals and a delivery contact", async () => {
    const { data, error } = await customer.rpc("create_transport_draft", {
      p_request: {
        pickup_country: "Poland",
        pickup_city: "Warsaw",
        destination_country: "Netherlands",
        destination_city: "Amsterdam",
      },
      p_animals: [
        { name: "First Dog", breed_free_text: "Mixed", sex: "male" },
        { name: "Second Dog", breed_free_text: "Labrador", sex: "female" },
      ],
      p_parties: [
        {
          party_role: "delivery_contact",
          external_name: "Jan Kowalski",
          external_phone: "+48 111 222 333",
        },
      ],
    });
    assert.equal(error, null);
    assert.ok(data);
    requestId = data as string;

    const request = await customer
      .from("transport_requests")
      .select("status, animal_name, requester_profile_id, number_of_animals")
      .eq("id", requestId)
      .single();
    assert.equal(request.error, null);
    assert.equal(request.data?.status, "draft");
    // Element 0 mirrored onto the legacy inline columns.
    assert.equal(request.data?.animal_name, "First Dog");
    assert.equal(request.data?.requester_profile_id, ids.customer);
  });

  await t.test("both animals and the delivery contact + requester party exist", async () => {
    const animals = await customer
      .from("transport_request_animals")
      .select("position, name")
      .eq("transport_request_id", requestId!)
      .order("position", { ascending: true });
    assert.equal(animals.error, null);
    assert.deepEqual(
      animals.data?.map((a) => a.name),
      ["First Dog", "Second Dog"],
    );

    const parties = await customer
      .from("transport_parties")
      .select("party_role, profile_id, external_name")
      .eq("transport_request_id", requestId!);
    assert.equal(parties.error, null);
    const roles = parties.data?.map((p) => p.party_role).sort();
    assert.deepEqual(roles, ["delivery_contact", "requester"]);
    const requesterRow = parties.data?.find((p) => p.party_role === "requester");
    assert.equal(requesterRow?.profile_id, ids.customer);
  });

  await t.test("cleanup", async () => {
    await customer.from("transport_requests").delete().eq("id", requestId!);
  });
});

test("create_transport_draft: a customer cannot pass a 'requester' party explicitly", async () => {
  const customer = await as("customer");
  const { data, error } = await customer.rpc("create_transport_draft", {
    p_request: {},
    p_animals: [],
    p_parties: [{ party_role: "requester", profile_id: ids.customer }],
  });
  assert.equal(data, null);
  assert.ok(error, "expected an error rejecting an explicit requester party");
});

test("create_transport_draft: a customer cannot forge another Havenpaw user as legal_owner/sender/payer", async () => {
  const customer = await as("customer");
  const { data, error } = await customer.rpc("create_transport_draft", {
    p_request: {},
    p_animals: [],
    p_parties: [{ party_role: "payer", profile_id: ids.breeder1 }],
  });
  assert.equal(data, null);
  assert.ok(error, "expected an error rejecting a forged payer");
});

test("create_transport_draft: naming another user as recipient is allowed (unrestricted role)", async (t) => {
  const customer = await as("customer");
  let requestId: string | undefined;
  await t.test("create with buyer as recipient", async () => {
    const { data, error } = await customer.rpc("create_transport_draft", {
      p_request: {},
      p_animals: [],
      p_parties: [{ party_role: "recipient", profile_id: ids.buyer }],
    });
    assert.equal(error, null);
    requestId = data as string;
  });
  await t.test("cleanup", async () => {
    await customer.from("transport_requests").delete().eq("id", requestId!);
  });
});

test("create_transport_draft: animal entitlement", async (t) => {
  const customer = await as("customer");
  const breeder1 = await as("breeder1");
  let ownRequestId: string | undefined;

  await t.test(
    "an unrelated customer cannot attach a breeder's animal they have no connection to",
    async () => {
      const { data, error } = await customer.rpc("create_transport_draft", {
        p_request: {},
        p_animals: [{ animal_id: ids.animalMaja }],
        p_parties: [],
      });
      assert.equal(data, null);
      assert.ok(error, "expected an entitlement error");
    },
  );

  await t.test(
    "the buyer with an approved application for animalFabian can attach it",
    async () => {
      const buyer = await as("buyer");
      const { data, error } = await buyer.rpc("create_transport_draft", {
        p_request: {},
        p_animals: [{ animal_id: ids.animalFabian }],
        p_parties: [],
      });
      assert.equal(error, null);
      const requestId = data as string;
      await buyer.from("transport_requests").delete().eq("id", requestId);
    },
  );

  await t.test("the owning organisation's own member can attach their own animal", async () => {
    const { data, error } = await breeder1.rpc("create_transport_draft", {
      p_request: {},
      p_animals: [{ animal_id: ids.animalMaja }],
      p_parties: [],
    });
    assert.equal(error, null);
    ownRequestId = data as string;
  });

  await t.test("cleanup", async () => {
    if (ownRequestId) await breeder1.from("transport_requests").delete().eq("id", ownRequestId);
  });
});

test("post-draft snapshot lock on transport_requests", async (t) => {
  const customer = await as("customer");
  let requestId: string | undefined;

  await t.test("setup: create and submit a draft", async () => {
    const created = await customer.rpc("create_transport_draft", {
      p_request: { pickup_city: "Warsaw" },
      p_animals: [{ name: "Locked Dog" }],
      p_parties: [],
    });
    assert.equal(created.error, null);
    requestId = created.data as string;

    const submitted = await customer
      .from("transport_requests")
      .update({ status: "submitted" })
      .eq("id", requestId)
      .select("status")
      .single();
    assert.equal(submitted.error, null);
    assert.equal(submitted.data?.status, "submitted");
  });

  await t.test("the requester can no longer edit a snapshot field directly", async () => {
    const attempt = await customer
      .from("transport_requests")
      .update({ animal_name: "Renamed After Submission" })
      .eq("id", requestId!)
      .select("id");
    assert.ok(attempt.error, "expected the snapshot-lock trigger to reject this update");
  });

  await t.test("ops staff can still edit a snapshot field directly (correction path)", async () => {
    const ops = await as("ops");
    const attempt = await ops
      .from("transport_requests")
      .update({ animal_name: "Corrected By Ops" })
      .eq("id", requestId!)
      .select("animal_name")
      .single();
    assert.equal(attempt.error, null);
    assert.equal(attempt.data?.animal_name, "Corrected By Ops");
  });

  await t.test("cleanup", async () => {
    const ops = await as("ops");
    await ops.from("transport_requests").delete().eq("id", requestId!);
  });
});

test("post-draft lock on transport_request_animals and transport_parties", async (t) => {
  const customer = await as("customer");
  let requestId: string | undefined;

  await t.test("setup: create and submit a draft with one animal", async () => {
    const created = await customer.rpc("create_transport_draft", {
      p_request: {},
      p_animals: [{ name: "Dog One" }],
      p_parties: [],
    });
    assert.equal(created.error, null);
    requestId = created.data as string;
    const submitted = await customer
      .from("transport_requests")
      .update({ status: "submitted" })
      .eq("id", requestId);
    assert.equal(submitted.error, null);
  });

  await t.test("cannot add a new animal to an already-submitted request", async () => {
    const attempt = await customer
      .from("transport_request_animals")
      .insert({ transport_request_id: requestId!, position: 2, name: "Sneaky Second Dog" });
    assert.ok(attempt.error, "expected the row-lock trigger to reject this insert");
  });

  await t.test("cannot add a new party to an already-submitted request", async () => {
    const attempt = await customer
      .from("transport_parties")
      .insert({ transport_request_id: requestId!, party_role: "payer", profile_id: ids.customer });
    assert.ok(attempt.error, "expected the row-lock trigger to reject this insert");
  });

  await t.test(
    "ops staff can still add a party (e.g. correcting on the customer's behalf)",
    async () => {
      const ops = await as("ops");
      const attempt = await ops
        .from("transport_parties")
        .insert({ transport_request_id: requestId!, party_role: "payer", profile_id: ids.customer })
        .select("id");
      assert.equal(attempt.error, null);
    },
  );

  await t.test("cleanup", async () => {
    const ops = await as("ops");
    await ops.from("transport_requests").delete().eq("id", requestId!);
  });
});

test("amendment workflow", async (t) => {
  const customer = await as("customer");
  let requestId: string | undefined;
  let amendmentId: string | undefined;

  await t.test("setup: create and submit a draft", async () => {
    const created = await customer.rpc("create_transport_draft", {
      p_request: { pickup_city: "Warsaw" },
      p_animals: [],
      p_parties: [],
    });
    assert.equal(created.error, null);
    requestId = created.data as string;
    const submitted = await customer
      .from("transport_requests")
      .update({ status: "submitted" })
      .eq("id", requestId);
    assert.equal(submitted.error, null);
  });

  await t.test("a draft (not yet submitted) request cannot be amended", async () => {
    const draft = await customer.rpc("create_transport_draft", {
      p_request: {},
      p_animals: [],
      p_parties: [],
    });
    assert.equal(draft.error, null);
    const draftId = draft.data as string;

    const attempt = await customer.rpc("request_transport_amendment", {
      p_transport_request_id: draftId,
      p_field_name: "pickup_city",
      p_new_value: "Krakow",
    });
    assert.ok(attempt.error, "expected an error amending a still-draft request");
    await customer.from("transport_requests").delete().eq("id", draftId);
  });

  await t.test("the requester files an amendment on the submitted request", async () => {
    const { data, error } = await customer.rpc("request_transport_amendment", {
      p_transport_request_id: requestId!,
      p_field_name: "pickup_city",
      p_new_value: "Krakow",
    });
    assert.equal(error, null);
    assert.ok(data);
    amendmentId = data as string;

    const row = await customer
      .from("transport_request_amendments")
      .select("field_name, old_value, new_value, status")
      .eq("id", amendmentId)
      .single();
    assert.equal(row.error, null);
    assert.equal(row.data?.field_name, "pickup_city");
    assert.equal(row.data?.old_value, "Warsaw");
    assert.equal(row.data?.new_value, "Krakow");
    assert.equal(row.data?.status, "pending");
  });

  await t.test("an unrelated user cannot see or review this amendment", async () => {
    const buyer = await as("buyer");
    const blocked = await buyer
      .from("transport_request_amendments")
      .select("id")
      .eq("id", amendmentId!);
    assert.ok(isBlocked(blocked.data, blocked.error));

    const reviewAttempt = await buyer.rpc("review_transport_amendment", {
      p_amendment_id: amendmentId!,
      p_approve: true,
    });
    assert.ok(reviewAttempt.error, "expected a non-ops user to be rejected");
  });

  await t.test("cannot request an amendment to a field outside the allow-list", async () => {
    const attempt = await customer.rpc("request_transport_amendment", {
      p_transport_request_id: requestId!,
      p_field_name: "animal_name",
      p_new_value: "Hacked Name",
    });
    assert.ok(attempt.error, "expected the field allow-list to reject this");
  });

  await t.test("operations approves the amendment and it applies to the live row", async () => {
    const ops = await as("ops");
    const { error } = await ops.rpc("review_transport_amendment", {
      p_amendment_id: amendmentId!,
      p_approve: true,
      p_review_note: "Confirmed with customer by phone.",
    });
    assert.equal(error, null);

    const request = await customer
      .from("transport_requests")
      .select("pickup_city")
      .eq("id", requestId!)
      .single();
    assert.equal(request.error, null);
    assert.equal(request.data?.pickup_city, "Krakow");

    const amendment = await customer
      .from("transport_request_amendments")
      .select("status, reviewed_by")
      .eq("id", amendmentId!)
      .single();
    assert.equal(amendment.data?.status, "approved");
    assert.equal(amendment.data?.reviewed_by, ids.ops);
  });

  await t.test("an already-reviewed amendment cannot be reviewed again", async () => {
    const ops = await as("ops");
    const attempt = await ops.rpc("review_transport_amendment", {
      p_amendment_id: amendmentId!,
      p_approve: false,
    });
    assert.ok(attempt.error, "expected a re-review to be rejected");
  });

  await t.test("cleanup", async () => {
    const ops = await as("ops");
    await ops.from("transport_requests").delete().eq("id", requestId!);
  });
});

test("transport_documents.transport_party_id must belong to the same request", async (t) => {
  const customer = await as("customer");
  let requestId: string | undefined;
  let otherRequestId: string | undefined;
  let partyId: string | undefined;

  await t.test("setup: two drafts, one with a party", async () => {
    const created = await customer.rpc("create_transport_draft", {
      p_request: {},
      p_animals: [],
      p_parties: [{ party_role: "delivery_contact", external_name: "Contact A" }],
    });
    assert.equal(created.error, null);
    requestId = created.data as string;

    const other = await customer.rpc("create_transport_draft", { p_request: {} });
    assert.equal(other.error, null);
    otherRequestId = other.data as string;

    const parties = await customer
      .from("transport_parties")
      .select("id")
      .eq("transport_request_id", requestId)
      .eq("party_role", "delivery_contact")
      .single();
    assert.equal(parties.error, null);
    partyId = parties.data!.id as string;
  });

  await t.test("a document cannot reference a party from a different request", async () => {
    const attempt = await customer.from("transport_documents").insert({
      transport_request_id: otherRequestId!,
      transport_party_id: partyId!,
      category: "other",
      uploaded_by: ids.customer,
    });
    assert.ok(attempt.error, "expected the party/request mismatch trigger to reject this");
  });

  await t.test("a document referencing the matching party succeeds", async () => {
    const attempt = await customer
      .from("transport_documents")
      .insert({
        transport_request_id: requestId!,
        transport_party_id: partyId!,
        category: "other",
        uploaded_by: ids.customer,
      })
      .select("id");
    assert.equal(attempt.error, null);
  });

  await t.test("cleanup", async () => {
    await customer.from("transport_requests").delete().eq("id", requestId!);
    await customer.from("transport_requests").delete().eq("id", otherRequestId!);
  });
});
