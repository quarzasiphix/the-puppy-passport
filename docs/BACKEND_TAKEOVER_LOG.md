# Backend Takeover Log

Recorded at the start of a dedicated main-worktree backend session, taking over from a previous
Claude session that had already started transport-domain-hardening work in this same worktree
(not a separate branch — all uncommitted work below was sitting directly on `main`).

## Starting state

- **Branch**: `main`, 21 commits ahead of `origin/main` (not pushed).
- **Starting HEAD**: `c0851cf` — "Document rate-limiting/abuse-protection gap found during
  launch-hardening audit."
- **Working tree**: not clean. See below.

## Uncommitted files found

| File | Classification |
|---|---|
| `supabase/seed.sql` (modified, +36 lines) | Completed but uncommitted — adds `transport_request_animals`/`transport_parties` seed rows mirroring the new migrations' backfill, so local dev/tests see the same shape an upgraded real database would. |
| `supabase/migrations/20260101006500_transport_request_animals.sql` (new, 96 lines) | Completed but uncommitted — new `transport_request_animals` table, RLS, lossless backfill from existing inline columns. |
| `supabase/migrations/20260101006600_transport_parties_backfill_and_hardening.sql` (new, 82 lines) | Completed but uncommitted — backfills the previously-zero-row `transport_parties` table from legacy inline columns, tightens 3 real integrity gaps (empty-row check, external-contact-needs-name check, one-row-per-role uniqueness), adds org visibility parity policy. |
| `supabase/migrations/20260101006700_create_transport_draft_rpc.sql` (new, 204 lines) | Completed but uncommitted — `create_transport_draft()` SECURITY DEFINER RPC, the single atomic creation path for a transport draft + its animals + its parties. |
| `docs/adr/TRANSPORT_DATA_MODEL.md` (new, 213 lines) | Completed — a real ADR, verified against actual code (not assumed from older docs). Documents the audit (Phase 1) and the selected hybrid architecture (Phase 2 in progress). |

No accidental generated noise, no conflicting/broken work, nothing unknown. All five files form one
coherent, already-well-reasoned unit of work: the Phase 1 audit is complete and correct, and Phase 2
(schema) is **partially** implemented.

## What was already completed by the previous session

- Full Phase 1 audit of the transport data model (`docs/adr/TRANSPORT_DATA_MODEL.md`), verified
  against real code, not stale docs.
- Selected architecture: hybrid canonical + booking-time snapshot + new side tables for
  multi-animal and multi-party representation (Option 3 in the ADR).
- `transport_request_animals` table, RLS, backfill.
- `transport_parties` backfill from legacy inline columns + 3 integrity fixes + org-visibility
  policy.
- `create_transport_draft()` atomic creation RPC (request + animals + parties in one transaction,
  with the "requester can't forge another user as legal_owner/sender/payer" check baked in).
- Seed data extended to match.

## What remained unfinished (per the ADR's own section 3 and 5)

The ADR explicitly describes these as part of the selected model but they are **not yet built**
(confirmed by `grep -rl "transport_request_amendments\|request_transport_amendment\|
review_transport_amendment\|driver_transport_job_view" supabase/migrations/ src/` — zero hits):

- **Booking-time snapshot lock trigger** — the ADR says post-draft snapshot columns become
  "read-only to the requester," mirroring the existing `20260101006000_lock_transport_request_
  operational_fields.sql` pattern. Not yet implemented.
- **`transport_request_amendments` table + `request_transport_amendment()` /
  `review_transport_amendment()` RPCs** — the customer-facing path to propose a change after the
  snapshot locks. Not yet implemented.
- **`driver_transport_job_view`** — column-minimized view for driver access, formalizing the
  application-level minimization that today only exists in `src/lib/queries/driver.ts`. Not yet
  implemented.
- **No `src/` wiring at all** — confirmed via `grep -rn "transport_parties\|transport_request_
  animals\|create_transport_draft" src/`: zero references. Phase 3 (API/query layer) and Phase 5
  (UI wiring) have not started.

