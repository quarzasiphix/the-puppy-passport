# Backend integration manifest (Stage XR-22)

The single current "what's true right now" reference for whoever integrates the frontend against
this backend, or resumes backend work later. Several earlier documents
(`docs/BACKEND_RELEASE_MANIFEST.md`, `docs/INTEGRATION_READY_HANDOFF.md`,
`docs/BACKEND_RELEASE_CANDIDATE_REPORT.md`, `docs/BACKEND_RELEASE_CANDIDATE_REPORT_2.md`) are each
a real, valuable point-in-time closeout report for one completed queue — none of them was ever
meant to stay current, and by this stage they cite commits, migration counts, and test counts that
are all now stale (the earliest cites 98 migrations/490 tests; this repo is now at 135/891). Read
them for history; read this one for the current state, and re-generate the numbers below with the
commands shown rather than trusting them once this document itself ages.

## Commit

- **HEAD**: `07e2e7d` (branch `main`) at the time this manifest was generated.
- Frozen frontend reference point (unchanged all session, never touched):
  `ux-marketplace-frontend-pass` at `727d551` in the separate worktree
  `/p/the-puppy-passport-ux/.claude/worktrees/marketplace-ux-pass` — see
  `docs/FRONTEND_INTEGRATION_CONFLICT_MAP.md` and `docs/FRONTEND_INTEGRATION_RUNBOOK.md`.

## Current verified numbers

- **135** migration files in `supabase/migrations/`, zero duplicate prefixes.
- **891/891** tests passing in `tests/db/` (63 files), via `npm run test:db`.
- `npx tsc --noEmit`: clean.
- `npm run build`: succeeds (Cloudflare Worker/`nitro` output).
- `npm run lint`: real baseline is **21 errors / 13 warnings** (Stage IR-16;
  `src/routeTree.gen.ts`/`src/lib/supabase/types.ts` excluded as generated), not the stale "38/13"
  figure repeated in several earlier commit messages.
- Public contract baseline (`docs/backend-api-contract-baseline.json`, Stage XR-18): **70 tables,
  36 RPCs**.

## The full verification toolbelt

Every one of these now exists and is wired as an `npm run` script — this is the actual "manifest,"
more than any static prose: a live database run through all of these is a stronger integration
guarantee than any document claiming a state.

| Command | What it checks | Needs a live DB? |
|---|---|---|
| `npm run db:preflight` | Static text scan of every migration file: missing RLS after GRANT, unsafe `NOT NULL` without `DEFAULT`, same-file enum add+use, destructive drops, `SECURITY DEFINER` without pinned `search_path`. | No |
| `npm run test:db` | The real regression suite — RLS, RPCs, triggers, workflows, concurrency, actor attribution — against a running local Supabase stack. | Yes |
| `npm run db:contract-check` | Live table grants (anon/authenticated × SELECT/INSERT/UPDATE/DELETE) and RPC signatures/grants, diffed against the committed baseline (Stage XR-18). Fails loudly on undocumented drift; `--write` regenerates after a deliberate change. | Yes |
| `npm run db:schema-drift` | Full structural diff (`supabase db diff --local`) between the live database and what the committed migrations would produce. Catches any out-of-band change, not just the grant/RPC surface (Stage XR-20). | Yes |
| `npm run db:perf-report` | Top queries by execution time via `pg_stat_statements`, for evidence-based (not guessed) indexing decisions (Stage XR-21). `--reset` before a workload, plain after. | Yes |
| `npx tsc --noEmit` | TypeScript compiles cleanly. | No |
| `npm run lint` | ESLint against the real (non-generated) source tree. | No |
| `npm run build` | Full Vite/Cloudflare Worker production build. | No |

Recommended order for anyone verifying a fresh checkout: `db:preflight` → `db:reset` → `test:db`
(×2, no reset between) → `db:contract-check` → `db:schema-drift` → `tsc` → `lint` → `build`. All of
these are non-destructive and safe to re-run at any time except `db:reset`, which wipes and
reseeds the local database (never point any of this at a real/production Supabase project — none
exists yet, see `docs/PRODUCTION_SETUP.md`).

## Known open items (compiled from this session's own audits, not new findings)

Every item below was found and documented by a specific stage, not invented here — this section
exists so a frontend integrator or future backend session doesn't have to re-read every individual
audit doc to find the real backlog. None of these blocks integration; all are pre-existing,
deliberately-scoped-out gaps.

1. **6 multi-write functions still lack full atomic-RPC conversion** (partial-failure risk, not a
   security issue — the actor-forgery half of the same functions was already fixed):
   `respondToQuotation`, `sendQuotation`, `assignDriverToJob`, `createTransportRequest`,
   `approveRehomingReview`, `escalateReportToCase`. Priority order and full detail in
   `docs/TRANSACTIONAL_WORKFLOW_BOUNDARIES_AUDIT.md` (Stage XR-7). Also noted there:
   `respondToQuotation()`'s 2nd/3rd writes never check their own `error` result — flagged
   explicitly so it isn't rediscovered from scratch by whoever does that follow-up.
2. **`listPublishedPuppies()`'s `filters?: { breed, country }` parameter is dead code server-side**
   — its only real caller (`_public.find-a-dog.tsx`, a frontend-owned file) does 100% client-side
   filtering over an unpaginated full fetch instead of passing them through. Real, but not fixed:
   the caller doesn't use the filters today, and adding a `LIMIT` without corresponding pagination
   UI would silently drop listings with no way for a user to see the rest. Detail in
   `docs/CURSOR_STABILITY_AUDIT.md` (Stage XR-17).
3. **~130 foreign-key columns remain unindexed** by deliberate choice (Stages N, W) — confirmed by
   Stage XR-21's real `pg_stat_statements` audit that none of them are currently hot; revisit with
   `npm run db:perf-report` if that ever changes, not speculatively.

## What this session's XR queue (XR-1 through XR-21) actually did

Full stage-by-stage detail lives in `docs/AUTONOMOUS_BACKEND_PROGRESS.md`'s "XR queue" table —
not repeated here to avoid a second copy that can drift out of sync. Summary: protected-field
mutation matrix, `SECURITY DEFINER`/privilege-escalation and grant/Data-API exposure audits,
Storage path canonicalisation and signed-URL revocation safety, immutable history/evidence
preservation, transactional workflow boundaries, optimistic concurrency, idempotency key registry,
poison-job/backpressure/outbox audits (each confirmed not applicable — no job/worker/outbox system
exists), template revalidation, export object lifecycle (not applicable), anonymisation
consistency, legal-hold propagation, cursor stability, public contract drift scanner, fixture
determinism, schema/migration drift detection, query performance budget audit.

## Verification

This document is prose, not a script — it cites but does not replace the toolbelt above.
Regenerated the "current verified numbers" section fresh at `07e2e7d` via a clean `db:reset` +
2×`test:db` + `tsc` + `build` + `db:preflight`, all passing, immediately before writing this file.
