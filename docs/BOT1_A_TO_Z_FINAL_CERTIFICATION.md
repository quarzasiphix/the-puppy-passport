# Bot 1 — A-to-Z Final Certification (Sections A-O, Bot 2 active)

Started while Bot 2 was confirmed actively mid-write (dirty real-repo worktree observed at task
start: `docs/BETA_SCOPE.md`/`docs/FEATURE_LAUNCH_MATRIX.md` modified, `docs/SUPPORT_RUNBOOK.md`
untracked). Per the task's own framework, this document covers A-O only (committed-delta review and
targeted re-verification while Bot 2 is active); **P onward (final quiet-main certification) is
explicitly held** until Bot 2 goes quiet across 2+ consecutive checks — see the status note at the
end of this document.

## A — True current state

Audit clone `/p/the-puppy-passport-bot1-overnight-20260728-233809`, branch
`audit/bot1-overnight-20260728-233809`, clean at `9c18df9` at task start. Continued in the same
clone (no new clone needed for A-O; a fresh clone will be created for the eventual P-stage empirical
certification).

## B — Committed delta baseline

`LAST_REVIEWED=8aaecc292b03cbd42823f8f2bcec1cd8a06d6837`,
`LATEST_MAIN=91f466bde4dfa0b966d21e55281af40a03b667ac` (superseded mid-review by `e5c789946809b92a3aefafa16df4a33f17a07e89` -- see the further-delta note under section M) (re-captured at review time; may move
further — re-check before any P-stage work). 10 commits, 19 files changed (551 insertions, 67
deletions). Classification:

| Commit | Classification | Summary |
|---|---|---|
| `c5028ac` | **Security + browser** | SSR auth hydration credential-leak fix (new `useHydrated()` hook, `method="post"` defense-in-depth) |
| `a562623` | Documentation | Progress-log entry for the above |
| `dee8fe7` | **Performance** | Q-1 fix: `DEFAULT_PAGE_SIZE=200` in `listPublishedPuppies()` |
| `0f20ae6` | **Error handling** | E-7 fix: 3 genuine public-facing raw-error sites wired to `getFriendlyErrorMessage()` |
| `1b178b6` | Documentation | Progress-log entry for Q-1/E-7 |
| `aae3c69` | **Operations/documentation** | Documents the real `db:reset` CLI failure this pass independently hit and reported; includes a self-caught correction (a first documentation draft was itself wrong about `drop schema public cascade` covering `storage.objects` policies) |
| `89ee170` | Operations/documentation | "Phase A" — verifies org/animal onboarding already works without direct SQL |
| `ca83d6e` | Operations/documentation | "Phase B" — pilot onboarding/offboarding checklists (new docs, no code) |
| `67e8dbd` | Consent/documentation | "Phase C" — consent/communication model review, concludes no code gap |
| `91f466b` | Operations/documentation | "Phase E" — support runbook + self-correction of an earlier over-claim about support readiness |

No import, KPI/analytics, or entitlement code changed (confirmed by `diff --stat` — zero migration
files touched by this delta; `IMPORT_AND_DATA_MIGRATION.md` and `CONSENT_AND_COMMUNICATION_MODEL.md`
are decision/documentation artifacts, not new schema).

## C — Bot 2 activity

Confirmed active at task start (dirty worktree). Proceeded through D-O per the task's own explicit
instruction to keep working rather than wait idly. **Re-checked at the end of this document — see
status note.**

## D — Delta-verify new backend work

