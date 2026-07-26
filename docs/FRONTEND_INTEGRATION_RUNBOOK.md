# Frontend integration runbook

Stage IR-15 (integration-readiness queue). A concrete, step-by-step plan for merging the frozen
`ux-marketplace-frontend-pass` branch into `main`, written against the real findings of
`docs/FRONTEND_INTEGRATION_CONFLICT_MAP.md` (Stage IR-14) — not a generic checklist. **This stage
documents the plan only. Nothing below has been executed.** No worktree was created, no branch was
merged, no writer was stopped, because none of that is this stage's job — it's the job of whoever
is explicitly asked to perform the real integration next, using this as the plan.

## 0. Preconditions

- Confirm no autonomous backend session (this one or another) is still writing to `main` —
  `git log -3 --oneline` should show a settled, expected HEAD with a clean `git status --short`.
  If a session is mid-stage, let it finish and commit first; never interrupt an in-progress commit.
- Confirm the frozen branch/worktree are still exactly what IR-14 analysed:
  `git rev-parse ux-marketplace-frontend-pass` should still be `727d551` (recorded in this
  session's own startup checks). If it's moved, IR-14's conflict map may be stale and should be
  re-run before trusting it.
- Decide who performs the integration interactively (this is not a fully-automated step — the
  3 real conflicts in IR-14's map need a human or an agent with full context making judgment
  calls, not a scripted merge).

## 1. Isolate the work: a new integration worktree, never `main` directly, never the frozen worktree

```bash
cd /p/the-puppy-passport
git fetch  # if a remote exists; harmless no-op otherwise
git worktree add ../the-puppy-passport-integration -b integration/marketplace-ux-merge main
cd ../the-puppy-passport-integration
```

Never run the merge directly on `main`, and never `git checkout`/edit anything inside the frozen
`ux-marketplace-frontend-pass` worktree — both standing rules from this whole session, unchanged
for integration. A dedicated worktree means an aborted or bad attempt costs nothing: delete the
worktree and branch, `main` and the frozen branch are untouched (see §7, Rollback).

## 2. Strategy: one real merge commit, not 52 individual cherry-picks

The frozen branch has 52 commits since the merge-base (`02e6416`); `main` has 217. `git
merge-tree`'s trial merge (IR-14) already proved there are only 3 real content conflicts across 75
changed files. **Recommendation: a single `git merge ux-marketplace-frontend-pass`**, not a
commit-by-commit cherry-pick — replaying 52 commits individually against an ever-shifting base
would re-surface (and require re-resolving) transient intermediate conflicts that the final state
never actually has, for no real benefit here: nothing in IR-14's map suggests any individual
frontend commit should be *excluded* rather than integrated as a whole.

```bash
git merge --no-commit --no-ff ux-marketplace-frontend-pass
```

`--no-commit` deliberately stops before finalising, so the 3 known conflicts (and anything else
that surfaces — `git merge-tree`'s trial merge is authoritative for content conflicts but doesn't
catch every category, e.g. two independently-valid changes that combine into something semantically
wrong without a textual clash) can be resolved and reviewed before a commit exists at all.

**If selective adoption ever *is* the goal** (e.g. only some of the 52 commits are wanted), the
ordered-cherry-pick alternative is: `git log --oneline --reverse 02e6416..ux-marketplace-frontend-pass`
for the full ordered commit list, then `git cherry-pick <hash>` one at a time, oldest first, in a
throwaway branch, resolving each commit's own conflicts as they arise. Not recommended as the
default path given IR-14's findings, but documented here since it was explicitly asked for.

## 3. Resolve the 3 real conflicts, using IR-14's map, not from scratch

- **`src/lib/queries/marketplace.ts`**: keep every function that exists only on `main`'s side.
  Adopt the frozen branch's `mapOrgToFoundation()`/`orgAvailableAdoptionCounts()` in full (nothing
  on `main` conflicts with them, they're pure additions). For the litter/breeder batching
  duplication, prefer the frozen branch's parameter-passing shape
  (`mapLitterRow(l, counts)`/`mapOrgToBreeder(o, breeds, count)`) since it's simpler and matches
  the same shape this backend session converged on independently for `computeMatch()` (Stage
  IR-12) — but confirm every real `main`-side caller of the old `mapLitterRow(l)`/
  `mapOrgToBreeder(o)` single-argument signatures is updated to pass the pre-computed value, not
  just the two batching entry points.
- **`src/lib/queries/buyer-activity.ts`**: adopt the frozen branch's
  `listFollowedBreeders()`/`listFollowedFoundations()` split wholesale — it's a strict improvement
  over `main`'s flat, foundation-unaware version, and depends only on conflict #1's resolution.
- **`src/routes/dashboard.buyer.quotations.tsx`**: take the frozen branch's version as the base
  (i18n, `formatDate`/`formatNumber`, shared `EmptyState`/`ErrorState`) and re-port `main`'s
  expiry gate into it: compute `isExpired = documentExpiryWarning(q.expiry_date) === "expired"`,
  conditionally render the `AlertDialogTrigger`/Accept button only when `!isExpired`, and swap the
  Decline button's label to a translated "Dismiss" string when expired (added to
  `src/lib/i18n/locales/en.json`/`pl.json` under the frozen branch's existing translation-key
  convention, not hardcoded). **Do not skip this** — the RLS layer (Stage IR-9) will reject an
  expired acceptance either way, but skipping it ships a real UX regression (a live-looking Accept
  button that always fails).

