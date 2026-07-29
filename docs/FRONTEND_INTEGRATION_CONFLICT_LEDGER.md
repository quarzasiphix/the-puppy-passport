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

## 5. `src/routes/dashboard.buyer.quotations.tsx` — commit `dacd24a`

- **Frontend commit**: `dacd24a` "Fix raw quotation-status enum shown to buyers + locale-aware
  number formatting"
- **File**: `src/routes/dashboard.buyer.quotations.tsx`
- **Conflict type**: content (2 hunks) — third consecutive conflict on this same file, again both
  sides touching the same quotation card. Also surfaced a genuine stale-signature issue: the
  incoming tree's `AlertDialogAction`/decline `Button` `onClick` handlers called
  `respondMutation.mutate({ id, transportRequestId: q.transport_request_id, response })`, a 3-field
  shape inherited from the frontend branch's much earlier common-ancestor history (commits
  `4dabe60`/`cfd33ca`, both already ancestors of backend `main` too). Backend `main` later
  simplified `respondToQuotation()` to a 2-arg RPC form (`id`, `response` only — confirmed via
  `src/lib/queries/transport.ts:563`, and matching this integration branch's already-resolved
  `mutationFn` type from ledger entry 4); the frontend branch never received that simplification,
  so its `transportRequestId` field no longer exists on the `mutationFn` parameter type and would
  fail TypeScript's excess-property check verbatim.
- **Backend behavior preserved**: kept the 2-arg `respondMutation.mutate({ id, response })` calls
  (both accept and decline) exactly as already established in ledger entry 4 — dropped the stale
  `transportRequestId` field entirely rather than trying to plumb it through.
- **Frontend behavior preserved**: `statusLabels` plain-language badge map (never show a raw
  `q.status` enum value like `"sent"`/`"replaced"` to a buyer — a real CLAUDE.md rule this commit's
  own message calls out by name) and `formatNumber(q.total_price, locale)` for the price display,
  replacing bare `.toLocaleString()` (same hydration-mismatch/locale-ignoring class of bug as the
  date formatting in ledger entry 4), applied in both the card body and the accept-confirmation
  dialog text.
- **Manual decision**: combined both — HEAD's `isExpired` guard/dismiss-button flow and 2-arg
  mutate calls (unchanged from entry 4), plus incoming's `statusLabels` badge translation and
  `formatNumber` price formatting layered on top.
- **Test required**: none new for this file — verified with `npx tsc --noEmit` (clean), which is
  precisely what would have caught the dropped `transportRequestId` field if missed.
- **Browser scenario required**: quotation badge reads "Awaiting your response" / "Accepted" /
  "Declined" / "Expired" / "Replaced by a new quotation", never a raw enum string; total price
  renders locale-formatted in both `en` and `pl`; accept/decline still functionally submit
  (Phase 21).

## 6. `src/routes/_public.planned-routes.tsx` — commit `5163613`

- **Frontend commit**: `5163613` "Fix raw route-status enum shown on public planned-routes page"
- **File**: `src/routes/_public.planned-routes.tsx`
- **Conflict type**: content — not a real logic fork, both sides added independent, unrelated
  top-of-file declarations (HEAD: `getFriendlyErrorMessage` import from this session's own
  error-sanitisation work; incoming: `routeStatusLabels` plain-language map for the same
  raw-enum-exposure class of bug as ledger entry 5, this time on an unauthenticated public page).
  Also surfaced a real, separate type error: `routeStatusLabels[r.status]` doesn't compile against
  the integration branch's current (more complete) generated Supabase types, where the
  `public_routes` view's `status` column types as `string | null` — the frontend branch's own
  stale types (Bot 1's pre-identified conflict #2) had it as non-nullable `string`.
- **Backend behavior preserved**: kept `getFriendlyErrorMessage` import in full; both additions are
  used elsewhere in the file with no actual overlap.
- **Frontend behavior preserved**: kept `routeStatusLabels` in full — a real CLAUDE.md
  rule-of-translation fix, worse here than the quotations page since this route has zero auth
  gate: any visitor would otherwise see the raw `'planning'`/`'confirmed'` enum values.
- **Manual decision**: concatenated both declarations (no actual overlap, purely adjacent). Fixed
  the type error by guarding the null case: `routeStatusLabels[r.status ?? ""] ?? r.status` instead
  of the frontend's un-guarded `routeStatusLabels[r.status]` — a minimal, targeted fix rather than
  a wholesale type regeneration, since Phase 7 (regenerate Supabase types from the final integrated
  schema) will re-verify this class of issue everywhere at once.
- **Test required**: none new — verified with `npx tsc --noEmit` (clean after the null-guard fix).
- **Browser scenario required**: `/planned-routes` as an anonymous visitor shows "Being planned" /
  "Confirmed" badges, never raw `planning`/`confirmed` text (Phase 23, public/SEO routes).