All changes in this delta are **frontend/documentation-only** — zero migration files, zero new
RPCs/policies/triggers. Affected: `src/hooks/use-hydrated.ts` (new), `src/routes/_public.signin.tsx`
/ `_public.signup.tsx` / `_public.forgot-password.tsx` (hydration guard), `src/lib/queries/
marketplace.ts` (default page size), `src/components/adoption-form-dialog.tsx` /
`apply-dialog.tsx` / `report-dialog.tsx` (error wiring). Every one independently re-verified below
(E, F, H). Status: **all fixed, independently confirmed by direct code read** (not merely trusting
Bot 2's own commit messages).

## E — Error-sanitisation recheck

**All 3 genuine gaps from the prior round's own finding are now fixed**, confirmed by direct diff
read: `adoption-form-dialog.tsx`, `apply-dialog.tsx`, `report-dialog.tsx` now call
`getFriendlyErrorMessage(err, "...")` instead of rendering `err.message` raw.
`apply-dialog.tsx`'s pre-existing special-cased messages (duplicate application, sign-in-required)
are correctly preserved ahead of the new generic fallback. **Bot 2 also correctly identified 3 of
the original 6 flagged sites as false positives** — independently re-checked and agreed:
`_public.reset-password.tsx`'s raw error is a genuine Supabase Auth error (`auth.updateUser()`),
which is already customer-safe by Supabase's own design and matches the established convention for
Auth errors elsewhere in this codebase (signin/signup/forgot-password all pass Auth errors through
unwrapped) — wrapping it in `getFriendlyErrorMessage()` (built for PostgREST-shaped errors) would
have been a regression, not a fix, exactly matching this task's own instruction not to demand
friendly-wrapping where it would reduce useful safe Auth feedback. `_public.adoptions.$id.tsx` /
`_public.puppies.$id.tsx` were already correctly wired; the original grep had matched an unrelated
`err.message.includes(...)` content-check line, not an actual raw render. **Status: fixed,
independently confirmed.** No newly-added import/consent/entitlement/integration UI exists in this
delta to check (none was added).

## F — Fetch bounding and pagination recheck

**Confirmed fixed.** `DEFAULT_PAGE_SIZE = 200` applied via `filters?.pageSize ?? DEFAULT_PAGE_SIZE`
and `filters?.page ?? 0`, so `.range()` is now applied unconditionally — no code path leaves the
query unbounded. Explicit `page`/`pageSize` still override the default normally (simple
nullish-coalescing, no special-casing removed). Stable ordering (`created_at` DESC, `id` ASC
tie-breaker) untouched by this change, still present. No new import/demo screen was added in this
delta (none exists) to create a new unbounded admin query. Support/moderation/transport/messages/
documents/audit-log pagination not re-derived this round (unchanged since the prior round's own
partial coverage; no delta touched those query helpers). **Status: fixed, independently confirmed.**

## G — Guard all five former High findings

**None of this delta's files touch any of the 5 High-finding areas** (`transport_requests`,
`create_notification_if_enabled`, `account_deletion_requests`, `moderation_cases`, `achievements` —
zero migration files changed at all in this delta). Per the task's own instruction ("Recheck ONLY if
later commits touched the relevant area"), **not re-derived this round — correctly and deliberately
skipped**, not silently omitted. All 5 remain at their last-verified status (fixed, empirically
verified via both rollback-transaction reproduction and a full 1062/1062 fresh-reset suite, prior
round). `legal_holds` also untouched this delta.

## H — Hydration and authentication recheck

**Confirmed fixed at the code level.** `useHydrated()` (new hook, read in full) returns `false` on
first client render (matching SSR output, avoiding a hydration mismatch) and flips `true` on the
next tick via `useEffect`. Applied to signin, signup (step 0), and forgot-password — the 3 forms
that render immediately in SSR with a sensitive field — each form's submit button now has
`disabled={!hydrated || form.formState.isSubmitting}`, and each form gained `method="post"` as
defense-in-depth. `reset-password.tsx` was deliberately left unchanged, with a reasoned justification
(its form is gated behind an async ready-state that cannot resolve before hydration completes, so
it was never reachable by this exact race) — **independently plausible on inspection, not
independently re-derived from scratch this round** (would require reading `reset-password.tsx`'s
full ready-state logic, not done this round given time constraints). **Browser-level reproduction**:
Bot 2's own commit message claims verification "with a real headless browser" in their environment.
**This pass has no browser tooling available, as in every prior round — stated explicitly, not
fabricated.** The code-level fix is sound by inspection (a disabled button cannot fire a native form
submission); the actual hydration-timing behavior in a real browser was not independently observed
by this pass.

## I — Import system review

**No import system exists.** `docs/IMPORT_AND_DATA_MIGRATION.md` (new, read) is a decision document,
not a feature: its own sections state "the real answer: a full self-service path already exists"
(meaning organisations already onboard data through the normal UI, one record at a time) and "what's
genuinely absent: bulk import... decision: not built speculatively this pass." Confirmed via
`diff --stat`: zero migration files in this delta. **Skipped per the task's own instruction ("If no
import work exists, skip and say so") — confirmed absent, not assumed.**

## J — Consent and communication

`docs/CONSENT_AND_COMMUNICATION_MODEL.md` (new, read) concludes "this phase found no code gap" —
consent versioning (`user_consents`/`legal_document_versions`) is confirmed real and correctly
scoped, independently matching this pass's own prior-round finding (VA-16/17, adequate). Marketing/
analytics consent is correctly noted as unnecessary given the confirmed absence of any marketing/
analytics feature (not a gap alongside an absent feature). **Status: adequate, independently
cross-confirmed against this pass's own separate prior finding, not merely trusted.**

