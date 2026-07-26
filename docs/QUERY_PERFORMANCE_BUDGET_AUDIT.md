# Query performance budget audit (Stage XR-21)

## Why this stage exists, concretely

Stage N's and Stage W's own index migrations
(`supabase/migrations/*_marketplace_listing_indexes.sql`,
`*_public_listing_query_indexes.sql`) each explicitly deferred a broader indexing pass: a full
schema audit found ~130 other unindexed foreign-key columns, but with only a few dozen rows per
table in the local seed data, `EXPLAIN ANALYZE` shows Postgres correctly choosing a sequential
scan regardless of whether an index exists — so indexing all of them then would have been "blind
indexing" with no evidence behind it. Both stages left the real answer for later: "once real usage
data (pg_stat_statements or equivalent) can identify genuinely hot ones." This stage is that later
pass.

## What was built

`pg_stat_statements` is already installed and enabled in this project's local Postgres image
(confirmed via `pg_extension`) — no new extension or migration needed. New
`scripts/query-performance-report.mjs` (`npm run db:perf-report`) is a thin, reusable wrapper:
`--reset` zeroes the counters, then exercising any real workload (`npm run test:db`, or the app
itself) and re-running without `--reset` prints the top N queries ranked by total execution time,
with call counts and mean latency — a repeatable tool for this and future audits, not a one-off
finding.

## The actual audit run

Reset counters, ran the full `test:db` suite once (891 tests — the most representative real
workload available in this environment, exercising nearly every RPC and query path in the app),
then reported the top 20 queries by total execution time. Full output cross-checked against
`EXPLAIN ANALYZE` for the two outliers below.

**No genuinely hot, unindexed query path was found.** Every marketplace/listing query relevant to
the ~130 columns Stage N/W deferred (`animals` filtered by `litter_id`/`organization_id`,
`organisations` filtered by `owner_user_id`, `parent_dogs` filtered by `kennel_id`, the published-
listing queries) executed in well under 1ms, most under 0.2ms — confirming Stage N/W's existing
targeted indexes cover the queries that actually run, and that indexing the rest now would still be
speculative. This is a real negative result, not a skipped check: it's the evidence-based
confirmation Stage N/W said this future pass should produce, whichever way it came out.

**One apparent outlier investigated and ruled out as noise, not a real gap**: an unfiltered
`SELECT id FROM rate_limit_events LIMIT 1` (the admin-visibility smoke check in
`tests/db/rate-limiting.test.ts`) showed a 52ms mean over 2 calls — far above everything else in
the report. Reproduced directly with `EXPLAIN ANALYZE`: actual execution time is 0.08ms, a
sequential scan correctly chosen at this row count. The 52ms in `pg_stat_statements` is
PostgREST/connection/cold-path overhead on a code path exercised only twice across 891 tests, not
a real query cost — confirmed by comparing against the identical shape of query with a `WHERE`
clause elsewhere in the report, which shows normal sub-millisecond timing. No fix needed; documented
here rather than silently dismissed, since it's exactly the kind of number a future skim of this
report could otherwise misread as a real problem.

All INSERT-heavy top entries (`sessions`, `refresh_tokens`, `audit_log_entries`, `mfa_amr_claims`,
`users`) are Supabase Auth's own internal tables, driven by this suite's persona sign-ins (215 calls
matches the ~10 cached personas × repeated `as()` calls across the run) — expected, not app-code
performance, and out of this project's control.

## The budget, going forward

Given the above, the practical budget for this codebase's current scale is: **no query should
exceed a few milliseconds mean latency under the `test:db` workload**; anything that does is worth
a manual `EXPLAIN ANALYZE` before assuming it needs an index, since a low call count can produce a
misleadingly high mean from cold-start effects (as demonstrated above). Re-run
`npm run db:perf-report -- --reset` before a workload and `npm run db:perf-report` after whenever
the ~130 deferred columns are revisited, or after any new feature adds a filtered query over a
larger table — this is the tool to make that decision with evidence instead of a guess.

## Verification

- `npx tsc --noEmit` — clean.
- `npx eslint scripts/query-performance-report.mjs` — clean.
- Live-tested end-to-end: reset, ran the full `test:db` workload, generated a real report, fixed a
  real bug found while doing so (embedded newlines in some `pg_stat_statements.query` values broke
  the naive one-line-per-record parser; fixed with `regexp_replace` flattening at the SQL level),
  re-verified the fixed output.
- No migration, no app/schema code changed this stage.
