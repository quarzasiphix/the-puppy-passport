-- Stage W (supplemental queue): search/discovery. Audited the marketplace browse/search query
-- path (src/lib/queries/marketplace.ts) for the same class of issue Stage N found and fixed
-- (missing index on a demonstrably hot query column). `is_published` (animals, litters),
-- `is_public`/`org_type`/`verification_status` (organisations) gate nearly every public
-- marketplace query in this file (listPublishedPuppies, listPublishedLitters,
-- listApprovedKennels, listLittersForKennel, and the animal/org detail lookups) -- these are not a
-- guess, they are the single most-executed query pattern in the whole public marketplace, the same
-- justification tier as the litter_id/organization_id indexes added in Stage N. Matching that
-- stage's own "no blind indexing" discipline: these three are added because they're the
-- demonstrated target of real, existing queries, not a speculative sweep of every unindexed column
-- found during a broader audit.
--
-- Partial indexes (`where is_published`/`where is_public`) rather than plain ones: the excluded
-- rows (drafts, unpublished, unapproved) are never the target of these specific public-facing
-- queries, so there's no reason to pay the index-maintenance cost for them.
--
-- Also found and left alone deliberately: listPublishedPuppies()'s `filters?: { breed, country }`
-- parameter fetches the full result set and filters breed/country in JS afterwards rather than
-- pushing them into the query -- and its only real call site (_public.find-a-dog.tsx, a
-- frontend-owned file outside this session's scope) never actually passes those filters, doing
-- 100% client-side search/filtering over an unpaginated full fetch instead. Real, but not fixed
-- here: the caller doesn't use the filters today (so wiring them server-side would be dead code),
-- and adding a LIMIT without corresponding pagination UI would silently drop listings past the
-- limit with no way for a user to see the rest. Documented in
-- docs/AUTONOMOUS_BACKEND_PROGRESS.md as a known gap for whoever next works on marketplace
-- scale/UX, not guessed at here.
create index animals_public_listing_idx on public.animals (listing_category, is_published)
  where is_published;

create index litters_public_listing_idx on public.litters (kennel_id, is_published)
  where is_published;

create index organisations_public_listing_idx on public.organisations (org_type, verification_status)
  where is_public;
