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

## Second incident (later session): the "flakiness" above was misdiagnosed

The "genuine, disclosed flakiness under sustained session load" explanation originally written in
this section was wrong, and is kept below (struck through in spirit, not in fact — left visible
deliberately) rather than deleted, since getting this wrong once is itself worth recording.

In a later session, re-running `test:db` — including immediately after a genuinely fresh
`docker volume rm` at the very start of a session, with no prior "sustained load" possible —
reproduced the same symptom: a different, non-overlapping set of failures each run
(`execute_account_deletion`, `anonymisation consistency`, `get_account_deletion_blockers`,
`risk_signals` rate-limit crossing, `approve_user_verification` idempotency/concurrency,
`signup consent recording`, `legal hold` blocking). Reproducing it on a fresh volume at session
start ruled out "sustained load" as the cause, so this time it was investigated properly instead of
re-attributed to load.

Root cause: `tests/db/helpers.ts` was already fixed (see above) to derive `SUPABASE_URL`/`ANON_KEY`
correctly from this worktree's own `supabase/config.toml`. But **9 test files each independently
duplicated their own local disposable-signup client** with the old hardcoded
`http://127.0.0.1:54321` default, bypassing that fix entirely: `account-deletion-execution.test.ts`,
`risk-signals.test.ts`, `verification-approval-idempotency.test.ts`,
`legal-consent-versioning.test.ts`, `deletion-blocker-graph.test.ts`, `duplicate-detection.test.ts`,
`legal-holds.test.ts`, `recent-auth-step-up.test.ts`, `support-case-rate-limits.test.ts`. Each of
these files creates a throwaway `auth.signUp()` account via its own local client (correctly against
the isolated instance in some call sites, wrongly against the shared instance in these 9), then
operates on the resulting row via `as("admin")` (correctly against the isolated instance) — a
genuine cross-database mismatch, not a race. Which specific test failed on a given run depended on
execution order and exact timing of unrelated activity on the *shared* instance (Bot 1's own
concurrent work, etc.), which is exactly why the failing set looked different every time and mimicked
the signature of real scheduling flakiness without being one.

Fixed by exporting a single `freshClient()` from `helpers.ts` (verified identical auth options at
every one of the 9 files' call sites first) and replacing every local `createClient(SUPABASE_URL,
ANON_KEY, {...})` call with it. See commit `f914887`.

**Corrected verified result**: 1062/1062 × 3 consecutive clean runs, immediately reproducible,
genuinely deterministic — no more run-to-run variance. The three "clean" runs originally documented
above (right after the first fix) most likely were not actually free of this second bug; they either
got lucky on execution order or this bug simply hadn't been triggered by whichever subset of tests
happened to run in that exact interleaving. Only the runs after commit `f914887` should be treated as
trustworthy evidence.

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
than accidentally against the shared one. The `db:schema-drift` container crash remains
independently attributable to an already-disclosed, pre-existing infrastructure pattern, not a new
defect. The real, useful defects this investigation found — first three, then a further nine —
hardcoded shared-instance references defeating cross-worktree isolation, are all fixed. Nothing
observed across either investigation was ever genuine environmental flakiness; both rounds were
deterministic cross-database mismatches, and the second round's initial "flakiness" explanation was
a misdiagnosis, corrected above rather than quietly replaced.
