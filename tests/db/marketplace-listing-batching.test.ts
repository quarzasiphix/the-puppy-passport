// Stage N (backend performance pass): src/lib/queries/marketplace.ts's listing functions
// (listPublishedLitters/listApprovedKennels/listLittersForKennel/listFollowedBreeders) used to
// call mapLitterRow/mapOrgToBreeder per row via Promise.all(rows.map(...)) -- a real N+1 pattern,
// 2 queries per row instead of 2 total per page. Fixed by batching the underlying counts into one
// `IN (...)` query across every id on the page (mapLitterRows/mapOrgsToBreeders). This is a pure
// TypeScript refactor with no RLS/schema change to guard, but the batched grouping logic itself
// (bucketing rows by litter_id/organization_id client-side) is exactly the kind of thing that's
// easy to get subtly wrong -- this proves the batched query, run directly the way the app runs
// it, produces the same counts as the original one-id-at-a-time approach for real seeded data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { anon, ids } from "./helpers.ts";

test("batched litter animal counts match the per-litter equivalent", async (t) => {
  const client = anon();

  await t.test(
    "Cichy Las's published litter has the expected available/reserved split",
    async () => {
      const litterId = "50000000-0000-0000-0000-000000000001";

      // The old per-row approach: two separate single-litter count queries.
      const availableOld = await client
        .from("animals")
        .select("*", { count: "exact", head: true })
        .eq("litter_id", litterId)
        .in("availability_status", ["available", "applications_open"]);
      const reservedOld = await client
        .from("animals")
        .select("*", { count: "exact", head: true })
        .eq("litter_id", litterId)
        .in("availability_status", ["reserved"]);
      assert.equal(availableOld.error, null);
      assert.equal(reservedOld.error, null);

      // The new batched approach: one query across every litter id on the page (here, just one, to
      // isolate the comparison), grouped client-side exactly like countAnimalsByStatusForLitters.
      const unrelatedLitterId = "50000000-0000-0000-0000-000000009998";
      const batched = await client
        .from("animals")
        .select("litter_id, availability_status")
        .in("litter_id", [litterId, unrelatedLitterId])
        .in("availability_status", ["available", "applications_open", "reserved"]);
      assert.equal(batched.error, null);

      let available = 0;
      let reserved = 0;
      for (const row of batched.data ?? []) {
        if (row.litter_id !== litterId) continue;
        if (row.availability_status === "reserved") reserved += 1;
        else available += 1;
      }

      assert.equal(available, availableOld.count ?? 0);
      assert.equal(reserved, reservedOld.count ?? 0);
    },
  );

  await t.test("an id with no animals contributes zero rows, not an error", async () => {
    const nonexistentLitterId = "50000000-0000-0000-0000-000000009999";
    const batched = await client
      .from("animals")
      .select("litter_id, availability_status")
      .in("litter_id", [nonexistentLitterId])
      .in("availability_status", ["available", "applications_open", "reserved"]);
    assert.equal(batched.error, null);
    assert.equal(batched.data?.length, 0);
  });
});

test("batched org breeds/available-puppy counts match the per-org equivalent", async (t) => {
  const client = anon();

  await t.test(
    "Cichy Las's breeds and available-puppy count match a direct single-org query",
    async () => {
      const orgId = ids.orgCichyLas;

      const breedsOld = await client
        .from("parent_dogs")
        .select("breeds(name)")
        .eq("kennel_id", orgId);
      assert.equal(breedsOld.error, null);
      const namesOld = new Set<string>();
      for (const row of (breedsOld.data ?? []) as unknown as {
        breeds: { name: string } | null;
      }[]) {
        if (row.breeds?.name) namesOld.add(row.breeds.name);
      }

      const puppiesOld = await client
        .from("animals")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("is_published", true)
        .in("availability_status", ["available", "applications_open"]);
      assert.equal(puppiesOld.error, null);

      // Batched equivalent, across two org ids to prove per-org isolation.
      const orgIds = [orgId, ids.orgWolnaDolina];
      const breedsBatched = await client
        .from("parent_dogs")
        .select("kennel_id, breeds(name)")
        .in("kennel_id", orgIds);
      assert.equal(breedsBatched.error, null);
      const namesBatched = new Set<string>();
      for (const row of (breedsBatched.data ?? []) as unknown as {
        kennel_id: string | null;
        breeds: { name: string } | null;
      }[]) {
        if (row.kennel_id === orgId && row.breeds?.name) namesBatched.add(row.breeds.name);
      }
      assert.deepEqual(Array.from(namesBatched).sort(), Array.from(namesOld).sort());

      const puppiesBatched = await client
        .from("animals")
        .select("organization_id")
        .in("organization_id", orgIds)
        .eq("is_published", true)
        .in("availability_status", ["available", "applications_open"]);
      assert.equal(puppiesBatched.error, null);
      const countBatched = (puppiesBatched.data ?? []).filter(
        (row) => row.organization_id === orgId,
      ).length;
      assert.equal(countBatched, puppiesOld.count ?? 0);
    },
  );
});
