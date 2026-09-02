# Fixture determinism audit (Stage XR-19)

## The bug class

Stage AM's `createTestTransportRequest()` helper already documented and fixed one instance of
this: a fixture uniqueness suffix built from `Date.now()` alone is theoretically collision-prone —
Node's clock resolution is coarser than the wall-clock time a fast synchronous call can complete
in, so two calls in the same test run can produce the same millisecond. That fix was never
re-applied to the other major source of `Date.now()`-only uniqueness in the suite: disposable
`auth.signUp()` test emails.

A collision here is more severe than most fixture collisions elsewhere in the suite:
`auth.signUp()` fails outright with "email already registered," an infrastructure-level setup
failure that aborts the whole test (not a clean, informative assertion failure).

## What changed

Added `uniqueTestEmail(prefix)` to `tests/db/helpers.ts`, matching `createTestTransportRequest()`'s
own precedent (`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`), and migrated every
`auth.signUp()` call site that built its email from `Date.now()` alone:

- `tests/db/deletion-blocker-graph.test.ts`
- `tests/db/duplicate-detection.test.ts`
- `tests/db/account-deletion-execution.test.ts` (two call sites)
- `tests/db/risk-signals.test.ts`
- `tests/db/legal-holds.test.ts`
- `tests/db/recent-auth-step-up.test.ts`
- `tests/db/legal-consent-versioning.test.ts`

Two files already generated `auth.signUp()` emails with a random component
(`support-case-rate-limits.test.ts`, `verification-approval-idempotency.test.ts`) and were left
untouched — no gap there.

## Deliberate scope boundary

The suite still has other `Date.now()`-only uniqueness suffixes (~19 files) — request numbers,
notification `dedup_key`s, storage object paths, and similar. These were deliberately left alone:
a collision there produces an ordinary, informative assertion failure or a Postgres unique-
constraint error inside a single test, not an opaque `auth.signUp()` infrastructure failure that
aborts the run. Fixing every one would have been implementing speculative robustness with no
corresponding gap ever observed, contrary to the "don't invent unnecessary work" standing
instruction. `rate-limiting.test.ts`'s `rate-limit-wiring-check-${Date.now()}@anemalo.test` is a
`p_email` argument to an org-invitation RPC, not an `auth.signUp()` call, so it carries none of the
severity that motivated this fix and was left as-is.

## Verification

- `npx tsc --noEmit` — clean.
- `npx eslint` on all 8 changed files — clean.
- Fresh `supabase db reset`, then two consecutive `npm run test:db` runs — 891/891 passing both
  times, no flakiness.
- `npm run build` — succeeds.
- `npm run db:preflight` — 135 migration files scanned, no unsafe patterns (no migration was
  needed for this stage; pure test-infrastructure change).
- No duplicate migration filename prefixes.
- `git diff --name-only` confirmed to be exactly the 8 intended files, no stray changes.
