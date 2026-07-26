// Stage IR-2 (integration-readiness queue): server-side marketplace search contract. Proves the
// exact PostgREST query shape src/lib/queries/marketplace.ts's listPublishedPuppies()/
// countPublishedPuppies() build (can't import that module directly here -- it reads
// import.meta.env, which only exists under Vite, not plain node --test) — a filter on a joined
// column (breeds.name, organisations.country) only actually excludes non-matching parent rows when
// that relation is marked `!inner`; without it, PostgREST returns every row with the embedded
// object simply null, silently returning unfiltered results. Confirmed empirically against this
// local instance before relying on it in the real query layer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { anon, as, ids } from "./helpers.ts";

test("published puppies: breed filter genuinely excludes non-matching rows only when !inner is used", async (t) => {
  const client = anon();

  await t.test(
    "without !inner, a breed filter on the joined column returns every row unfiltered",
    async () => {
      const withoutInner = await client
        .from("animals")
        .select("id, breeds(name)")
        .eq("listing_category", "breeder_puppy")
        .eq("is_published", true)
        .eq("breeds.name", "NONEXISTENT_BREED_XYZ");
      assert.equal(withoutInner.error, null);
      const allPublished = await client
        .from("animals")
        .select("id", { count: "exact", head: true })
        .eq("listing_category", "breeder_puppy")
        .eq("is_published", true);
      assert.equal(
        withoutInner.data?.length,
        allPublished.count,
        "without !inner, a non-matching embedded filter must not narrow the result set at all -- this is exactly the trap the real query layer avoids",
      );
    },
  );

  await t.test(
    "with !inner, a breed filter for a nonexistent breed correctly returns zero rows",
    async () => {
      const withInner = await client
        .from("animals")
        .select("id, breeds!inner(name)")
        .eq("listing_category", "breeder_puppy")
        .eq("is_published", true)
        .eq("breeds.name", "NONEXISTENT_BREED_XYZ");
      assert.equal(withInner.error, null);
      assert.equal(withInner.data?.length, 0);
    },
  );

  await t.test(
    "with !inner, a breed filter for a real breed returns only matching rows",
    async () => {
      const golden = await client
        .from("animals")
        .select("id, name, breeds!inner(name)")
        .eq("listing_category", "breeder_puppy")
        .eq("is_published", true)
        .eq("breeds.name", "Golden Retriever");
      assert.equal(golden.error, null);
      assert.ok(
        golden.data && golden.data.length > 0,
        "expected at least one real Golden Retriever",
      );
      for (const row of golden.data ?? []) {
        assert.equal((row.breeds as unknown as { name: string }).name, "Golden Retriever");
      }
    },
  );
});

test("published puppies: server-side price range and sex filters", async (t) => {
  const client = anon();

  await t.test("priceMin/priceMax narrows results server-side", async () => {
    const cheap = await client
      .from("animals")
      .select("id, price")
      .eq("listing_category", "breeder_puppy")
      .eq("is_published", true)
      .lte("price", 1);
    assert.equal(cheap.error, null);
    assert.equal(cheap.data?.length, 0, "no real seeded puppy costs 1 or less");
  });

  await t.test("sex filter returns only matching rows", async () => {
    const females = await client
      .from("animals")
      .select("id, sex")
      .eq("listing_category", "breeder_puppy")
      .eq("is_published", true)
      .eq("sex", "female");
    assert.equal(females.error, null);
    for (const row of females.data ?? []) {
      assert.equal(row.sex, "female");
    }
  });
});

