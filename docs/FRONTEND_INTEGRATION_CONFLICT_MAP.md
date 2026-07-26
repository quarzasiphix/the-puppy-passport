# Frontend integration conflict map

Stage IR-14 (integration-readiness queue). Read-only comparison of `main` (this backend session)
against the frozen `ux-marketplace-frontend-pass` branch, both diverged from their common ancestor
`02e6416` (merge-base). Produced entirely with `git diff`/`git merge-tree`/`git cat-file`/
`git merge-file` against a scratch directory outside the repo — **the frozen branch and worktree
were never entered, checked out, or modified**, per the standing rule. `git merge-tree --write-tree`
(a hypothetical, in-memory-only merge computation that touches neither the working tree nor the
index) is the authoritative source for every "conflict" claim below — this is not a guess based on
diff stats, it's a real trial merge.

**This is a map for whoever does the actual integration next, not an integration itself. Nothing
here was merged, cherry-picked, or pushed.**

## Bottom line

`git merge-tree --write-tree main ux-marketplace-frontend-pass` reports **3 real content
conflicts** out of 75 changed files, all inside `src/lib/queries/marketplace.ts`,
`src/lib/queries/buyer-activity.ts`, and `src/routes/dashboard.buyer.quotations.tsx`. Everything
else — including several files both branches touched (`package.json`, `src/lib/queries/profile.ts`,
`src/routeTree.gen.ts`, `src/routes/_public.planned-routes.tsx`,
`src/routes/_public.transport.index.tsx`, `src/routes/dashboard.buyer.transport.tsx`) — auto-merges
cleanly at the text level. One of the three real conflicts hides a genuine regression risk if
resolved carelessly (see `dashboard.buyer.quotations.tsx` below) — not just a textual clash.

## The 3 real conflicts

### 1. `src/lib/queries/marketplace.ts` — same N+1 bug, fixed independently on both sides

Both sessions found and fixed the identical "per-row query" N+1 pattern for litters and breeders on
marketplace listing pages, with different shapes:

- **`main`**: `countAnimalsByStatusForLitters()`/`mapLitterRows()` and
  `orgBreedsAndCountsBatch()`/`mapOrgsToBreeders()` — batched counterparts alongside the original
  per-row `mapLitterRow(l)`/`mapOrgToBreeder(o)` (which still do their own 1-2 queries each, used
  by single-item detail pages).
- **Frozen frontend**: restructured `mapLitterRow(l, counts)`/`mapOrgToBreeder(o, breeds, count)`
  to take pre-computed values as parameters (no longer async-querying themselves at all), with a
  separate `litterCountsBatch()`/`orgBreedsBatch()`+`orgAvailablePuppyCounts()` always computing
  the batch first — the exact same "pass the pre-computed value in, don't have the mapper query
  itself" shape this same backend session used again for `computeMatch()` in Stage IR-12's own N+1
  fix, coincidentally.
- The frozen branch also adds real, backend-facing additions to this same file with **no
  equivalent on `main` at all**: `mapOrgToFoundation()`, `orgAvailableAdoptionCounts()` (used by
  the frozen branch's foundation-specific pages), confirmed via `grep` — `main`'s `marketplace.ts`
  has zero mention of either name.

**Recommended resolution**: this is not a "pick one side" conflict. Whoever integrates needs to
carry `main`'s functions forward (nothing on `main`'s side is stale or wrong) while deciding
whether to adopt the frozen branch's parameter-passing shape for `mapLitterRow`/`mapOrgToBreeder`
(cleaner, and consistent with `computeMatch`'s later shape) or keep `main`'s dual sync/batched pair
— and either way, the frozen branch's `mapOrgToFoundation`/`orgAvailableAdoptionCounts` need to be
carried into whichever final version wins, since real frontend pages depend on them.

### 2. `src/lib/queries/buyer-activity.ts` — downstream of the marketplace.ts conflict

`listFollowedOrgRows()`'s caller changed on both sides: `main` still returns a flat list mapped
through `mapOrgsToBreeders()` unconditionally (pre-dates any foundation-following distinction);
the frozen branch splits it into `listFollowedBreeders()` (kennels only) and
`listFollowedFoundations()` (using the new `mapOrgToFoundation`/`orgAvailableAdoptionCounts` from
conflict #1), matching a real product need documented in the frozen branch's own comment: "a
followed foundation doesn't render mislabelled as a breeder." **Resolution is downstream of #1** —
once `marketplace.ts` is reconciled, this file's conflict resolves by simply adopting the frozen
branch's split (it's a strict improvement; `main` has no independent logic here worth preserving
over it).

### 3. `src/routes/dashboard.buyer.quotations.tsx` — real regression risk, not just a textual clash

`main` added quotation-expiry enforcement at both the RLS layer (Stage IR-9,
`20260101012400_quotation_expiry_enforcement.sql` — blocks *accepting* an already-expired
quotation server-side) and this page (`documentExpiryWarning()`-driven UI: shows "This quote
expired on ... — ask us for an updated price," changes the decline button to "Dismiss," and **hides
the Accept button entirely** once expired). The frozen branch independently rewrote this same page
for i18n (`useTranslation`, `formatDate`/`formatNumber`, shared `EmptyState`/`ErrorState`
components) with **no expiry awareness at all** — its version always renders a clickable "Accept
quotation" button regardless of `expiry_date`, confirmed directly in the merge-file output (no
`isExpired` check, no conditional around the `AlertDialogTrigger` at all).

