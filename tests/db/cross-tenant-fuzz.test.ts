// Stage CJE (third/fourth supplemental queue): cross-tenant fuzz testing. Many individual
// cross-tenant checks already exist scattered across this suite (one assertion per feature file,
// found while building that feature) -- this is a single, consolidated, data-driven sweep across
// the major domain tables instead, so a future regression in any of them shows up in one place
// without having to remember which feature file originally covered it. Reuses the existing seeded
// fixtures (tests/db/helpers.ts's `ids`) rather than creating new ones -- every row here already
// has a real, known owner from supabase/seed.sql.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, isBlocked, type Persona } from "./helpers.ts";

type FuzzCase = {
  table: string;
  column: string;
  rowId: string;
  owner: Persona;
  unrelated: Persona[];
};

const cases: FuzzCase[] = [
  {
    table: "transport_requests",
    column: "id",
    rowId: ids.transportWarsawAmsterdam,
    owner: "customer",
    unrelated: ["buyer", "breeder1", "foundation1"],
  },
  {
    table: "transport_requests",
    column: "id",
    rowId: ids.transportKrakow,
    owner: "buyer",
    unrelated: ["customer", "breeder1", "foundation1"],
  },
  {
    table: "transport_requests",
    column: "id",
    rowId: ids.transportReksio,
    owner: "foundation1",
    unrelated: ["customer", "buyer", "breeder1"],
  },
  {
    table: "buyer_applications",
    column: "id",
    rowId: ids.applicationFabian,
    owner: "buyer",
    unrelated: ["customer", "foundation1", "foundationPending"],
  },
  {
    table: "transport_status_history",
    column: "transport_request_id",
    rowId: ids.transportWarsawAmsterdam,
    owner: "customer",
    unrelated: ["buyer", "breeder1", "foundation1"],
  },
  // Stage YR-14 (cross-tenant fuzz matrix): organisation_members has no single dedicated cross-
  // tenant test elsewhere -- an org's membership roster is itself sensitive (reveals who works
  // where), so it belongs in this sweep alongside the resource tables above.
  {
    table: "organisation_members",
    column: "org_id",
    rowId: ids.orgCichyLas,
    owner: "breeder1",
    unrelated: ["buyer", "breeder2", "foundation1"],
  },
];

test("cross-tenant fuzz sweep: unrelated personas get zero rows across every case", async (t) => {
  for (const c of cases) {
    await t.test(`${c.table} (${c.rowId}) is invisible to every unrelated persona`, async () => {
      for (const persona of c.unrelated) {
        const client = await as(persona);
        const attempt = await client.from(c.table).select("id").eq(c.column, c.rowId);
        assert.ok(
          isBlocked(attempt.data, attempt.error),
          `${persona} must not see ${c.table} row(s) matching ${c.column}=${c.rowId} (owned by ${c.owner})`,
        );
      }

      // Positive control: the owner (or the ops/admin who can always see everything) must still
      // see it -- otherwise a "blocked" result could just mean the row doesn't exist at all,
      // silently making every negative check above vacuously true.
      const ownerClient = await as(c.owner);
      const ownerView = await ownerClient.from(c.table).select("id").eq(c.column, c.rowId);
      assert.ok(
        !isBlocked(ownerView.data, ownerView.error),
        `sanity check failed: the real owner (${c.owner}) could not see their own ${c.table} row -- the negative checks above may be vacuous`,
      );
    });
  }
});

test("cross-tenant fuzz sweep: an unrelated org's write attempts against another org's animal are blocked", async (t) => {
  const unrelatedOrgs: Persona[] = ["breeder2", "foundation1"];

  await t.test("animals owned by Cichy Las cannot be updated by an unrelated org", async () => {
    for (const persona of unrelatedOrgs) {
      const client = await as(persona);
      const attempt = await client
        .from("animals")
        .update({ price: 1 })
        .eq("id", ids.animalMaja)
        .select();
      assert.ok(
        isBlocked(attempt.data, attempt.error),
        `${persona} must not be able to update Cichy Las's animal`,
      );
    }
  });

  await t.test("saved_animals rows for one buyer are invisible to another buyer", async () => {
    // supabase/seed.sql already seeds buyer -> animalMaja as a real saved-animal row -- reusing it
    // rather than inserting a duplicate (buyer already has this exact pair saved).
    const buyer = await as("buyer");
    const customer = await as("customer");
    const ownView = await buyer
      .from("saved_animals")
      .select("id")
      .eq("buyer_id", ids.buyer)
      .eq("animal_id", ids.animalMaja)
      .single();
    assert.equal(ownView.error, null, "sanity check: the seeded fixture must exist");

    const otherView = await customer
      .from("saved_animals")
      .select("id")
      .eq("id", ownView.data!.id as string);
    assert.ok(
      isBlocked(otherView.data, otherView.error),
      "an unrelated buyer must not see this saved-animal row",
    );
  });
});