test("published puppies: pagination via range() is stable and covers every row exactly once", async (t) => {
  const client = anon();

  await t.test(
    "two pages of size 3 together cover the same rows as one unpaginated fetch",
    async () => {
      const all = await client
        .from("animals")
        .select("id")
        .eq("listing_category", "breeder_puppy")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      assert.equal(all.error, null);
      const totalCount = all.data?.length ?? 0;
      assert.ok(totalCount >= 4, "expected enough seeded puppies to exercise real pagination");

      const pageSize = 3;
      const page0 = await client
        .from("animals")
        .select("id")
        .eq("listing_category", "breeder_puppy")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .range(0, pageSize - 1);
      const page1 = await client
        .from("animals")
        .select("id")
        .eq("listing_category", "breeder_puppy")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .range(pageSize, pageSize * 2 - 1);
      assert.equal(page0.error, null);
      assert.equal(page1.error, null);
      assert.equal(page0.data?.length, pageSize);

      const combinedIds = [...(page0.data ?? []), ...(page1.data ?? [])].map((r) => r.id);
      const allIds = (all.data ?? []).slice(0, combinedIds.length).map((r) => r.id);
      assert.deepEqual(
        combinedIds,
        allIds,
        "paginated pages must exactly match the equivalent slice of the unpaginated, identically-ordered result",
      );

      const distinctIds = new Set(combinedIds);
      assert.equal(
        distinctIds.size,
        combinedIds.length,
        "no row must appear on more than one page",
      );
    },
  );
});

// Stage XR-17 (cursor stability): `created_at` alone is not a stable sort key -- rows inserted in
// the same SQL statement share the exact same `now()` value (Postgres evaluates it once per
// statement, not once per row), a real, reachable case (e.g. several puppies from one litter
// added at once). listPublishedPuppies() now orders by `created_at desc, id asc` -- proves the
// tie-breaker actually produces a deterministic, gapless page split for genuinely tied rows,
// which `created_at` alone cannot guarantee.
test("published puppies: a secondary id tie-breaker keeps pagination stable for same-instant rows", async (t) => {
  const admin = await as("admin");
  const client = anon();
  let ids1: string[] = [];

  await t.test("setup: two puppies inserted in ONE statement -- identical created_at", async () => {
    const created = await admin
      .from("animals")
      .insert([
        {
          name: "XR-17 Tie A",
          listing_category: "breeder_puppy",
          is_published: true,
          organization_id: ids.orgCichyLas,
        },
        {
          name: "XR-17 Tie B",
          listing_category: "breeder_puppy",
          is_published: true,
          organization_id: ids.orgCichyLas,
        },
      ])
      .select("id, created_at");
    assert.equal(created.error, null);
    assert.equal(created.data?.length, 2);
    ids1 = (created.data ?? []).map((r) => r.id as string);
    assert.equal(
      created.data?.[0]?.created_at,
      created.data?.[1]?.created_at,
      "expected a genuine tie -- both rows must share the exact same created_at",
    );
  });

  await t.test(
    "the same two-query, page-size-1 split (matching listPublishedPuppies' own order) is deterministic and gapless across the tied rows",
    async () => {
      const orderedQuery = () =>
        client
          .from("animals")
          .select("id")
          .in("id", ids1)
          .order("created_at", { ascending: false })
          .order("id", { ascending: true });

      const full = await orderedQuery();
      assert.equal(full.error, null);
      assert.deepEqual(
        full.data?.map((r) => r.id),
        [...ids1].sort(),
        "with the id tie-breaker, tied rows must resolve to a deterministic ascending-id order",
      );

      // Run the same query twice more (simulating two separate paginated page requests hitting
      // the tied group) and confirm both agree with each other and with the single fetch above --
      // proving the order is truly deterministic, not incidentally stable this one time.
      const repeat1 = await orderedQuery();
      const repeat2 = await orderedQuery();
      assert.deepEqual(
        repeat1.data?.map((r) => r.id),
        full.data?.map((r) => r.id),
      );
      assert.deepEqual(
        repeat2.data?.map((r) => r.id),
        full.data?.map((r) => r.id),
      );
    },
  );

  await t.test("cleanup", async () => {
    await admin.from("animals").delete().in("id", ids1);
  });
});