For anything that surfaces beyond these 3 (a real risk any trial merge tool can miss — see the
caveat in §2), stop and diff the specific hunk against both branches' full file history before
guessing which side is "newer" or "correct"; don't resolve conflicts by pattern-matching alone.

## 4. Regenerate everything generated, don't trust the merged version

- `src/routeTree.gen.ts`: **never hand-resolve conflicts in this file, and never trust an
  auto-merged version either** (IR-14 flagged this explicitly). After every other conflict is
  resolved, delete any leftover merge state in it and regenerate: `npm run dev` (a few seconds,
  then stop it) or `npm run build` both regenerate it from the real `src/routes/*.tsx` file set.
- `src/lib/supabase/types.ts`: the frozen branch never touched this file at all, and it predates
  Stage IR-5's real generated types (IR-14's most important non-conflict finding). Re-run
  `npm run db:types` against a fresh local `supabase db reset` regardless of whether it shows as
  "changed" — confirm it's identical to `main`'s pre-merge version (it should be, since the merge
  doesn't touch the schema), and separately budget time for `npx tsc --noEmit` to surface any
  frontend code that relied on the old widened-`string` stub typing (the same class of ~37 errors
  Stage IR-5 already fixed on `main`'s own side — see `docs/AUTONOMOUS_BACKEND_PROGRESS.md`'s
  IR-5 row for the fix pattern to reuse).

## 5. Test and build gates — every one must pass before this is considered mergeable

In order, in the integration worktree:

1. `npx supabase db reset` — confirm the schema/seed still apply cleanly (the merge doesn't touch
   `supabase/migrations/`, so this should be a no-op check, not an expected-to-fail step).
2. `npm run test:db` — the full backend DB/API suite, twice (no reset between), matching this
   session's own standing testing discipline. Must stay at the same pass count `main` had before
   the merge (816/816 as of Stage IR-14) — a lower count with no explanation is a blocker.
3. `npm run test:unit` (the frozen branch's own new script, covers `tests/unit/*.test.ts` — i18n
   completeness, org-routing, plural-category, presentation formatters, saved-animal
   classification) — new to this repo via the merge, run it for the first time here.
4. `npx tsc --noEmit` — must be clean. Per §4, budget real time for this, don't treat a first-pass
   failure as a blocker to abort on; it's the expected place to find and fix the types.ts drift.
5. `npx eslint .` — compare the resulting error/warning count against `main`'s pre-merge baseline
   (documented per-stage in `docs/AUTONOMOUS_BACKEND_PROGRESS.md`, e.g. "38-error/13-warning
   baseline first documented at Stage K"); a new baseline is acceptable but must be a deliberate,
   documented decision, not silently absorbed.
6. `npm run build` — the real Cloudflare Worker build (`nitro`/`vite build`) must succeed.
7. Only after 1-6 pass: commit the merge (`git commit`, using the default merge message or one
   describing the 3 manually-resolved conflicts), which finalises what `--no-commit` in §2 left
   open.

## 6. Browser QA — the golden paths this merge actually touches

Per CLAUDE.md's own standing rule ("start the dev server and use the feature in a browser before
reporting a UI-touching task complete"), and scoped to what IR-14 identified as genuinely at risk
(not a full regression sweep of all 75 files):

- `/find-a-dog`, `/breeders/:slug`, `/foundations/:slug` — the pages built on the reconciled
  `marketplace.ts`/`buyer-activity.ts` — confirm litter/breeder/foundation counts render correctly
  and match what the database actually has (not just "no console error").
- `dashboard/buyer/followed` and `dashboard/buyer/saved` — confirm a followed/saved foundation
  renders as a foundation, not mislabelled as a breeder (the exact bug the frozen branch's own
  commit `1444e35`/`851b216` describe fixing).
- `dashboard/buyer/quotations` — confirm the reconciled expiry gate: a quotation past its
  `expiry_date` shows the "expired" message, hides the Accept button, and labels the remaining
  button "Dismiss"; a non-expired quotation still shows a working Accept flow end-to-end (a real
  accept, not just a rendered button).
- One full pass through `i18n:check` (`npm run i18n:check`) plus manually toggling the language
  switcher (if the merged `__root.tsx` wires one in) across at least the pages above, confirming no
  raw translation keys leak into the rendered UI.

## 7. Rollback — non-destructive by construction

Because everything happens in a dedicated worktree on a dedicated branch (§1), rollback never
touches `main` or the frozen branch at any point before §5 step 7's final commit:

```bash
cd /p/the-puppy-passport
git worktree remove ../the-puppy-passport-integration --force   # only if step 5/6 fails badly
git branch -D integration/marketplace-ux-merge
```

If the merge commit from §5 step 7 was already made but a later problem surfaces (e.g. a browser
QA failure caught after committing), still don't touch `main` directly — the integration branch
holds the merge commit; fix forward on that branch, or discard the whole branch and worktree with
the same two commands above and start over from §1. `main` only ever receives this work via
whatever the team's normal path to `main` is (a reviewed PR, a fast-forward, etc.) — not specified
here, since that's a repository-policy decision outside this stage's scope, not a technical one.

## What this stage did not do

No worktree was created, no branch was merged, no test was run against merged code, no writer was
stopped. This is the plan for the next session/person who is explicitly asked to perform the real
integration — the same append-only, plan-not-execute boundary IR-15's own definition sets.
