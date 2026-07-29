# Query bounding audit

## Method

An initial broad grep across every `src/lib/queries/*.ts` export for `.select(` without `.limit(`/
`.range(` produced ~130 false-positive matches — mostly single-row `get*` fetches, or `list*`
functions whose result set is inherently bounded by a caller-supplied relation id (per-kennel,
per-conversation, per-route, etc.), which don't grow unboundedly with total site traffic. Narrowed
to the meaningful risk category instead: **public-facing marketplace/community list queries with no
caller-supplied bound, whose row count grows with total published listings/posts over time** — the
exact class of gap Q-1 already closed for `listPublishedPuppies()` (see that function's own comment
in `src/lib/queries/marketplace.ts`).

## Fixed (commit `8798981`)

Added `.order(...).limit(DEFAULT_PAGE_SIZE)` (200, matching the existing Q-1 constant/convention)
to 6 functions that had none:

- `listPublishedLitters()` — had neither a stable order nor a limit.
- `listApprovedKennels()` — had neither.
- `listApprovedFoundations()` — had neither.
- `listPublishedAdoptions()` — already ordered by `created_at desc`, was missing only the limit.
- `listGroups()` (`src/lib/queries/groups.ts`) — had an order, no limit; added a local
  `DEFAULT_PAGE_SIZE` constant to that file (a separate module from `marketplace.ts`).
- `listGroupPosts()` — same file; the highest-risk of the two (an unbounded per-group feed that
  grows with every post, not just organisation count).

All 6 are invisible against the current dataset (every real call site calls these with no
arguments and no existing caller expects more than 200 rows back) — same reasoning Q-1 used.

## Checked and left alone (not a gap)

- `listRoutesForDateRange(startDate, endDate)` — already implicitly bounded by its date-range
  arguments, not truly unbounded.
- `listPublicCampaigns()`/`listPublicContributions()` (fundraising) — real unbounded-fetch pattern
  technically present, but fundraising is deliberately disabled end-to-end
  (`VITE_FUNDRAISING_ENABLED=false`, see `docs/BETA_SCOPE.md`) — not reachable by real traffic
  right now. Left unfixed to keep this change set scoped to reachable code; flagged here so it's
  not forgotten if/when fundraising is turned on.
- Every `list*ForKennel`/`list*ForOrg`/`listMy*`/`listConversationMessages`/etc. — bounded by
  construction (one organisation's, or one user's, own rows), not a public unbounded-growth risk.

## Stable ordering

Every query touched now has an explicit `.order()` — `listPublishedLitters`, `listApprovedKennels`,
and `listApprovedFoundations` previously had none at all (relying on Postgres's undefined default
row order), which is a real, separate correctness gap beyond just being unbounded: without an
explicit order, adding a `.limit()` to an unordered query would make the *specific* rows returned
non-deterministic across otherwise-identical requests. Ordering by `created_at desc` was added to
all three as part of the same fix, not as an afterthought.

## Not attempted in this pass

- No live query-performance profiling (`npm run db:perf-report` exists but needs a running,
  populated local Supabase instance — deferred to Phase 26 alongside the rest of the stateful DB
  verification).
- No N+1 audit beyond what integration itself already found and fixed (ledger entry 3) — a fresh
  N+1 sweep would benefit from the same live-instrumentation the existing perf-report script uses,
  not source inspection alone.
