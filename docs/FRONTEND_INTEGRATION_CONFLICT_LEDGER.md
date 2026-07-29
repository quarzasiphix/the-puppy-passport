# Frontend integration conflict ledger

One entry per real conflict hit during the 52-commit cherry-pick, in the order encountered.

## 1. `src/lib/queries/buyer-activity.ts` — commit `1444e35`

- **Frontend commit**: `1444e35` "Real foundation directory/profiles, fix breeder/foundation
  cross-type leaks in saved/followed"
- **File**: `src/lib/queries/buyer-activity.ts`
- **Conflict type**: content — two different implementations of "list a buyer's followed
  organisations."
- **Backend behavior preserved**: none affected — this is a pure display/query-shape concern, no
  RLS/security invariant involved. `mapOrgsToBreeders` (the HEAD-side helper) remains available in
  `marketplace.ts` for its other real caller, untouched.
- **Frontend behavior preserved**: took the incoming side in full — splits followed organisations
  into `listFollowedBreeders()` (kennels only) and `listFollowedFoundations()` (foundation/
  shelter/rescue), each mapped through its correct shape. This fixes a real bug: previously every
  followed org, including foundations, was rendered through `mapOrgToBreeder`, mislabelling a
  followed foundation as a "breeder."
- **Manual decision**: keep the incoming (frontend) implementation entirely; drop the HEAD-side
  `mapOrgsToBreeders`-based single-list approach for this specific call site only.
- **Test required**: none new — no backend contract changed, this is a client-side query/display
  shape change only.
- **Browser scenario required**: verify `dashboard.buyer.followed.tsx` shows a followed foundation
  labelled as a foundation, not a breeder (Phase 21/Q).

## 2. `src/routes/_public.breeders.$slug.tsx` — commit `851b216`

- **Frontend commit**: `851b216` "Harden foundations/saved/followed: fix N+1, cache staleness, and
  misleading UI from 1444e35"
- **File**: `src/routes/_public.breeders.$slug.tsx`
- **Conflict type**: content — both sides modified the follow/unfollow mutation's `onSuccess`/
  `onError` handlers, but for different reasons.
- **Backend behavior preserved**: `getFriendlyErrorMessage(err, "Could not update.")` — this
  session's own error-sanitisation convention (Phase E-7 equivalent work), not the frontend's raw
  `err instanceof Error ? err.message : ...` fallback.
- **Frontend behavior preserved**: the 3-way cache invalidation (`followed-org-ids`,
  `my-followed-breeders`, `my-followed-foundations`) — a real stale-cache bug fix, kept in full.
- **Manual decision**: combined both — neither side's change was a strict superset of the other,
  so this is a genuine merge of two independent real improvements, not a pick-one-side resolution.
- **Test required**: none new — client-side only.
- **Browser scenario required**: follow/unfollow a breeder, confirm the followed-organisations
  dashboard page reflects the change without a manual reload (Phase 21/Q).

## 3. `src/lib/queries/marketplace.ts` — commit `2d011c7`

- **Frontend commit**: `2d011c7` "Fix N+1 queries for breeder counts and litter counts (deferred
  from Phases 1 and 4)"
- **File**: `src/lib/queries/marketplace.ts`
- **Conflict type**: content — a genuine architectural fork. Both HEAD (backend/earlier-integrated
  frontend work) and this incoming commit independently built N+1-query-avoidance batching for
  litter counts and breeder counts, with different function shapes. 5 conflicting hunks in one
  file, all the same root cause.
- **Backend behavior preserved**: no security/RLS invariant involved — pure query-shape/perf
  concern. Confirmed via grep that HEAD's competing implementation
  (`countAnimalsByStatus`, single-arg async `mapLitterRow`, `countAnimalsByStatusForLitters`,
  `buildLitter`, single-arg async `mapOrgToBreeder`, `orgBreedsAndCountsBatch`, `buildBreeder`)
  was dead code: `orgBreeds`/`orgAvailablePuppyCount` (the singular functions HEAD's
  `mapOrgToBreeder` called) aren't defined anywhere in the file, and the one plausible caller
  (`getKennelBySlug`) already exclusively uses the batch path (`mapOrgsToBreeders([data])`).
- **Frontend behavior preserved**: took the incoming side in full for all 5 hunks —
  `litterCountsBatch`/`mapLitterRow(l, counts)`/`mapLitterRows`, and
  `mapOrgToBreeder(o, breeds, availablePuppies)`/`orgBreedsBatch`/`orgAvailablePuppyCounts`/
  `mapOrgsToBreeders`. This shape is also consistent with the already-merged
  `mapOrgToFoundation(o, availableForAdoption)` pattern from an earlier commit in this same
  cherry-pick sequence.
- **Manual decision**: take the incoming side entirely; drop HEAD's redundant/dead parallel
  implementation. Also removed the now-unused `AnimalAvailabilityStatus` type import and fixed one
  dangling comment that referenced the removed `countAnimalsByStatus` function by name.
- **Test required**: none new — client-side query shape only; verified with `npx tsc --noEmit`
  (clean) after resolution.
- **Browser scenario required**: breeder listing/detail pages and litter listing/detail pages
  still show correct available/reserved counts (Phase 21).

## 4. `src/routes/dashboard.buyer.quotations.tsx` — commit `0573acf`

- **Frontend commit**: `0573acf` "PR review + presentation core: fix owner-preview leak, add
  locale-aware dates"
- **File**: `src/routes/dashboard.buyer.quotations.tsx`
- **Conflict type**: content — both sides modified the same quotation-card rendering block, again
  for different reasons.
- **Backend behavior preserved**: HEAD's expired-quotation guard (backend main commit
  `5cc520f` "Prevent accepting an already-expired quotation", landed on `main` just before this
  integration effort started) — `documentExpiryWarning(q.expiry_date) === "expired"` computed once
  per row as `isExpired`, used to hide the "Accept quotation" dialog entirely and relabel the
  decline button "Dismiss" for an already-expired quote. This is a real business-rule guard (a
  buyer must not be able to accept a quote past its expiry), not cosmetic — dropping it would
  silently reintroduce the bug that commit fixed.
- **Frontend behavior preserved**: the incoming commit's locale-aware date formatting —
  `formatDate(q.expiry_date, locale)` from the new `src/lib/presentation/date.ts` (also added by
  this same commit) — replacing HEAD's hardcoded `new Date(...).toLocaleDateString("en-GB")`,
  which ignored a Polish-preference visitor's locale.
- **Manual decision**: combined both — kept HEAD's `isExpired` logic and conditional
  accept/dismiss UI wholesale, but replaced every hardcoded `en-GB` date call inside it with
  `formatDate(q.expiry_date, locale)`. Added `useTranslation`/`locale` (incoming) alongside
  `getFriendlyErrorMessage`/`documentExpiryWarning` (HEAD) in the merged import block. Neither
  side's change was a strict superset of the other.
- **Test required**: none new — client-side only; verified with `npx tsc --noEmit` (clean) after
  resolution.
- **Browser scenario required**: an expired quotation shows "This quote expired on &lt;date&gt;"
  with no accept button and a "Dismiss" button, in both `en` and `pl` locales; a non-expired
  quotation still shows "Valid until &lt;date&gt;" and both Accept/Decline buttons (Phase 21).
