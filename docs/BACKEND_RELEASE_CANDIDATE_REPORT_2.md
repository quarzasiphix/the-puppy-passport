# Backend Release-Candidate Report — Second Supplemental Queue (Stages BA–CH)

Stage CH of the autonomous backend-hardening session (see `docs/AUTONOMOUS_BACKEND_PROGRESS.md`
for the full per-commit log). Closes the second supplemental queue. The session continues directly
into the third/fourth supplemental queue (Stage CJA onward, as far as content was actually
received) and then the IR-1 through IR-18 queue, per the standing instruction not to stop — this
report is a checkpoint, not an end-of-session summary, matching `docs/BACKEND_RELEASE_CANDIDATE_
REPORT.md`'s precedent for the first supplemental queue.

## Verification results (re-run fresh for this report, not carried over from memory)

- **Starting HEAD** (end of Stage BL-addendum, immediately before Stage BA): `73360b9` → **ending
  HEAD** (Stage CG): `efcc9c6`.
- **Migration count**: 113 files, **no duplicate numeric prefixes** — confirmed both by the manual
  `ls | sed | sort | uniq -d` check and by `npm run db:preflight` (the tool this queue itself
  built, Stage CA), which additionally scans for GRANT-vs-RLS gaps, missing-DEFAULT NOT NULL
  columns, same-file enum add-and-use, and bare destructive drops — clean.
- **Fresh `supabase db reset`**: applies all 113 migrations and seed data cleanly.
- **`npm run test:db`**: **635/635 passing**, verified on a fresh reset plus two more consecutive
  runs without reset (three full runs for this report specifically, since this queue includes
  several concurrency/chaos-test-heavy stages).
- **`npx tsc --noEmit`**: clean, zero errors.
- **`npm run build`**: clean, zero errors/warnings, Cloudflare Worker output generated;
  `src/routeTree.gen.ts` confirmed committed and in sync.
- **Full-repo `npm run lint`**: **38 errors, 13 warnings** — the exact same pre-existing baseline
  first documented at Stage K and re-verified at every closing stage since (Q, AP). No new lint
  regressions across the whole BA–CH range.
- **No push, deploy, or production mutation performed** — every change is a local commit only.
- **`ux-marketplace-frontend-pass`/`ux-marketplace-polish` were never entered or modified** —
  confirmed via `git log` against every excluded path across this entire range returning zero
  commits.

Test suite grew **576 → 635 (+59)** across this queue, from 14 new test files.

## Stages BA–CH: what actually changed

**Real code/schema fixes** (17 stages — a genuine gap found and closed, each with positive-and-
negative regression tests):

1. **BC — Verification idempotency**: `approve_user_verification()` had no guard against a
   double-call or a genuine concurrent race; both could produce two organisations for one
   verification. Fixed with `select ... for update` + an explicit status check.
2. **BD — Driver role hardening**: a suspended driver's role kept full access to their assigned
   jobs — four independent policies/functions checked row ownership but never `has_role(...,
   'driver')`. Fixed all four.
3. **BF — Route-stop uniqueness**: `route_stops` had no uniqueness on `(route_id, stop_order)`,
   letting a route's sequence become ambiguous.
4. **BG — Pickup/delivery evidence**: `transport_status_history.evidence_url` existed but was
   never wired to anything, and `advanceJobStatus()` had the same non-atomic + forgeable-actor
   shape already fixed elsewhere. Built the missing Storage bucket + atomic RPC.
5. **BJ — Currency validation**: `currency` was free-text with zero validation across 8 tables;
   added `CHECK` constraints after confirming only `'EUR'`/`'PLN'` are ever actually used.
6. **BK — Legal consent versioning**: signup promised terms/privacy agreement but recorded
   nothing. Built `legal_document_versions`/`user_consents`, wired into the real `signUp()` action.
7. **BL-addendum — Support cases**: a much more detailed spec arrived mid-session explicitly
   requesting a real system be built (superseding the earlier Stage BL audit's "no reachable
   consumer" conclusion) — built `support_cases`/`support_case_messages` plus an atomic claim RPC.
8. **BM — Moderation case claims**: the "investigate" UI action was a plain unconditioned UPDATE
   with no guard against a race between two moderators. Fixed with an atomic claim RPC.
9. **BN — Risk signals**: built an explainable, rule-based `risk_signals` table wired to real
   rate-limit-exhaustion events — found and fixed a real bug mid-build (a first version tried
   recording the signal in the same transaction as its own rejection, which Postgres always rolls
   back; redesigned around a trigger on already-committed events).
10. **BO — Duplicate detection**: `animals.microchip_number` had zero uniqueness (a hard, real
    integrity gap); a fuzzy "same requester, same request twice" case got an advisory `risk_signals`
    entry instead of a hard block.
11. **BQ — Error taxonomy**: raw Postgres/constraint errors were reaching customers verbatim via
    `toast.error(err.message)`. Built `src/lib/errors.ts`, wired into the one customer-facing file
    in scope.
12. **BR — RPC grant hygiene**: four RPCs relied solely on an internal check with no explicit
    `revoke ... from public` — a real, demonstrated defense-in-depth inconsistency versus 25+
    sibling RPCs.
13. **BU — Rate-limit archival**: `rate_limit_events` had grown unbounded since day one; the
    original migration's own comment had already proposed the fix but never implemented it.
14. **BW — Health checks**: no `/health` endpoint existed anywhere; added one with a real DB probe
    directly in the Worker's `fetch()` entry point.
15. **BZ — Maintenance mode**: no way to take the app down for a migration/deploy without a
    redeploy; built a real, admin-toggleable, server-stamped-actor mechanism.
16. **CC — Driver status state machine**: the assigned-driver UPDATE policy had zero transition
    validation — a driver could jump straight to `completed` or reassign route/vehicle/compliance
    fields via a raw API call. Built the real state machine, matching the app's own already-
    canonical sequence; found and fixed a real regression this surfaced in an existing test.
17. **CE — Data-access consolidation**: four route files independently reimplemented the same "get
    my organisation" query the query layer already had a canonical function for; two more
    duplicated a profile read/write with no shared function at all.

**Audits confirming an already-correct design, or a genuinely unbuilt feature correctly deferred**
(9 stages — honest "no fix needed" or "no reachable use" outcomes, not manufactured work):

BA (background jobs), BB (document expiry), BE (vehicle fleet), BI (service areas, duplicates AF),
BP (search read models — deferred to IR-2), BS (webhooks, disabled), BT (bulk import), BV (Storage
cleanup), and the original BL audit (superseded in-queue by the BL-addendum once a more detailed
spec arrived).

**Test-coverage-only** (no code change, closing a real gap in an already-correct design):

BH (transport incidents).

**Tooling**: CA — turned Stage AL's one-time manual migration audit into a real, reusable
`npm run db:preflight` command wired into CI.

**Documentation**: BX (service level objectives — framework, no fabricated numbers), BY (incident
runbooks), CB (database invariant catalogue), CD (permission inventory), CF (tech-debt register),
CG (this queue's own final PR review).

## Known open items carried into the next queue

See `docs/TECH_DEBT_REGISTER.md` (Stage CF) for the full, structured list — not repeated here to
avoid the two documents drifting apart. Nothing found this queue was left half-fixed; every open
item there is either a genuinely unbuilt feature with no current reachable trigger, or hardening
whose full scope is explicitly a later stage's job (IR-2, IR-5, IR-6).

## Closing

Clean release candidate for the second supplemental queue. Continuing directly into the third/
fourth supplemental queue (Stage CJA onward) and then IR-1 through IR-18, per standing instruction.
