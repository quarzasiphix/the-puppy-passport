# Integration-ready handoff

Stage IR-18 — the final stage of the IR-1 through IR-18 integration-readiness queue. This is the
closeout report for that entire queue, not just this one stage. Every figure below was re-verified
fresh against the current commit as part of writing this report (a full clean reset, three
consecutive full test-suite runs, `tsc`, full-repo `lint`, `build`) — nothing here is carried over
from an earlier stage's own claim without re-checking it.

## Current state

- **HEAD**: `13b7d37`, branch `main`.
- **Migrations**: 128 files, zero duplicate prefixes, fresh `supabase db reset` (empty DB → all
  migrations → seed) completes cleanly.
- **Tests**: 816/816 passing in `tests/db/` (59 files), verified on 3 consecutive runs with no
  reset between runs 2 and 3.
- **TypeScript**: `npx tsc --noEmit` clean.
- **Lint**: `npx eslint .` (true full-repo, generated files excluded per Stage IR-16) — **21
  errors, 13 warnings**, all pre-existing formatting/lint debt in authored files, none new this
  session, none touching security/RLS/business-logic code.
- **Build**: `npm run build` succeeds (Cloudflare Worker `nitro` output). Not deployed.
- **RLS**: every table in `public` has row-level security enabled, and every RLS-enabled table has
  at least one policy (zero silently-inaccessible tables).
- **Grants**: all 77 `SECURITY DEFINER` functions in `public` have a pinned `search_path`; the one
  real grant gap found this queue (`has_role()`, Stage IR-13) is closed.
- **Storage**: 5 buckets (`kennel-media` public; `transport-documents`, `transport-evidence`,
  `message-attachments`, `welfare-case-documents` private), all re-audited this queue for the
  tamper-after-decision bug class (Stage IR-11/IR-17) — one real gap found and closed
  (`welfare-case-documents`), the other 4 confirmed already correct.
- **Worktree**: clean. `git status --short` is empty other than this report and the progress-log
  update being committed alongside it. The frozen frontend worktree
  (`ux-marketplace-frontend-pass` at `727d551`) was never entered or modified this queue.

## What the IR-1 through IR-18 queue did, stage by stage

| Stage | Outcome |
|---|---|
| IR-1 | Backend/frontend contract snapshot (`docs/BACKEND_API_CONTRACT_SNAPSHOT.md`) — found and fixed a real stub-staleness gap (2 RPCs missing from the hand-written types stub). |
| IR-2 | Server-side marketplace search — real server-side filtering/pagination added to `listPublishedPuppies()`, plus a real `!inner`-join correctness bug caught and fixed before committing. |
| IR-3 | Public read-model privacy — revalidation of Stage CJB's audit, no new gap. |
| IR-4 | Frozen frontend compatibility — read-only check, confirmed still compatible, no gap. |
| IR-5 | Generated type reconciliation — retired the 1760-line hand-written types stub for real `supabase gen types` output; fixed 37 real type errors this surfaced. |
| IR-6 | Complete product scenarios — found and closed a real, product-critical gap: nothing could ever actually create a `reservations` row (`convert_application_to_reservation()` RPC added). |
| IR-7 | Role/suspension matrix — closed a real coverage gap (moderator-role suspension was never tested). |
| IR-8 | Scheduling/capacity conflicts — a real, caught-before-commit false start (would have regressed a deliberate advisory-conflict design), reverted cleanly; confirmed already correct. |
| IR-9 | Document expiry jobs — closed a real gap: nothing stopped a customer accepting an already-expired quotation. |
| IR-10 | Outbox/notification soak — no real outbox exists in this app (confirmed again); closed a genuinely missing notification (moderation appeal decisions never notified the appellant). |
| IR-11 | Storage/signed URL security — closed a real tamper-after-decision gap for `welfare-case-documents` (table + Storage), matching the bug class Stage AP closed for `transport_documents`. |
| IR-12 | Representative volume/performance — closed a real N+1 in route matching (`suggestRoutesForRequest()`/`computeMatch()`), batching what used to be one capacity query per candidate route. |
| IR-13 | Migration rehearsal — closed a real information-disclosure gap (`has_role()` was probeable for any user's role by anyone); caught and corrected a mistake in the first draft of that exact fix by running the full suite before committing. |
| IR-14 | Frontend integration conflict map — a real `git merge-tree` trial merge found exactly 3 real conflicts, one hiding a genuine quotation-expiry UX regression risk if resolved carelessly. |
| IR-15 | Integration runbook — a concrete, not-executed merge plan built directly on IR-14's findings. |
| IR-16 | Release manifest — corrected a stale, never-re-verified full-repo lint baseline (claimed "38/13" since Stage K; the real figure, once generated files were correctly excluded, is 21/13) and fixed the underlying `eslint.config.js` gap. |
| IR-17 | Final backend PR review — targeted audit pass across security/races/idempotency/audit/Storage/errors/frontend-conflict; no new issue found beyond what IR-10 through IR-16 already fixed. |
| IR-18 | This report. |

**Real code/schema/config fixes**: IR-1, IR-2, IR-5, IR-6, IR-7, IR-9, IR-10, IR-11, IR-12, IR-13,
IR-16 (11 stages). **Confirmed-already-correct audits**: IR-3, IR-4, IR-8, IR-17 (4 stages).
**Documentation-only deliverables**: IR-14, IR-15, IR-18 (this report) (3 stages, though IR-16 also
belongs partly here — it produced a report *and* fixed a real config gap).

## Real product scenarios covered end-to-end this session (cumulative, not just this queue)

Breeder purchase (application → approval → reservation, closed at IR-6), foundation adoption,
private rehoming (moderated), rejection/cancellation, cross-tenant attack attempts (the whole
session's repeated self-approval-class fixes), moderation + appeal (including the appeal-decision
notification IR-10 added), welfare/rescue case intake through to transport conversion, and the full
transport request → quotation → acceptance → route assignment → delivery pipeline with its own
expiry/scheduling/document-review integrity fixes from earlier in this session.

## Known blockers / not this session's to resolve

- **No production Supabase project exists.** Everything verified above is against the local stack.
  See `docs/PRODUCTION_SETUP.md` for what standing one up requires.
- **No outbound email provider is integrated.** Confirmed correctly deferred, not something this
  session can build without real credentials it's explicitly barred from using.
- **The frontend integration itself is not done.** `docs/FRONTEND_INTEGRATION_CONFLICT_MAP.md` and
  `docs/FRONTEND_INTEGRATION_RUNBOOK.md` (IR-14/IR-15) are the plan; nothing has been merged.
- **`src/lib/supabase/types.ts` will need regenerating** after any future migration that changes
  the schema surface the app uses (standing note, unchanged since IR-5).
- **21 errors / 13 warnings of pre-existing lint debt** remain in authored files (listed in
  `docs/BACKEND_RELEASE_MANIFEST.md`), none touching security or business logic — a real,
  low-priority cleanup opportunity for whoever next works in those specific files, not a blocker.

## Next action

Per the standing instruction's own explicit precedence ("XR-1 through XR-24 starts only after
every earlier-assigned stage... then IR-1–IR-18... completes"), and this queue now being complete:
continue into **XR-1** (protected-field mutation matrix), the first stage of the XR-1 through XR-24
append-only queue.