This session resumes from finishing Phase 2 (the lock trigger + amendment workflow + driver view),
then proceeds into Phase 3.

## Baseline checks (this session, before any new changes)

- `npx supabase db reset` — clean, all 70 migrations (66 prior + the 3 uncommitted transport ones)
  applied without error, seed loaded without error.
- `npm run test:db` — **124/124 passing**, confirmed on two consecutive runs without an
  intervening reset (repeatability check). Two earlier runs immediately after `db start`/`db reset`
  showed transient failures (`Invalid login credentials`, `PGRST002 Could not query the database
  for the schema cache`) — this is PostgREST/GoTrue warm-up flakiness immediately after a fresh
  reset, not a real regression; a plain `curl` health check and a short wait resolved it, and the
  suite has been green on every run since.
- `npx tsc --noEmit` — clean, zero errors.
- No build run yet at this checkpoint (deferred to after Phase 2 schema work lands, per the
  existing `npm run build` cost/benefit already established in prior sessions).

## Risks identified

- The three uncommitted migrations and the ADR are good work but were sitting uncommitted on
  `main` with no commit boundary — if this session's environment had been lost before takeover,
  it would have been lost too. First action after finishing Phase 2 is a real commit.
- `create_transport_draft()` is unused by any caller yet (correctly documented as a non-goal in
  the ADR — "no UI wiring for the four Phase-5 entry points" is explicit, not an oversight).
- The amendment workflow and snapshot lock are the actual reason Phase 2 isn't done: without the
  lock trigger, `create_transport_draft()`'s snapshot guarantee ("what was true when the customer
  submitted") is not yet enforced after submission — a gap worth closing before building Phase 3's
  mutation RPCs on top of it.

## Concurrent-write collision found mid-session (important)

While finishing Phase 2 (the snapshot lock + amendment workflow), two new untracked migrations
appeared in this same working directory that this session did not create:
`20260101006800_transport_request_animals_grants.sql` and
`20260101006900_transport_amendment_workflow.sql`. Their content is a near-duplicate of the
snapshot-lock-trigger-plus-amendment-workflow migration this session had just written independently
— same table (`transport_request_amendments`), same two RPCs
(`request_transport_amendment`/`review_transport_amendment`), functionally equivalent design,
different naming. **This means another agent process was concurrently writing to this exact same
main worktree at the same time as this session**, not merely leftover state from a prior session —
timestamps and the sequence of `git status` checks confirm the files appeared mid-session, after
Phase 0's initial inventory had already recorded a clean list of 5 uncommitted files.

Resolution taken: rather than overwrite either side, this session's duplicate
(`20260101006800_transport_snapshot_lock_and_amendments.sql`) was deleted in favour of the other
session's version, which had already been validated against a real local database and had caught a
real bug this session's version had not yet found (a missing `GRANT` on
`transport_request_animals` — `20260101006800_transport_request_animals_grants.sql`, matching the
same `auto_expose_new_tables=false` gotcha documented in `20260101002900_table_grants.sql`). This
session's one genuinely non-overlapping addition — a row-level lock on `transport_request_animals`/
`transport_parties` after a request leaves `draft` (the other session's migration only locks
`transport_requests`' own columns, not the side tables) — was kept and renumbered to
`20260101007000_transport_animal_and_party_lock_after_draft.sql` to avoid a filename-prefix
collision (Supabase's `schema_migrations` tracks only the numeric timestamp prefix as the version
key, not the full filename — two files sharing a prefix fail `db reset` with a duplicate-key error,
which is how the collision was first detected). The documents-party-link migration was renumbered
from `20260101006900` to `20260101007100` for the same reason.

**Flagging this to the user/orchestrator**: if another Claude session is intentionally also active
on this main worktree (not the separate `ux-marketplace-frontend-pass` branch this prompt
explicitly excludes), both sessions doing independent schema design work on the same tables risks a
future, harder-to-reconcile collision than this one (which resolved cleanly only because the two
designs happened to be compatible in scope). This session will keep checking `git status` for
unexpected new files before every migration write going forward, and will prefer building on
whatever the other session has already landed over re-deriving it independently.