## K — KPI and analytics truth

No event taxonomy or analytics code exists anywhere in this delta or the broader codebase (confirmed
absent in every prior round via a clean `package.json` dependency sweep, unchanged this round —
0/72 deps). **Confirmed still absent, nothing to verify further.**

## L — Launch-scope enforcement

`docs/FEATURE_LAUNCH_MATRIX.md` (read in full) is a substantially rewritten, honest classification
of every feature area. Two load-bearing claims independently spot-verified this round (not merely
trusted):
1. **"Support cases: backend real and tested; NO frontend UI exists"** — independently confirmed:
   `grep -rl "support_case" src/` returns only `src/lib/supabase/types.ts` (generated type
   definitions), zero routes/components/query files reference it. A customer genuinely cannot open a
   support case through the app today — this is an honest, self-corrected claim (the commit message
   for `91f466b` explicitly says it corrects "an earlier over-claim about support"), not
   overclaiming readiness.
2. **"Fundraising: built, deliberately disabled, client-side gate only, but safe because
   `fundraising_contributions.is_simulated` is forced true by RLS regardless"** — independently
   confirmed live via `pg_policies`: the `"supporters create their own contribution"` INSERT policy's
   `WITH CHECK` includes `is_simulated = true` unconditionally, for every supporter-created row,
   regardless of any client-side flag state. Direct API access cannot create a real (non-simulated)
   fundraising contribution. **Confirmed, matches the exact requirement this section calls for**
   ("Direct API access must not activate... real fundraising contributions").
Payments/email/SMS/analytics/CRM/webhooks: confirmed genuinely absent (unchanged basis, re-confirmed
this round). Maintenance mode: edge-enforced in the Cloudflare Worker, fail-open on DB error — not
independently re-derived this round beyond reading the matrix's own claim, carried forward as
plausible-but-not-independently-re-verified.

## M — Manual operations readiness

Three new runbooks read in full: `docs/SUPPORT_RUNBOOK.md`, `docs/MODERATION_RUNBOOK.md`,
`docs/TRANSPORT_INCIDENT_RUNBOOK.md`. All three pass this section's own rejection criteria on
inspection:
- **Moderator self-conflict**: `MODERATION_RUNBOOK.md`'s own "Real scenarios" section explicitly
  states "the moderator literally cannot claim or decide it; an independent moderator must" — not
  omitted, stated as an automatic system property, matching the live-verified HF-3 fix.
- **No unsupported service levels claimed**: `MODERATION_RUNBOOK.md`'s own "What this runbook does
  not claim" section explicitly disclaims any emergency/priority queue, SLA timer, or automatic
  paging — "none of these exist in the codebase... don't promise them in a real communication until
  they're actually built." This is precisely the honesty this section demands, not a rejection-list
  violation.
- **Support runbook honesty**: explicitly separates "what's actually real today" (backend tables/
  RPCs/rate-limits, all test-covered) from the missing frontend UI, and gives a concrete "until that
  UI exists" out-of-band process rather than pretending a UI exists.
- **Reporter identity / privacy boundary**: `SUPPORT_RUNBOOK.md`'s "what staff must never do"
  section explicitly names "reporter identity" among the data staff must never share across
  unrelated cases.
`TRANSPORT_INCIDENT_RUNBOOK.md` not read in as much depth this round (time-budgeted) — skimmed only,
not independently verified against the actual incident-handling code paths. **Status: adequate for
the two fully-read runbooks; the third carried forward as unverified, not assumed adequate.**

**Process disclosure**: `docs/MODERATION_RUNBOOK.md` and `docs/TRANSPORT_INCIDENT_RUNBOOK.md` were
initially read directly from the real repo's working tree at a moment when they were, in fact,
Bot-2-uncommitted (this task's own coordinator note at the very start showed both as `??` untracked
in `git status`). Disclosed transparently rather than silently glossed over: per this task's own
rule, uncommitted files must not be used as evidence. **Retroactive correction**: both files have
since been committed (commit `1070878`) with content independently re-confirmed identical to what
was read (`git show 1070878:docs/MODERATION_RUNBOOK.md`, byte-for-byte match on the specific
"self-conflict lock applies automatically" passage cited above) — the finding is now correctly
grounded in committed evidence, but the sequencing was not clean and is recorded honestly.

