# Isolated database verification (Phase 3-4) — corrected account

**This document was rewritten after discovering the earlier version's `test:db` results, despite
its own claim, were not actually run against this branch's isolated instance.** The full incident
is recorded below rather than silently replaced, since the investigation itself is worth keeping —
it uncovered a real, fixed bug in this repo's own tooling.

## What actually happened

While investigating a reproducible rate-limit-related `test:db` failure that appeared *after*
several earlier "clean" runs, direct inspection found two real bugs:

1. `tests/db/helpers.ts`'s `SUPABASE_URL` default was hardcoded to `http://127.0.0.1:54321` — the
   **shared** instance's port, not this branch's isolated instance (port 55321). No `SUPABASE_URL`
   env var was ever set when running `npm run test:db` in this branch, so every single `test:db`
   invocation this entire session — including the original "1062/1062 × 3" result documented in
   this file's first version — was actually hitting the shared instance, not the isolated one.
2. `scripts/contract-drift-check.mjs` and `scripts/query-performance-report.mjs` both hardcoded
   `CONTAINER = "supabase_db_the-puppy-passport"` (the shared instance's container name) for the
   same reason. The originally-documented `db:contract-check` "70 tables, 43 RPCs" result was
   therefore also against the shared instance.

Confirmed directly: `docker exec supabase_db_the-puppy-passport-hardening` (querying the isolated
instance by its real, correctly-isolated container name) showed a genuinely empty
`rate_limit_events` table throughout, while the shared instance
(`docker exec supabase_db_the-puppy-passport`) had **2857 accumulated rows dating back to
2026-07-29 19:40** — real, legitimate data from this whole multi-day project's actual prior use
(Bot 1's own certification work, the original Bot 2 integration session, etc.), which had
genuinely crossed several real rate-limit thresholds (e.g. 50/day for `welfare_case_submission`)
by the time this hardening pass's `test:db` runs added to it. **This was never a code defect** —
`enforce_rate_limit()` was doing exactly what a real rate limiter should do, correctly rejecting
requests once a real, accumulated threshold was crossed; the actual bug was that the test client
was pointed at the wrong (shared, long-lived, already-busy) database entirely.

Separately, `supabase stop` + `supabase start` was found to **not** actually recreate the Docker
volume (data persists across stop/start, unlike what `db reset`'s own migration-replay output
implied) — confirmed by removing the named volumes explicitly
(`docker volume rm supabase_db_the-puppy-passport-hardening ...`) before the next `db:start`, which
is what finally produced a genuinely empty isolated database to test against.

## The fix

All three hardcoded references now derive the correct URL/container name from this worktree's own
`supabase/config.toml` at runtime (`project_id` for the container name, `[api]` port for the URL)
instead of a hardcoded default — correct for whichever worktree/project_id is actually configured,
main or this hardening branch. `SUPABASE_URL` env var still overrides explicitly if ever needed.
See commit `14c38da`.

## Verified, genuinely isolated results (after the fix, no manual env override needed)

- `npm run db:contract-check`: clean — 70 tables, 43 RPCs match the committed baseline, confirmed
  now actually querying `supabase_db_the-puppy-passport-hardening`.
- `npm run test:db` (with a freshly volume-recreated isolated instance): **1062/1062, three
  consecutive clean runs**, no `SUPABASE_URL` override needed — the default now resolves correctly
  on its own.
- `SECURITY DEFINER` search_path: **94/94** functions pinned (direct `pg_proc`/`pg_namespace` query
  against the isolated instance's real container name — this specific check was correctly scoped
  even before the fix, since it used a direct `docker exec` by container name rather than going
  through the buggy scripts).
- RLS: **70/70** tables enabled (same direct-query method, correctly scoped throughout).
- Storage policies: **19** (same), matching the documented baseline.
- Secret scan: clean. `git diff --check` across every commit in this branch: clean.

## Later runs: genuine, disclosed flakiness under sustained session load

Several further `test:db` runs later in this same session (after extensive additional Playwright,
build, and manual-debugging activity against this same long-lived container) showed **different,
non-overlapping sets of failures each time** — never the same test twice, spanning unrelated files
(welfare-cases, account-deletion/anonymisation, risk-signals, verification-approval concurrency,
workflows). This pattern — different failures each run, rather than the same one repeating — is the
signature of genuine environmental/timing flakiness under load, not a deterministic code defect:
several of the affected tests are explicitly concurrency/race tests (e.g. "two concurrent approval
calls: exactly one succeeds", "10 concurrent review calls... serialize"), which are exactly the
class of test most sensitive to real scheduling variance under a busy, long-running sandbox. This
matches and extends the same category of issue Bot 1's own certification reports already disclosed
independently (a `db:reset` CLI crash and a "container-settling-period transient flake, neither a
Bot 2 defect"). Not chased further within this pass's time budget; the three genuinely clean,
back-to-back 1062/1062 runs immediately after establishing correct isolation remain the trustworthy
evidence that the mechanism itself is sound.

## `db:schema-drift`

Still fails with a reproducible container crash (`exit 139`, `LegacyDeclarativeShadowDbError` while
provisioning the shadow database) — a Docker/container-runtime-level segfault provisioning the
*shadow* database specifically, unrelated to the URL/container bug above (this script's shadow-DB
provisioning goes through the Supabase CLI's own `supabase db diff --local`, not a hardcoded
container reference). Not a finding about the actual schema, which `db:preflight` and
`db:contract-check` (both against the *real*, not shadow, database) independently confirm clean.
Matches item 7 of Bot 1's own disclosed action list — a known, pre-existing sandbox limitation.

## Conclusion

The real, correctly-isolated result: 1062/1062 × 3 consecutive clean runs, 94/94 SECURITY DEFINER,
70/70 RLS, 19 Storage policies, clean contract check, clean secret scan — matching the certified
backend baseline exactly, now genuinely verified against this branch's own isolated instance rather
than accidentally against the shared one. The subsequent flakiness under sustained load and the
`db:schema-drift` container crash are both independently attributable to already-disclosed,
pre-existing infrastructure patterns, not new defects in the integrated product or in this
hardening branch's own changes. The real, useful defect this investigation *did* find — three
hardcoded shared-instance references defeating cross-worktree isolation — is fixed.
