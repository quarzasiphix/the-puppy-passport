-- Stage N: backend performance pass. Fixed a real N+1 pattern in src/lib/queries/marketplace.ts
-- (mapLitterRow/mapOrgToBreeder were called per-row via Promise.all(rows.map(...)) on every
-- marketplace listing page, issuing 2 count/select queries per row instead of 2 total for the
-- whole page) by batching listPublishedLitters/listApprovedKennels/listLittersForKennel/
-- listFollowedBreeders through new mapLitterRows/mapOrgsToBreeders, which each run exactly one
-- `IN (...)` query across every id on the page.
--
-- These batched queries filter on animals.litter_id, animals.organization_id and
-- parent_dogs.kennel_id -- none of which had an index (foreign keys are not auto-indexed by
-- Postgres, only the referenced primary-key side is). A broader audit (via
-- `supabase db dump --local --schema public`) found ~130 other foreign-key columns across the
-- schema in the same unindexed state, but the local seed dataset tops out at a few dozen rows per
-- table -- EXPLAIN ANALYZE against it shows Postgres correctly choosing a sequential scan over an
-- index scan regardless of whether an index exists, the standard planner behaviour below roughly
-- a few hundred rows. Adding an index for every one of those ~130 columns now, without evidence
-- any of them are actually hot, would be exactly the "blind indexing" this stage was told not to
-- do. These three are different: they are not a guess, they are the direct, demonstrated target
-- of the N+1 fix above, and IN(...) queries across a page of listing rows degrade close to
-- linearly without an index on the filtered column even at moderate row counts, unlike a
-- single-row equality lookup. The remaining unindexed foreign keys are left for a future pass
-- once real usage data (pg_stat_statements or equivalent) can identify genuinely hot ones, rather
-- than indexed speculatively here.
create index animals_litter_id_idx on public.animals (litter_id);
create index animals_organization_id_idx on public.animals (organization_id);
create index parent_dogs_kennel_id_idx on public.parent_dogs (kennel_id);