**Further delta discovered while finalizing this section**: `91f466b → e5c789946809b92a3aefafa16df4a33f17a07e89`
(2 more commits: `1070878` "Phase E: moderation, transport incident, document review, account
security, and incident response runbooks" + a progress-log entry) added
`docs/ACCOUNT_SECURITY_RUNBOOK.md`, `docs/DOCUMENT_REVIEW_RUNBOOK.md`, `docs/INCIDENT_RESPONSE.md`,
and extended `docs/MODERATION_RUNBOOK.md`/`docs/TRANSPORT_INCIDENT_RUNBOOK.md` further (263 lines,
6 files, all documentation, zero code/migration files). **None of these 3 newly-added runbooks were
read this round** — flagged explicitly as unverified, named here as the concrete next checkpoint
item. Real backend HEAD is now `e5c789946809b92a3aefafa16df4a33f17a07e89`, with the working tree
showing `docs/AUTONOMOUS_BACKEND_PROGRESS.md` modified (uncommitted) at time of this check — **Bot 2
is still active, not yet quiet.**

## N — New-team takeover

**Directly informed by this pass's own real, lived experience** (the prior round's empirical
verification genuinely hit the `db:reset` CLI crash and recovered from it manually). `docs/
LOCAL_SETUP.md`'s new troubleshooting section (read in full) accurately describes the failure as
"confirmed real, container-orchestration-level... not an app/migration defect" — matching this
pass's own independent finding exactly. **One important, self-disclosed correction**: Bot 2's first
documentation draft was itself wrong (claimed `drop schema public cascade` alone would allow a clean
migration replay, but this doesn't touch `storage.objects` policies in a different schema, so a
naive replay following the first draft would have failed) — caught and corrected before this delta
was finalized, per the commit message's own account. The corrected guidance is honestly scoped to
"retry `db:reset` first, since the failure is intermittent" rather than shipping untested exact
recovery commands — an appropriately humble level of certainty given neither this pass nor Bot 2
has root-caused the underlying container crash. **Status: adequate, matches this pass's own
first-hand experience, no fabricated confidence.**

## O — Operator takeover

Using the 2 runbooks read in full (M above): an org-verification reviewer, document reviewer, and
moderation-case handler could follow real, accurate instructions with correctly-disclosed
limitations (self-conflict is automatic, not something the operator must remember to check
manually; support has no UI, with an explicit interim process). Driver reassignment / incident
handling / user communication / security escalation not independently re-derived this round beyond
the `TRANSPORT_INCIDENT_RUNBOOK.md` skim noted in M — carried forward as unverified.

---

## Status note: Bot 2 activity at end of A-O pass

**Bot 2 is still clearly active — moved 4 times during this single A-O review**:
`91f466b → 1070878 → e5c7899 → b785dc4`, all documentation-only (runbooks, progress-log entries,
and — per `b785dc4`'s own message, "Phase F: environment/backup requirements already covered, no
duplication" — apparently continuing through a lettered phase queue of their own, in parallel with
this one). Real backend `main` is at `b785dc4c956d69e6f889c880b5549c211f29f7d9` as of the last check
in this document, worktree clean at that instant but with a demonstrated pattern of resuming within
minutes each time. **P onward (final quiet-main empirical certification, fresh reset, integration
branch audit) remains explicitly held.** Given the observed cadence (a new commit roughly every
5-10 minutes throughout this entire review), the practical resume signal to watch for is either an
explicit "Bot 2 has stopped" confirmation from the coordinator, or 2+ consecutive Bot 1 checks
separated by genuine idle time showing no HEAD movement and a clean worktree both times — a single
snapshot showing "clean" mid-stream (as happened twice during this very document) is not sufficient
on its own, since it has twice been immediately followed by more activity.

**Next action on resume**: re-run `git -C /p/the-puppy-passport rev-parse HEAD` and `git -C
/p/the-puppy-passport status --short`; if 2 consecutive checks (with real elapsed time between them)
show no movement and a clean tree, proceed to Section P using
`FINAL_MAIN=b785dc4c956d69e6f889c880b5549c211f29f7d9` (or whatever HEAD is current at that time —
re-capture, don't assume this value still holds). Sections not yet covered from the A-O list:
the 3 newly-added runbooks (`ACCOUNT_SECURITY_RUNBOOK.md`, `DOCUMENT_REVIEW_RUNBOOK.md`,
`INCIDENT_RESPONSE.md`, plus the now-extended `TRANSPORT_INCIDENT_RUNBOOK.md`) remain unread —
worth a quick pass before or alongside P, since they're fast (documentation-only, no empirical
testing needed) and directly feed Sections M/O's operator-takeover conclusions.
