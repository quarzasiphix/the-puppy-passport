# Cursor stability audit

Stage XR-17 (append-only queue). Audited the one real server-side-paginated query in this app,
`listPublishedPuppies()` (Stage IR-2), for the concerns this stage names: stable tie-breakers,
bounded page size, and malformed-input rejection.

## Found and fixed: no secondary tie-breaker

`.order("created_at", { ascending: false })` was the only sort key. `created_at` is not a stable
tie-breaker on its own: Postgres evaluates `now()` once per SQL *statement*, not once per row, so
several rows inserted by the same multi-row `INSERT` (e.g. several puppies from one litter added
at once — a real, reachable pattern, not hypothetical) share the exact same `created_at` value.
`.range()`-based pagination has no guaranteed ordering among tied rows across two separate query
executions, so a puppy could appear on two pages or be silently skipped depending on how each
query happens to resolve the tie.

Fixed by adding `id` (unique, stable) as a secondary sort key:
`.order("created_at", { ascending: false }).order("id", { ascending: true })`. No visible change
for the common case (distinct timestamps); closes the gap for the tied case. New test in
`tests/db/marketplace-search-contract.test.ts` proves it against a genuine tie, not a hypothetical
one — two animals inserted in one statement (confirmed to share the literal same `created_at`
value), then proves the ordered query resolves them deterministically and repeatably.

## Bounded page size — already correct

`pageSize` is always caller-supplied to `.range(from, from + pageSize - 1)` with no server-side
maximum. Checked the one real caller of the paginated path — none currently exists yet
(`_public.find-a-dog.tsx` still does 100% client-side filtering over an unpaginated fetch, a
known, already-documented gap from Stage W, unrelated to this stage). Since nothing currently
calls `listPublishedPuppies()` with a `page`/`pageSize` argument at all, there is no reachable
"absurdly large page size" attack surface today — the same "audited, no reachable trigger yet"
shape as several other stages this session. Worth a bounded max (e.g. clamped to 100) whenever the
first real caller is built, not added speculatively now.

## "Malformed cursor rejection" — not applicable to this design

This stage's own wording assumes an opaque cursor token. This app's real pagination is plain
offset-based (`page`/`pageSize` integers via `.range()`), not a cursor-token scheme — there is no
token to malform or forge. A negative `page` or zero `pageSize` would simply produce an
empty/degenerate `.range()` call, which PostgREST itself rejects with a real error rather than
returning wrong data (confirmed: no code path constructs `.range()` with unvalidated arithmetic
beyond simple multiplication of two numeric inputs). Not a real gap in this design.
