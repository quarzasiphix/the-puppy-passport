# Backend Takeover Log

> **Session progress checkpoint** (appended at the end of this session's active work, not a full
> `docs/BACKEND_FINALISATION_REPORT.md` — the phase queue this session was given runs to Phase 25,
> and this session completed a meaningful slice of it, not all of it). See the end of this file for
> what was actually finished, what remains, and recommended next steps.


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

**Update, later in the session**: the collision recurred twice more in milder forms — a committed
migration file was briefly deleted from the working tree by the other process (restored via `git
checkout -- <path>`, nothing was lost since it was already in `git log`), and `src/lib/queries/
transport.ts`/`src/lib/supabase/types.ts` were both independently extended by the other session
while this session was also mid-edit on them (their Phase 5/6 integration-entry-point functions and
`driver_transport_job_view` stub landed interleaved with this session's Phase 3/4 additions). Both
were reconciled without data loss by re-checking `git status`/`tsc --noEmit` before every commit and
fixing the handful of resulting type mismatches (a `Tables` vs `Views` type-path bug, a couple of
missing `animals` columns in the hand-written stub) rather than reverting either side's work.

## What this session actually completed (commits `69c25d7`..`f113a43`)

- **Phase 2 (schema), finished**: booking-time snapshot lock trigger on `transport_requests`
  (landed by the other process as `20260101006900_transport_amendment_workflow.sql`) plus this
  session's own row-level lock on `transport_request_animals`/`transport_parties`
  (`20260101007000`), the amendment workflow table/RPCs, and a `transport_documents.
  transport_party_id` link (`20260101007100`).
- **Phase 3/4 (API + regression suite)**: `createTransportDraft()` and the full draft/amendment
  query layer in `src/lib/queries/transport.ts`; two real bugs found and fixed while building
  it — `create_transport_draft()` had no check that a caller had any legitimate connection to an
  `animal_id` they attached (exploitable via `listTransportRequestsForKennel()` spoofing a fake
  request onto an unrelated org's dashboard — fixed in `20260101007200`), and
  `request_transport_amendment()` never checked the request's status, allowing amendments on a
  still-draft or already-final request (fixed in `20260101007400`). New test file
  `tests/db/transport-domain.test.ts` plus additions to `tests/db/access-control.test.ts`.
- **Phase 7 (ops workspace)**: the ops transport-request detail page
  (`src/routes/dashboard.operations.requests.$id.tsx`) now shows parties, a multi-animal list,
  exact addresses, and pending amendments with inline approve/reject — none of which existed on
  that page despite the underlying data being real.
- **Phase 8 (driver workspace)**: `driver_transport_job_view` (landed by the other process,
  `20260101007300`) is now actually used by `src/lib/queries/driver.ts` instead of a hand-picked
  `transport_requests` select that never included the exact address or pickup/delivery contact a
  driver needs to do the physical job — a real functional gap, not just a hardening nicety. Added
  direct RLS test coverage for the view itself, which had none.
- **Phase 9 (documents)**: `transport_documents.file_url` was a user-typed URL text box with zero
  real Storage upload anywhere in the app (confirmed via `grep -rln "storage.*upload" src/`
  returning nothing before this). Now a real file upload to the private `transport-documents`
  bucket, with signed-URL viewing (5-minute expiry, generated on click, never persisted as a bare
  link) — the app's first real file-upload flow.
- **Phase 6 (integration contract)**: `docs/TRANSPORT_INTEGRATION_CONTRACT.md`, documenting the
  four draft-creation entry points (standalone, marketplace purchase, foundation adoption, private
  rehoming) for whichever future session wires UI buttons to them.

**Verified at the end of this session**: clean `supabase db reset` (77 migrations), 170/170
database/API tests passing on two consecutive runs without an intervening reset, `tsc --noEmit`
clean, `eslint` clean on every changed file, `npm run build` succeeds. UI changes (the ops detail
page, the driver route, the document checklist) are typecheck/build-verified only, **not
browser-verified** — headless Chromium cannot launch in this sandbox (missing
`libglib-2.0.so.0`), the same gap `docs/E2E_TESTING.md` already documents. This should be a real
browser smoke-test the next time this runs somewhere with working headless Chromium, per
`CLAUDE.md`'s own UI-testing rule.

## What remains (Phases 10–25 of the original queue, not started this session)

Operations calendar/scheduling, the customer-facing status timeline, foundation urgent-welfare
workflow, foundation team/volunteer management, the full adoption questionnaire, moderation
appeals, notification preferences, admin placeholder audit, rate-limiting/abuse-protection
implementation (only documented so far, in `docs/RATE_LIMITING_AND_ABUSE_PROTECTION.md` from an
earlier session), CI expansion, a broader database consistency audit beyond the transport domain,
end-to-end scenario tests, a performance pass, the GDPR/privacy audit, and the final launch-blocker
reconciliation — none of these were started this session. A consistency self-check limited to this
session's own new migrations (RLS enabled, grants present, `search_path` pinned on every new
`SECURITY DEFINER` function) found no gaps, but that is not the same as the full Phase 20 database
audit the original queue asked for.

## Recommended next steps

1. Run a real browser smoke test of the three UI surfaces this session touched, somewhere headless
   Chromium actually works.
2. Continue the phase queue from Phase 10 (operations calendar) — the transport data model is now
   stable enough to build scheduling/calendar views on top of without it shifting under them.
3. Coordinate explicitly with whatever session is also active on this worktree before the next
   round of schema work — the collisions this session hit were all resolved safely, but only
   because the two designs happened to be compatible; that won't always be true.