The RLS fix means an expired quotation can never actually be *accepted* even if a user clicks that
button (the database rejects the write) — so this is not an exploitable bypass — but it is a real
UX regression: a user could click "Accept," fill out the confirmation dialog, and hit a bare
rejected-write error with no explanation, instead of never seeing a live Accept button in the first
place. **Recommended resolution**: take the frozen branch's i18n/formatting rewrite as the base
(it's the newer, more complete version of the page) and re-port `main`'s `isExpired` check
(`documentExpiryWarning(q.expiry_date) === "expired"`) into it — gating the Accept button and
swapping the Decline label to "Dismiss," translated through the frozen branch's own i18n system
rather than the hardcoded strings `main` used. This is the one conflict in this map an integrator
should not resolve by simply picking a side.

## Files both sides touched that auto-merge cleanly (verified, not assumed)

- **`package.json`** — both sides only add new `scripts` entries at different points in the same
  block (`main`: `db:preflight`, `config:check`; frozen: `test:unit`, `i18n:check`). No shared key
  touched.
- **`src/lib/queries/profile.ts`** — `main`'s Stage CE change (added `getMyProfile()`/
  `updateMyPhone()`) and the frozen branch's own edits land on non-overlapping regions.
- **`src/routeTree.gen.ts`** — a generated file (never hand-edited per CLAUDE.md); the trivial
  merge is technically conflict-free, but **do not trust a hand-merged or auto-merged generated
  file as authoritative** — regenerate it (`npm run dev` or `npm run build`) immediately after any
  real integration merge, the same as any other build artifact, rather than relying on whatever
  the merge produced.
- **`src/routes/_public.planned-routes.tsx`**, **`src/routes/_public.transport.index.tsx`**,
  **`src/routes/dashboard.buyer.transport.tsx`** — both sides' edits land on different lines within
  each file.

## Files with zero overlap (one side only) — confirmed, not assumed, by diffing each side independently

- **`src/components/`**: `main` touched `chat-thread.tsx`, `notification-preferences.tsx`,
  `ops-request-table.tsx`, `transport-document-checklist.tsx`, `transport-timeline.tsx`. The frozen
  branch touched `cards.tsx`, `marketplace/animal-image.tsx`, `notification-bell.tsx`,
  `public/empty-state.tsx`, `public/error-state.tsx`, `site-chrome.tsx`. **Zero filename overlap.**
- **`src/lib/i18n/**`, `tests/unit/*.test.ts`, `src/lib/presentation/*`,
  `src/lib/saved-animal-classification.ts`, `src/lib/org-routing.ts`**: entirely new, frontend-only
  additions with no backend equivalent — safe to bring in wholesale.
- **`src/routes/__root.tsx`**: frozen-branch-only change (adds i18n context); `main` never touched
  this file.

## A real, currently-invisible integration risk: `src/lib/supabase/types.ts`

The frozen branch **never touches `src/lib/supabase/types.ts` at all** — it still assumes whatever
shape that file had at the branch's freeze point, which predates this backend session's Stage IR-5
(`293648d`, "Retire the hand-written Supabase types stub for real generated types"). `main`'s
current `types.ts` is 7000+ lines of real `supabase gen types` output with a full `Enums` section
(e.g. `transport_status`, `route_reservation_status`) replacing what used to be a hand-written stub
that widened every enum-typed column/RPC argument to plain `string`. This was not part of the
`git merge-tree` conflict count (the frozen branch doesn't touch the file, so there's no textual
conflict), but it is a real, likely source of **new TypeScript errors surfacing only after
integration** — any frozen-branch code that passes a plain string literal to an enum-typed column
or RPC argument (previously accepted by the old widened stub) may no longer typecheck against the
real generated types, the same class of error Stage IR-5 already found and fixed 37 instances of
on `main`'s own side. Recommend running `npx tsc --noEmit` immediately after integration and
budgeting time for a similar fix pass on the frontend's side, not assuming a clean merge implies a
clean typecheck.

## What this stage did not do

No file was merged, cherry-picked, checked out, or edited on either branch. No integration
worktree was created. This is a read-only map for whoever performs the real integration next
(candidate for IR-15's "integration runbook").
