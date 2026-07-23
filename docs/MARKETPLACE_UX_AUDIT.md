# Marketplace UX audit — public marketplace & social surfaces

Scope: a frontend/UX-only pass over Havenpaw's public animal marketplace and social surfaces
(homepage, discovery, cards, breeder/foundation profiles, adoptions, community, saved/followed
actions). No `supabase/migrations`, `supabase/seed.sql`, `tests/db`, database policies/functions/
triggers, transport operational permissions, or fundraising financial logic were touched — this
work ran in parallel with another session doing Supabase security/regression work on the same
repo, under an explicit boundary not to touch any of the above.

## Pages reviewed

Homepage, `/find-a-dog`, `/find-your-dog`, `/puppies/$id`, `/breeders`, `/breeders/$slug`,
`/foundations` (was a stub), `/adoptions`, `/adoptions/$id`, `/planned-litters`, `/profile/$profileId`,
`/community`, `/community/groups`, `/community/groups/$slug`, `/breeder-map`, `/planned-routes`,
`dashboard/buyer/saved`, `dashboard/buyer/followed`, `dashboard/buyer` (overview), plus the shared
`site-chrome.tsx` header/footer and `components/cards.tsx` card library. Most of these were already
in solid shape (real Supabase-backed data, sensible empty states, clean card design) — the audit
below focuses on what was actually wrong or missing, not a restatement of what already worked.

## Issues fixed

### Foundations were a dead stub with no real directory or profile page
`org_type` (`foundation`/`shelter`/`rescue`) and public columns (`is_public`,
`verification_status`, `transport_available`, `description`, etc.) already existed on
`organisations` and were already used identically for kennels — but no query, card, or route ever
read them for the public side. `/foundations` was a static "coming later" placeholder even though
foundation dashboards, org creation, and adoption listings already worked end-to-end.

- Added `Foundation` type, `mapOrgToFoundation`, `listApprovedFoundations`, `getFoundationBySlug`,
  `listPublishedAdoptionsForOrg` (`src/lib/queries/marketplace.ts`) — same pattern as the existing
  kennel functions, no schema change.
- Added `FoundationCard` (`src/components/cards.tsx`) — verification badge, org-type label
  (Foundation/Shelter/Rescue), transport badge, live "dogs for adoption" count, response time.
- Rebuilt `/foundations` as a real, loader-backed directory (`_public.foundations.tsx`) and added a
  new `/foundations/$slug` profile page (`_public.foundations.$slug.tsx`) mirroring the existing
  breeder-profile template (hero, stats, Follow, Report, tabs: About / Available for adoption /
  Transport / Contact) so foundations get the same prestige-and-credibility treatment the task
  asked for, not a stripped-down version.

### Cross-type data leaks between breeders and foundations
Several existing queries selected by id/slug with no `org_type` filter, so a foundation's row could
render through the breeder-shaped UI (or vice versa) with the wrong labels and links:
- `getKennelBySlug` had no `org_type` filter → now scoped to `org_type = "kennel"`.
- `getPuppyById` had no `listing_category` filter → now scoped to `"breeder_puppy"`, matching
  `listPublishedPuppies`.
- `listFollowedBreeders` mapped **every** followed org (kennel or foundation) through
  `mapOrgToBreeder` → split into `listFollowedBreeders` (kennel-only) and a new
  `listFollowedFoundations`, each mapped through its correct shape.
- `listSavedPuppies` mapped **every** saved animal (puppy, adoption, or private rehoming) through
  `mapAnimalToPuppy` → replaced with `listSavedAnimals`, which reads `listing_category` and maps
  each row through the correct shape. A saved rescue dog previously showed blank breeder/location
  fields (no `organisations` join fallback to `profiles`) and linked to `/puppies/$id`, which would
  have 404'd once `getPuppyById` was scoped — this is now correct end to end.
- `getPublicKennelSlugForOwner` (public profile page) only ever checked `org_type = "kennel"` →
  replaced with `getPublicOrgLinkForOwner`, returning the org type too, so a foundation owner's
  public profile now links to "View foundation profile" instead of silently showing nothing.
- Community posts authored by an organisation had no link at all (`author_organization_id` posts
  rendered as plain text, only profile-authored posts were clickable) — added `org_type` to the
  post select and linked kennel-authored posts to `/breeders/$slug`, foundation-authored posts to
  `/foundations/$slug`.

None of this touched RLS or migrations — every fix is an added `.eq()`/`.in()` filter or a client-
side split on data already reachable under the existing policies (proven by the pre-existing
kennel-only queries using the identical filter pattern).

### Saved/followed dashboards now correctly separate what a user actually saved/followed
`dashboard.buyer.saved.tsx` and `dashboard.buyer.followed.tsx` were rewritten (not just patched) to
present "Puppies" vs "Dogs for adoption" and "Breeders" vs "Foundations & rescues" as distinct,
correctly-linked sections instead of one mislabelled list. `dashboard.buyer.index.tsx`'s "Saved"
overview tile and preview grid were updated to match (`listSavedAnimals` instead of the removed
`listSavedPuppies`).

### Adoption listings didn't link to the organisation running them
`AdoptionCard` and the adoption detail page showed the foundation's name as plain text with no way
to reach its profile. Both now link to `/foundations/$slug` (skipped for private rehoming, which has
no org profile by design).

### Missing top-level entry points
`/planned-litters` and `/community/groups` were live, real features reachable only by a deep in-page
link (or not at all, for planned litters) — no nav or footer entry. Added both to the footer
(`Discover` → Planned litters; `Account` → Community groups) rather than the already-dense top nav,
to avoid the "excessive badges/links" clutter the task warned against.

### Minor reliability/accessibility touch
Community feed post timestamps were a bare formatted date with no exact time available — converted
to a semantic `<time dateTime>` element with a full-timestamp `title` tooltip on hover, on the main
`/community` feed (the highest-traffic instance of this pattern in the codebase).

## Issues deliberately not changed

- **`/foundations` visual redesign beyond the breeder-profile template** — reused the existing,
  already-approved breeder-profile layout instead of inventing a new one, per the "reuse existing
  components" and "don't over-engineer" instructions. A dedicated "Reviews" tab, ratings, or
  handover counts were not added for foundations (same reason breeders don't have them yet — see
  `docs/CURRENT_STATE_AUDIT.md`: `rating`/`reviewCount`/`handovers` are honest `0` placeholders with
  no backing table).
- **Litter waiting lists, ratings/reviews, "handovers" counts** — these are already-known,
  pre-existing placeholder zeros (`src/lib/queries/marketplace.ts`), not something this pass
  introduced or could honestly complete without a schema change, which is out of scope.
- **`find-a-dog.tsx`'s hand-rolled list-view row** (duplicates `PuppyCard` layout instead of reusing
  it) — flagged during the audit but left alone: it works correctly today, and refactoring it is a
  styling-only risk with no functional bug behind it. Worth doing in a follow-up pass focused on
  card deduplication specifically.
- **Community/groups timestamp and profile-post timestamp** (`_public.profile.$profileId.tsx`,
  `_public.community.groups.$slug.tsx`) — same bare-date pattern as the community feed, not
  converted to `<time>` in this pass to keep the diff bounded to the highest-traffic feed; noted
  here so a follow-up can apply the same one-line change.
- **Foundation dashboards, breeder dashboards, and every other `dashboard.*` route** — left as-is.
  These are internal/operational surfaces, not the public marketplace this task scoped to, and the
  boundary instructions explicitly excluded transport operational permissions and any
  database/security work that dashboard functionality depends on.
- **No new abstraction was introduced purely to "share code"** — `FoundationCard` is a new
  component (not a generic `<OrgCard kind="breeder"|"foundation">`) because breeder and foundation
  framing genuinely differ (puppies vs. adoption animals, "years experience" vs. org-type label);
  forcing them into one polymorphic component would have made both harder to read for a marginal
  line-count saving.

## Localisation

The project's i18n infrastructure (`src/lib/i18n`) already covered only the site header/footer and
the homepage hero before this pass — every other marketplace page (find-a-dog, breeder/adoption
detail, planned-litters, community, rehome, breeder-map, planned-routes, all dashboards) was, and
mostly remains, hardcoded English. This pass **added real English + Polish keys for the two brand
new public pages** (`/foundations` and `/foundations/$slug` — see `foundations.*` in
`src/lib/i18n/locales/{en,pl}.json`), including the dynamic count sentence
(`countSuffixSingular`/`countSuffixPlural`/`countSuffixEmpty`, composed with the raw number outside
`t()` since the i18n helper is key-only with no string interpolation — same pattern the existing
footer copyright line already uses).

**Deliberately not translated in this pass** (documented here rather than silently left):
- `dashboard.buyer.saved.tsx` and `dashboard.buyer.followed.tsx` were substantially rewritten but
  kept as hardcoded English, consistent with every other dashboard route (none of which use `t()`
  today). Adding i18n to 2 of ~50 dashboard files would have been a bigger inconsistency than
  leaving the whole dashboard zone as the next real i18n milestone.
- The 2 new footer link entries (Planned litters, Community groups) were added in the same literal
  `[label, href]` array style as their ~15 siblings in `site-chrome.tsx`'s footer — translating only
  the 2 new entries in an otherwise-hardcoded array would have been a worse inconsistency than
  matching the existing (imperfect) pattern.
- `cards.tsx`'s `statusLabel` and the new `foundationOrgTypeLabel` remain hardcoded English — that
  whole file has zero i18n today, and it's the single highest-leverage next translation target
  given how many pages render through it (flagged, not fixed, to keep this pass bounded).
- Nothing was translated into a language other than English/Polish, and no key was invented without
  a real English and Polish value — no fake "complete" translations were added.

## Reliability checks run

- Every button/link added or modified was manually traced to a real route or a real mutation — no
  new dead links, and no action is shown to a user who can't perform it (Follow/Contact/Report on
  the foundation profile reuse the exact same auth-gating as the existing breeder profile).
- `getFoundationBySlug`/`getPuppyById`/`getKennelBySlug` all still `.catch(() => null)` into
  `notFound()` at the loader level (existing pattern), so the new `org_type` scoping fails safely
  into a real 404 page instead of a raw error.
- Loading/empty/error states: `/foundations` and `/foundations/$slug` both have honest empty states
  ("no foundations published yet", "no dogs currently published for adoption") rather than blank
  space or a fake success message.

## Checks run

- `npm install` (worktree had no `node_modules` — dependencies installed fresh, native npm, no
  `package-lock.json` changes).
- Route-tree regeneration: confirmed via `npm run build` (TanStack Start's Vite plugin regenerates
  `src/routeTree.gen.ts` on build) — both new routes (`/foundations`, `/foundations/$slug`) are
  present in the generated tree with correct typed params.
- `npx tsc --noEmit` — clean, no errors.
- `npx eslint --fix` on every file touched in this task (not the whole repo — several pre-existing,
  unrelated files have pre-existing prettier/lint debt from before this session that wasn't part of
  this task's scope) — clean after fix, only pre-existing `react-refresh/only-export-components`
  warnings remain in `cards.tsx` (present before this change too, from exporting constants
  alongside components; not a functional issue).
- `npm run build` — production build succeeds.

## Remaining browser-only checks (not run — environment limitation)

Playwright/E2E remains blocked in this sandbox (see `docs/E2E_TESTING.md`) — nothing here was
verified by an actual browser render. Please manually check, ideally at a narrow (≤375px) viewport:

- `/foundations` and `/foundations/$slug` — real visual check of the new pages (grid wrapping, tab
  overflow on mobile, cover-image aspect ratio on very narrow phones).
- `/foundations/$slug` Follow/Report/Contact button row wrapping on small screens (mirrors the
  breeder profile's existing layout, which itself hasn't been screenshot-verified at narrow widths
  either — pre-existing gap, not introduced here).
- `dashboard/buyer/saved` and `dashboard/buyer/followed` — the two-section layout with real signed-
  in data (this session could not authenticate against a running local Supabase instance).
- Language switch on `/foundations` and `/foundations/$slug` — confirm Polish renders correctly and
  no English/Polish mixing appears (the flat-key i18n helper falls back to English per-key on any
  miss, so a typo would show as an isolated English word, not a crash — worth a visual scan).
- Community feed organisation-author links (`/community`) — needs a real post authored by an
  organisation in seed/dev data to click-test; this session could not confirm one exists.

## Hardening pass — review of commit 1444e35 as a pull request

A second pass treating the previous commit as a PR from another developer: read the full diff,
found and fixed real correctness/performance/accessibility problems before the branch is
integrated. No new broad feature was added in this pass — everything below is a fix to code that
1444e35 already introduced.

### Issues found in 1444e35

1. **N+1 query in the foundations directory.** `listApprovedFoundations()` mapped every org through
   `mapOrgToFoundation`, which fired its own `orgAvailableAdoptionCount` query per organisation —
   one count query per foundation on every directory page load, and the same pattern again in
   `listFollowedFoundations`.
2. **A failed count query silently read as "zero available."** `orgAvailableAdoptionCount` didn't
   check `error` from the count query at all — a real failure and a genuine zero looked identical.
3. **`getFoundationBySlug` had no `verification_status`/`is_public` filter.** Unlike
   `listApprovedFoundations`, the by-slug lookup could return a pending or private organisation if
   someone (typically its own owner/member, who RLS lets read their own org regardless of status)
   guessed or was given its slug directly — rendered as a live public profile with no "pending"
   indicator.
4. **`getFoundationBySlug`'s loader swallowed every error into a fake 404.** `.catch(() => null)`
   then `notFound()` meant a real network/RLS failure looked exactly like "this foundation doesn't
   exist," even though the root route already has a working `errorComponent` this could have used
   instead (same anti-pattern the rest of the codebase already has on `breeders.$slug.tsx`/
   `puppies.$id.tsx`/`adoptions.$id.tsx` — not fixed there, out of this pass's scope, but not
   compounded further either).
5. **A misleading "Contact foundation" button.** It didn't start a conversation or contact anyone —
   it just switched the active tab to "Available for adoption," using a `MessageCircle` icon that
   implied messaging.
6. **Private rehoming listings were saved and displayed as "foundation adoptions."**
   `dashboard.buyer.saved.tsx` grouped every non-puppy saved animal under one "Dogs for adoption"
   header, with no distinction from a genuine foundation/shelter/rescue listing — a private owner's
   rehoming listing isn't a foundation adoption and shouldn't read as one.
7. **Stale cache after saving/following from a card or detail page.** `saved-animal-ids` (read by
   every card) and `my-saved-animals` (read by the saved-animals dashboard page and the buyer
   overview) are two keys for one piece of server state, but only the first was invalidated on
   save/unsave. Same gap between `followed-org-ids` and `my-followed-breeders`/
   `my-followed-foundations` on both the breeder and foundation profile pages' follow buttons.
8. **Community feed timestamps were hardcoded to `en-GB`** regardless of the active UI locale.
9. **Two i18n keys (`foundations.viewProfile`, `foundations.respondsPrefix`, `foundations.transport`)
   were defined but never used** — `FoundationCard` had the equivalent strings hardcoded in English
   instead, and the foundations-count sentence used a naive 2-form (singular/plural) composition
   that reads as ungrammatical Polish for counts of 2–4 (Polish has three plural forms, not two).
10. Minor: unused `MessageCircle` import left after removing its only usage; foundation logo `alt=""`
    (a real logo, not decorative); the foundation profile's action-button row and card header row
    had no `flex-wrap`/`min-w-0`, risking overflow with a long organisation name on narrow phones;
    several plain `<Link>` elements (not wrapped in the shared `Button` component, which already has
    focus-visible styling) had no visible keyboard-focus ring of their own.

### Fixes applied

- **Batched adoption counts.** Added `orgAvailableAdoptionCounts(orgIds: string[])` — one query for
  however many organisations are being mapped, using `.in("organization_id", orgIds)` and counting
  client-side per id. `mapOrgToFoundation` is now a plain sync function taking the count as a
  parameter instead of querying inside the mapper; `listApprovedFoundations`, `getFoundationBySlug`
  and `listFollowedFoundations` all fetch their counts in one batched call. The count query's own
  `error` is now checked and thrown, not swallowed into `0`.
- **`getFoundationBySlug` now filters `verification_status = 'approved'` and `is_public = true`**,
  matching `listApprovedFoundations` exactly, and uses `.maybeSingle()` instead of `.single()` so it
  returns `null` only for a genuine absence — a real query error now throws and reaches the route's
  loader un-caught, propagating to the existing root `errorComponent` instead of a fake 404 (verified
  live — see Checks run below).
- **Honest action wording.** The hero button is now "View animals available for adoption"
  (`foundations.viewAnimalsCta`) with a `HeartHandshake` icon, doing exactly what it says (switching
  to the Animals tab) — no icon or copy implies a conversation starts.
- **Saved animals now split into three groups**, not two: `SavedAnimal`'s `kind` is
  `"puppy" | "adoption" | "private_rehoming"` (previously just `"puppy" | "adoption"`, which folded
  private rehoming into the foundation-adoption bucket). `dashboard.buyer.saved.tsx` now renders
  "Puppies," "Dogs for adoption," and "Private rehoming" as three separate, correctly-labelled
  sections sharing one `AnimalTile`/`SavedSection` component instead of three near-duplicate blocks.
- **Cache invalidation fixed at every mutation site that changes save/follow state**: `cards.tsx`'s
  `useIsSaved` toggle now invalidates both `saved-animal-ids` and `my-saved-animals`; both
  `_public.breeders.$slug.tsx`'s and `_public.foundations.$slug.tsx`'s follow mutations now
  invalidate `followed-org-ids`, `my-followed-breeders` and `my-followed-foundations` together. This
  required touching `_public.breeders.$slug.tsx`, which is outside 1444e35's diff — justified because
  it shares the exact same follow-state keys as the new foundation page and was left with the
  identical gap; not fixing it would have left half the symmetric feature broken. The underlying
  three-keys-for-one-state naming duplication itself is not restructured in this pass (see "not
  changed" below) — the fix is comprehensive invalidation, not a key-namespace rename.
- **Locale-aware timestamps.** The community feed's `<time>` now formats with `en-GB` or `pl-PL`
  based on the active `useTranslation()` locale, not a hardcoded string.
- **Correct Polish pluralisation.** Added `pluralCategory(locale, n)` to `src/lib/i18n/index.tsx`
  (CLDR-style `one`/`few`/`many`, matching Polish's real plural rules — 1; 2–4 except 12–14; else) and
  rewired both the foundations-count sentence and a new `FoundationCard` "N dogs for adoption"
  sentence through it, with 3-form key sets in both `en.json` (English only needs 2 real forms, so
  `few`/`many` share a value) and `pl.json` (all 3 grammatically distinct).
- **`FoundationCard` now uses the previously-dead translation keys** (org type badge, "Transport"
  badge, description fallback, "Responds," "View profile") instead of hardcoded English — the first
  shared card component in `cards.tsx` to use `useTranslation()` (the rest of that file stays
  hardcoded, matching the rest of the pre-existing marketplace pages — documented, not silently
  left).
- **Accessibility**: foundation logo now gets a real `alt` (`"Logo of {name}"` / `"Logo organizacji
  {name}"`); the action-button row and `FoundationCard`'s header row got `flex-wrap`/`min-w-0`/
  `break-words` so a long organisation name can't overflow; every plain `<Link>` introduced in this
  branch (`AdoptionCard`'s org-name link, the public profile's kennel/foundation links, the community
  feed's author links, the new saved-animals tile) now has an explicit `focus-visible:ring-2` to
  match the design system's ring token, on top of the browser's own default outline.
- **Extracted pure, unit-tested logic** instead of leaving route-selection/classification inline and
  duplicated:
  - `src/lib/org-routing.ts` — `orgProfileRoute(orgType)`, used identically by the community feed
    (organisation-authored posts) and the public profile page (linked professional profile), so the
    two can't silently diverge on which org types go to `/breeders/$slug` vs `/foundations/$slug`.
  - `src/lib/saved-animal-classification.ts` — `classifySavedAnimalKind(listingCategory)`, used by
    `listSavedAnimals`.
  - `src/lib/i18n/completeness.ts` — the translation-completeness checker (`checkTranslationCompleteness`,
    previously real but never actually invoked anywhere) split out of `index.tsx` into a file with no
    React/JSX dependency, so it can run under plain `node --test` (index.tsx contains JSX, which
    Node's native TS type-stripping cannot parse without a bundler).
  - All three are covered by `tests/unit/*.test.ts` (new `npm run test:unit` script, `node --test`,
    no new dependency) — 13 tests, all passing (see Checks run).

### Issues deliberately not changed in this pass

- **The three-keys-for-one-state query-key duplication** (`saved-animal-ids`/`my-saved-animals`,
  `followed-org-ids`/`my-followed-breeders`/`my-followed-foundations`) is fixed functionally
  (comprehensive invalidation everywhere) but not restructured into a single hierarchical key
  namespace — that's a naming/architecture cleanup, not a correctness bug once invalidation is
  comprehensive, and doing it now would mean touching more pre-existing files than this pass's scope
  justifies. Left as a named follow-up.
- **`breeders.$slug.tsx`/`puppies.$id.tsx`/`adoptions.$id.tsx`'s identical "swallow every error into
  `.catch(() => null)` then `notFound()`" pattern** was not changed — only the new
  `getFoundationBySlug`/`_public.foundations.$slug.tsx` pair was fixed. The other three pages have
  the same latent issue (a real failure reads as "not found") but weren't introduced by 1444e35 and
  are a larger, separate cleanup.
- **Followed-profile (person) cache keys** (`followed-profile-ids`, `is-following-profile`) have the
  same kind of gap as the org-follow keys did, but that feature predates 1444e35 entirely and wasn't
  touched by it — flagged, not fixed, to keep this pass to what 1444e35 actually introduced plus its
  direct, unavoidable consequences (like the breeder-profile follow-mutation fix above).
- **`cards.tsx`'s other components** (`PuppyCard`, `AdoptionCard`, `LitterCard`, `BreederCard`,
  `statusLabel`) remain hardcoded English — only `FoundationCard` was moved onto `useTranslation()`,
  since it's the only one of these introduced by 1444e35.

### Checks run

- `npx tsc --noEmit` — clean.
- `npx eslint --fix` on every file touched in this pass — clean (only pre-existing
  `react-refresh/only-export-components` warnings remain, from exporting constants alongside
  components in files that already did this before this pass).
- `npm run build` — succeeds; confirms the new `with { type: "json" }` import-attribute syntax in
  `src/lib/i18n/completeness.ts` works under both Vite and (separately) plain Node.
- `npm run test:unit` (new script, `node --test tests/unit/*.test.ts`) — 13/13 passing: org-type →
  route selection, saved-animal classification (specifically that private rehoming never classifies
  as `"adoption"`), and en/pl translation key parity (running the previously-dead
  `checkTranslationCompleteness` for the first time anywhere in the project).
- **Live smoke check without a database.** No local Supabase instance was started from this
  worktree — doing so risked colliding with the other session's live transport-backend work in the
  main worktree (shared Docker/port state), which the task explicitly listed as a reason to stop.
  Instead, `vite dev` was run standalone (no `.env`, so every Supabase call fails at the client-
  construction step) and `/foundations`, `/foundations/$slug` (both a plausible and a clearly invalid
  slug), `/adoptions`, `/adoptions/$id`, `/breeders/$slug`, `/dashboard/buyer/saved` and
  `/dashboard/buyer/followed` were all requested directly. Every one returned HTTP 500 with the
  shared root error page ("This page didn't load") — confirming that a genuine backend failure
  reaches the error boundary instead of rendering a fake empty/not-found/success state, which is
  exactly what the `getFoundationBySlug` fix set out to guarantee. This does **not** confirm real
  not-found-vs-real-row behaviour (that needs an actual reachable database with real rows), and it
  is not a substitute for a real browser check — no visual/layout verification happened this way.

## Phase 2 — Public marketplace information architecture

Audited the full public nav/footer/homepage hierarchy against the product's actual priority list
(primary: find an animal, browse breeders, browse foundations, planned litters, adoptions,
community; secondary: publish, request transport, planned routes, sign in, create account).

### Findings

- **Top-level header/mobile nav under-represented two primary destinations and over-represented
  transport.** The nav had 8 slots: Find a dog, Breeder map, Breeders, Adoptions, Community,
  Transport, Planned routes, How it works. Two primary destinations — **Foundations** and
  **Planned litters** — had no top-level slot at all (footer-only), while transport-adjacent pages
  occupied 2 of 8 slots (Transport, Planned routes) plus a third arguably-secondary item (Breeder
  map, a filtered view of the Breeders page, not a distinct primary destination).
- **The homepage had no entry point to Community at all.** Every other primary destination
  (animal discovery, breeders, adoptions, foundations, planned litters) is reachable from the
  homepage; Community — a primary destination per the hierarchy — was reachable only via the
  persistent header nav, never from any homepage section or quick-link row.
- No stub/incomplete pages were found in the current top-level navigation (the one stub,
  `/foundations`, was already made real in the previous commit/phase) — so no entry needed removing
  or honesty-labelling on that front.

### Fixes applied

- **Reordered the primary nav** (`src/components/site-chrome.tsx`, shared by desktop header and the
  mobile Sheet menu — one array, so both stay in sync): Find a dog, Breeders, **Foundations**,
  **Planned litters**, Adoptions, Community, Transport. "Breeder map," "Planned routes" and "How it
  works" move to footer-only (where they already existed) — still one click away, just not
  competing with the six primary destinations for top-level attention. New `nav.foundations`/
  `nav.plannedLitters` translation keys added (en + pl).
- **Added a "Community" quick-link on the homepage hero** (`_public.index.tsx`), replacing the
  secondary "Planned routes" quick-link (which remains reachable from the dedicated Transport
  section further down the same page) with the previously-homepage-absent primary destination. New
  `home.community` translation key (en + pl).
- Mobile Sheet menu reviewed for clarity — already single-column, clearly separated (nav links →
  divider → account actions → primary CTA button), touch targets at `py-2.5 px-3`; no structural
  change needed beyond the reordered array it shares with the desktop header.

### Checks run

`npx tsc --noEmit`, `npx eslint --fix` on both changed files, `npm run test:unit` (13/13, unaffected
by this phase), `npm run build` — all clean.

## Phase 3 — Animal discovery and search UX

Reviewed `/find-a-dog`, `/find-your-dog`, `/planned-litters`, `/adoptions` for filter honesty,
search states and mobile behaviour.

### Findings

- **`/find-a-dog`'s breed and country filter options were a hardcoded 6-breed/4-country list**
  (`breedOptions`/`countryOptions` module constants), not derived from the actual published
  puppies. A breed or country outside that fixed list had no way to be filtered for even though it
  would still appear in "All breeds"/"All Europe" results — an honesty gap (the filter silently
  couldn't cover real data), not a fabricated/non-functional filter, but wrong either way.
- **The price slider's fixed 1,000–20,000 PLN range** didn't reflect the real spread of published
  prices, making the default range less useful the further real prices sit from that guess.
- **The entire filter panel rendered inline, above the results, on any screen narrower than `lg`.**
  Seven filter groups (breed, country, availability, sex, price, ready-date, verification/transport)
  stacked in normal document flow before a single puppy card — an ordinary mobile visitor had to
  scroll past the whole filter panel just to see results, with no way to collapse it and no way back
  to results without scrolling back up past it again.
- **`find-your-dog.tsx`'s guided search had no distinct error state.** If either of its two queries
  (`listPublishedPuppies`/`listBreedSizes`) failed, `matches` silently evaluated to an empty array,
  and the results step displayed "0 matching puppies — try loosening one of your answers" — exactly
  the "a query failure must never look like '0 animals available'" anti-pattern, with no indication
  anything had actually gone wrong and no way to retry.
- `/adoptions` and `/planned-litters` have no filters at all today (confirmed — no `Select`/
  `Checkbox`/filter state in either file) — nothing to standardise there; both already have honest,
  reasonable empty states and rely on the same un-caught-loader-error-propagates-to-root-boundary
  pattern as everywhere else, so no fix was needed on either page this pass. Adding a new filter
  system to either would be a new feature, not a fix, and is out of this pass's scope.

### Fixes applied

- **Breed/country options are now derived from the loaded puppies** (`distinctOptions()` in
  `_public.find-a-dog.tsx`) — sorted, deduplicated, always exactly the values actually present, so
  the filter can never omit a real breed/country or offer one with zero possible matches.
- **The price slider's min/max now come from the real min/max of published prices**
  (`priceBoundsOf()`), computed once per page load; the slider disables itself (rather than showing
  a broken zero-width range) on the edge case of zero published puppies.
- **Filters moved into a slide-in `Sheet` on narrow screens**, opened by a "Filters" button (with a
  live active-filter-count badge) next to the search box; the desktop persistent sidebar
  (`hidden ... lg:block`) is unchanged. The same `FilterControls` component renders in both places
  from the same lifted state, so nothing can drift between the two. The sheet's own primary action
  is "Show N results" — closes the sheet and returns straight to the (now-filtered) results, which
  is the explicit "must be able to return to results after opening filters" requirement.
- **`find-your-dog.tsx` now has a real, distinct error state** — checks `isError` on both queries,
  shows "Couldn't load puppies to search" with a "Try again" button calling `refetch()` on both,
  instead of silently reading as zero matches.
- Minor: grid/list view toggle buttons got `aria-pressed`/`aria-label` (were icon-only with no
  accessible name before).

### Checks run

`npx tsc --noEmit`, `npx eslint --fix` on both changed files, `npm run test:unit` (13/13, unaffected
by this phase), `npm run build` — all clean. Not verified in an actual browser (see the environment
note in the Phase 1 section) — the mobile Sheet's open/close behaviour, the badge count, and the
slider's disabled edge case are code-reviewed but not visually confirmed at a real narrow viewport.

## Phase 4 — Animal listing card system

Audited every card variant in `components/cards.tsx` (`PuppyCard`, `AdoptionCard`, `LitterCard`,
`BreederCard`, `FoundationCard`) plus the saved/followed dashboard tiles for image handling,
interaction correctness and consistency.

### Findings

- **`LitterCard`'s "View litter" button always linked to `/planned-litters`** (the general index),
  regardless of which specific litter's card it appeared on — clicking it from any litter never
  took you to information about *that* litter, just the same generic list every time. A real dead/
  misleading-action bug (task explicitly calls out "no dead button" / "no action that only changes
  visual state without real behaviour").
- **`LitterCard`'s image `alt` text was the litter's registration code** (e.g., `"GR-2026-003"`) —
  not a meaningful description of what the image actually shows (the mother dog).
- Every other card's primary action already routes correctly per-item (`PuppyCard` →
  `/puppies/$id`, `AdoptionCard` → `/adoptions/$id`, `BreederCard`/`FoundationCard` →
  `/breeders|foundations/$slug`, each parameterised by that specific card's own id/slug) — no
  further fix needed there.
- All cards already have `loading="lazy"` and stable `aspect-*` ratios; alt text on `PuppyCard`,
  `AdoptionCard`, `BreederCard`, `FoundationCard` was already meaningful (animal/kennel/org name).
  Dashboard save/follow tiles (`dashboard.buyer.saved.tsx`, `dashboard.buyer.followed.tsx`,
  `dashboard.buyer.index.tsx`) correctly use `alt=""` — the entity's name is already visible as
  adjacent text inside the same link, so a repeated alt would be redundant to a screen reader, not
  a missing-alt bug.
- No image-resizing/transform utility exists anywhere in the codebase (checked for
  `srcset`/`sizes`/any storage-transform helper) — "no huge original image downloads where existing
  utilities support sizing" doesn't apply; there's no existing utility to wire up, and building an
  image-transform pipeline from scratch would be new infrastructure, not a fix.
- No nested-interactive-control or link-inside-a-clickable-card violations found in any card — none
  of the card `<article>` roots are themselves links; save/follow buttons, org-name links and the
  primary CTA are always siblings, never nested inside one another.

### Fixes applied

- **`LitterCard` now links to the litter's actual kennel** (`/breeders/$slug`, "View kennel") when
  the litter's organisation has a public slug — a real, specific destination instead of the generic
  index every time. Added `breederSlug` to the `Litter` type (optional, since the retired mock-data
  literal arrays don't have one and adding it there would be pointless churn on dead data) and
  threads it through `mapLitterRow`/`litterSelect` (`organisations!litters_kennel_id_fkey(id, name,
  slug)`) — one additional selected column, no new query. Falls back to the old `/planned-litters`
  link only if a litter's org genuinely has no slug (shouldn't happen for a published litter, but
  fails safely rather than crashing).
- **`LitterCard`'s image alt text now describes what's shown** (`"{breed} litter — mother dog"`)
  instead of the registration code.

### Deferred to a later phase

- `mapLitterRow` fires two `countAnimalsByStatus` queries per litter (available + reserved counts),
  which is an N+1 pattern across every litter list (homepage, `/planned-litters`, breeder profile
  "planned" tab) — pre-existing, not introduced by 1444e35. Noted for the Phase 16 performance pass
  rather than fixed here, to keep this phase to card-level correctness.
- `find-a-dog.tsx`'s list-view row (a hand-rolled puppy row, not `PuppyCard`) still duplicates
  `PuppyCard`'s layout rather than reusing it — flagged in the original audit, still not merged;
  it's a legitimate distinct layout (list vs. grid), not a bug, so left alone again this pass.

### Checks run

`npx tsc --noEmit`, `npx eslint --fix` on all three changed files, `npm run test:unit` (13/13,
unaffected), `npm run build` — all clean.

## Phase 5 — Animal detail pages

Reviewed `/puppies/$id` and `/adoptions/$id` (which already handles both foundation adoption and
private rehoming through one component) for trust presentation and honest action wording.

### Findings

- **Every adoption listing's verification badge said "Verified foundation," even for a shelter or
  rescue-type organisation.** `AdoptionListing` never carried the organisation's actual `org_type`
  through from the query, so `AdoptionCard` and the adoption detail page always hardcoded
  "foundation" regardless of whether the real org was a foundation, shelter, or rescue.
- **The adoption action button, its sign-in prompt, its confirmation message and the fee label all
  said "adopting"/"adoption fee" unconditionally**, even for private rehoming listings, which are a
  private individual rehoming their own dog, not a formal organisation adoption. Task's own
  suggested wording ("Ask about rehoming," distinct from "I'm interested in adopting") wasn't used.
- `/puppies/$id` was already in excellent shape: correct non-commerce action wording ("Apply for
  this puppy," "Ask breeder," never "buy" or "add to cart"), an explicit disclaimer that Havenpaw
  doesn't sell puppies directly and applying only opens a conversation, honest "documents expected"
  framing in the Health tab (explicitly *not* claiming verification it doesn't have), and transport
  estimates clearly labelled "approximate... confirmed after you submit a transport request." No
  changes needed there.

### Fixes applied

- **Threaded the organisation's real `org_type` through the adoption data path**: added `org_type`
  to the shared `organisations` join type (`AnimalRow`) and to all four select strings that join it
  (`animalSelect`, `adoptionSelect`, `orgSelect`, and `buyer-activity.ts`'s `savedAnimalSelect` — the
  last one was found out of sync with the others: its `organisations` join was missing `org_type`
  entirely, which would have silently produced a wrong `orgType` on any saved adoption listing even
  though nothing currently renders it there). Added `orgType: FoundationOrgType | null` to
  `AdoptionListing` (`null` for private rehoming, which has no organisation at all), computed via
  the existing `toFoundationOrgType()` helper from Phase 1.
- **`AdoptionCard` and the adoption detail page now show the real type** ("Verified foundation" /
  "Verified shelter" / "Verified rescue") instead of always "foundation."
- **Private rehoming now gets its own wording** on the adoption detail page: "Ask about rehoming
  {name}" (not "I'm interested in adopting"), "Rehoming fee" (not "Adoption fee," on both the card
  and detail page), a rehoming-specific sign-in prompt, and a rehoming-specific confirmation message
  ("before agreeing to a handover" instead of "before confirming an adoption").

### Checks run

`npx tsc --noEmit`, `npx eslint --fix` on all four changed files, `npm run test:unit` (13/13,
unaffected), `npm run build` — all clean.

## Phase 6 — Breeder profile prestige pass

Reviewed `/breeders` and `/breeders/$slug` against the "professional portfolio, not classifieds
seller page" bar.

### Findings

- **`/breeders`' search box was completely fake.** The `<Input placeholder="Search kennel or
  breed">` had no `value`, no `onChange`, and nothing in the component filtered on it — typing into
  it did literally nothing. This is exactly the "do not add fake filters" anti-pattern, found on a
  page I hadn't touched before this phase.
- **A kennel's own public updates had no home on its own profile** — organisations can author
  public posts (`posts.author_organization_id`), visible in the general community feed, but a
  breeder's public profile page had no "Updates"/"Posts" section at all, so a visitor Browse-ing
  straight to a kennel's profile (not via the feed) would never see any of its announcements.
- Everything else on the breeder profile was already strong: verification, association, experience,
  breeds, parent dogs, current/planned litters, champions (achievements), and correctly-worded
  empty states for every section ("No puppies available right now — check planned litters," "No
  planned litters yet," "No parent dogs listed yet," honest "Reviews aren't available yet — they
  open up once transports through Havenpaw start completing").

### Fixes applied

- **`/breeders`' search now actually filters** — matches kennel name, breeder name, breed list, city
  or country (same case-insensitive substring approach as `/find-a-dog`), with a distinct empty
  state ("no kennels yet" vs. "no kennels match your search," the latter with a "Clear search"
  button).
- **Added a real "Updates" tab to the breeder profile**, backed by a new `listPublicPostsByOrg(orgId)`
  query (`src/lib/queries/profile.ts`, mirroring the existing `listPublicPostsByAuthor` for
  individual profiles) — shows that kennel's own public posts with a correctly-empty "hasn't posted
  any public updates yet" state, not a missing/broken-looking gap.

### Checks run

`npx tsc --noEmit`, `npx eslint --fix` on all three changed files, `npm run test:unit` (13/13,
unaffected), `npm run build` — all clean.

## Phase 7 — Foundation and adoption experience

Reviewed `/foundations/$slug` against the same "priorities" list Phase 6 used for breeders, plus
the adoption-to-transport messaging requirements specific to foundations.

### Findings

- **Foundations had no "Updates" section**, the same gap Phase 6 found and fixed for breeders —
  now fixed identically here for consistency between the two organisation types.
- **The transport tab's copy didn't make the adoption-first sequencing explicit.** It said Havenpaw
  "can arrange transport for dogs adopted from this organisation" without stating that transport is
  only arranged *after* the organisation approves the adoption, is never booked automatically, and
  that the exact pickup/delivery address stays private — all real, already-true constraints
  elsewhere in the app, just not stated on this specific page.
- Everything else on the checklist was already correct: org-type wording (Phase 5), no implication
  every org is literally "a foundation" (the type badge already shows Foundation/Shelter/Rescue),
  no "donation" framing (already "adoption fee"), only published+available animals are ever shown,
  and the adoption action copy already frames applying as a first step, not a confirmed outcome.

### Fixes applied

- **Added the identical "Updates" tab** to the foundation profile (new `posts` loader field via the
  same `listPublicPostsByOrg`), with new `foundations.tabUpdates`/`foundations.noUpdatesPublished`
  keys (en + pl).
- **Rewrote `transportAvailableDesc`/`transportUnknownDesc`** to state the adoption-to-transport
  sequence explicitly: apply/ask first → transport only arranged after approval → never automatic →
  exact address stays private and is confirmed during the transport request itself.

### Checks run

`npx tsc --noEmit`, `npx eslint --fix` on the changed file, `npm run test:unit` (13/13 — including
the i18n parity test, confirming the new keys landed in both `en.json` and `pl.json`), `npm run
build` — all clean.

## Commit

Eight commits on branch `ux-marketplace-frontend-pass` (worktree branched from the current local
`ux-marketplace-polish` HEAD, not from stale `origin/main`): the original foundations/saved/followed
feature commit (1444e35), the hardening pass, the navigation-hierarchy pass, the discovery/search UX
pass, the card-system pass, the detail-page pass, the breeder-profile pass, and this foundation-
experience pass.

## Phase 8 — Public user profiles

Reviewed `/profile/$profileId` as the shared identity layer for every account type.

### Findings

- **Report-a-user is a real, existing capability** (`ReportDialog`'s `reasonLabels.user` already
  covers "scam or payment fraud"/"prohibited behaviour"/"something else") **but wasn't wired up
  anywhere a stranger would actually encounter another person's profile** — the one page this
  matters most for had no report entry point at all.
- Generic user-to-user messaging does not exist anywhere in this app (`messaging.ts` only supports
  `startApplicationConversation`/`startTransportConversation`, both tied to a specific
  animal/transport request) — so *not* showing a "Message" button on a public profile is the
  correct, honest choice, not a gap. Product rules already establish "first contact happens through
  Havenpaw" via an application, not an open DM.
- `PublicProfile` already selects every genuinely-available public column (`display_name`,
  `avatar_url`, `city`, `country`) — the `profiles` table has no bio/description or cover-image
  column at all, so their absence on this page is correct, not missing data.
- Professional-profile linking (kennel → `/breeders/$slug`, foundation/shelter/rescue →
  `/foundations/$slug`) was already fixed correctly in the Phase 1 hardening pass.

### Fixes applied

- **Added `ReportDialog` (`targetType="user"`)** to the profile header for any profile that isn't
  the signed-in user's own, next to (not blocking) the Follow button — using the exact same,
  already-existing report infrastructure the rest of the app relies on, wired to the one place it
  was missing.
- Restructured the header's action area so Follow (sign-in-gated) and Report (available to anyone,
  signed in or not, viewing someone else's profile) sit correctly: Follow only renders when signed
  in, Report renders for any visitor viewing another person's profile.

### Checks run

`npx tsc --noEmit`, `npx eslint --fix` on the changed file, `npm run test:unit` (13/13, unaffected),
`npm run build` — all clean.

## Commit

Nine commits on branch `ux-marketplace-frontend-pass` (worktree branched from the current local
`ux-marketplace-polish` HEAD, not from stale `origin/main`): the original foundations/saved/followed
feature commit (1444e35), the hardening pass, the navigation-hierarchy pass, the discovery/search UX
pass, the card-system pass, the detail-page pass, the breeder-profile pass, the foundation-
experience pass, and this public-profile pass.

## Phase 9 — Community feed quality

Reviewed `/community` (the main feed) against `/community/groups/$slug` (which already has a
report control) for consistency, plus general accessibility of the feed's interactive controls.

### Findings

- **The main community feed had no report control on posts at all**, even though `ReportDialog`
  already supports `targetType="post"` and is already used identically on the group-post feed
  (`_public.community.groups.$slug.tsx`) — an inconsistency between the two post-feed surfaces, not
  a missing capability.
- **Like and "show comments" buttons were icon+count only, with no accessible name** — a screen
  reader had nothing to announce beyond "button."
- Images/media in posts: confirmed the `posts` table has no image/media column at all (checked
  `src/lib/supabase/types.ts`) — there's no data to display, so this isn't a gap to fix, and adding
  one would be a schema change (out of bounds for this pass anyway). The existing code comment
  already documents this honestly.
- "Saved posts": no such feature exists anywhere in the app (no query, no UI, no schema column) —
  not fabricated.
- Post-type labelling, timestamps (fixed to the active locale in the Phase 1 hardening pass),
  followed-content ranking, and the empty state were all already solid.

### Fixes applied

- **Added `ReportDialog` (`targetType="post"`) to every post in the main feed**, matching the groups
  feed exactly.
- **Added `aria-label`/`aria-pressed`/`aria-expanded`** to the like and comment-toggle buttons.

### Checks run

`npx tsc --noEmit`, `npx eslint --fix` on the changed file, `npm run test:unit` (13/13, unaffected),
`npm run build` — all clean.

## Commit

Ten commits on branch `ux-marketplace-frontend-pass` (worktree branched from the current local
`ux-marketplace-polish` HEAD, not from stale `origin/main`): the original foundations/saved/followed
feature commit (1444e35), the hardening pass, the navigation-hierarchy pass, the discovery/search UX
pass, the card-system pass, the detail-page pass, the breeder-profile pass, the foundation-
experience pass, the public-profile pass, and this community-feed pass.

## Phase 10 — Community groups

Reviewed `/community/groups` and `/community/groups/$slug` for the same "failure must never look
like empty" and "honest empty state" bar applied everywhere else.

### Findings

- **`/community/groups` had no empty state and no error state at all.** `groupsQuery.data?.map(...)`
  on an empty or `undefined` array just renders nothing under the header — a genuinely-empty
  database and a failed query were both silently blank, with zero explanation to the visitor.
- **`/community/groups/$slug`'s post list had the identical gap**: `isLoading` was checked, but a
  failed `postsQuery` fell straight through to "No posts yet in this group," misrepresenting a real
  failure as a legitimate empty result.
- Reporting an individual group (as opposed to a post within it) isn't supported by `ReportDialog`
  today — `ReportTargetType` has no `"group"` variant, and adding one would mean touching the
  moderation enum/schema, out of bounds for this pass. Not fabricated; noted as a real backend
  dependency for later.
- Join/leave, member counts, group-type badges, the transport-route group's honest "create a
  structured transport request" CTA (not a fake parsed-from-text request), and post-level reporting
  within a group were all already correct.

### Fixes applied

- **`/community/groups`**: added a distinct error state ("Couldn't load groups... try again," with a
  working `refetch()` button) and a distinct empty state ("No groups exist yet — check back soon"),
  so a failure, an empty result, and a loading state are all now visually and textually different.
- **`/community/groups/$slug`**: same fix for the post list — a real query failure now shows
  "Couldn't load posts... this isn't the same as there being no posts yet" with a retry button,
  instead of silently reading as "No posts yet in this group."

### Checks run

`npx tsc --noEmit`, `npx eslint --fix` on both changed files, `npm run test:unit` (13/13,
unaffected), `npm run build` — all clean.

## Commit

Eleven commits on branch `ux-marketplace-frontend-pass` (worktree branched from the current local
`ux-marketplace-polish` HEAD, not from stale `origin/main`): the original foundations/saved/followed
feature commit (1444e35), the hardening pass, the navigation-hierarchy pass, the discovery/search UX
pass, the card-system pass, the detail-page pass, the breeder-profile pass, the foundation-
experience pass, the public-profile pass, the community-feed pass, and this groups pass.

## Phase 11 — Buyer dashboard frontend quality

Reviewed the buyer dashboard overview, applications, saved and followed pages.

### Findings

- **A real regression risk found while cross-checking Phase 1's `getPuppyById` scoping**:
  `dashboard.buyer.applications.tsx` and the buyer overview's applications preview both show *all*
  `buyer_applications` rows (`listMyApplications` has no `application_type` filter — it returns
  `"purchase"`, `"adoption"`, and `"rehoming_inquiry"` rows together), but both pages' "Open puppy"
  button unconditionally linked to `/puppies/$id` regardless of type. Since Phase 1 scoped
  `getPuppyById` to `listing_category = "breeder_puppy"` only, clicking "Open puppy" on any
  adoption/rehoming application would now hit a real 404 instead of the wrong-but-loading page it
  used to be. The applications page's own copy ("Every puppy application you've sent") was also
  factually incomplete once adoption/rehoming rows are included.
- **No page in the buyer dashboard checked `isError` on any query** (confirmed across
  `dashboard.buyer.index.tsx`, `dashboard.buyer.applications.tsx`,
  `dashboard.buyer.followed.tsx` — `dashboard.buyer.saved.tsx` already had it from the Phase 1
  hardening pass) — a failed fetch on any of them silently rendered as "None yet"/"No applications
  yet"/"Not following anyone yet," indistinguishable from a genuinely empty result.

### Fixes applied

- **Type-aware application routing**: both the dedicated applications page and the overview preview
  now link `"purchase"` applications to `/puppies/$id` ("Open puppy") and `"adoption"`/
  `"rehoming_inquiry"` applications to `/adoptions/$id` ("Open listing"), with the "Message
  breeder"/"Message organisation" button label and the page's own copy updated to match. The
  empty state now offers both "Browse puppies" and "Browse adoptions."
- **Added `isError` handling with a working retry action** to every query on
  `dashboard.buyer.index.tsx` (transport, applications, saved — via a small shared `SectionError`
  component) and `dashboard.buyer.followed.tsx` (breeders + foundations together), matching the
  pattern already established on the saved-animals page.

### Checks run

`npx tsc --noEmit`, `npx eslint --fix` on all three changed files, `npm run test:unit` (13/13,
unaffected), `npm run build` — all clean. The applications-routing fix in particular is a code-level
correction verified by reading `getPuppyById`'s actual scoping and `listMyApplications`'s actual
return shape side by side — not verified by clicking through a real signed-in session (no reachable
database in this environment; see the Phase 1 note on why one wasn't started here).

## Commit

Twelve commits on branch `ux-marketplace-frontend-pass` (worktree branched from the current local
`ux-marketplace-polish` HEAD, not from stale `origin/main`): the original foundations/saved/followed
feature commit (1444e35), the hardening pass, the navigation-hierarchy pass, the discovery/search UX
pass, the card-system pass, the detail-page pass, the breeder-profile pass, the foundation-
experience pass, the public-profile pass, the community-feed pass, the groups pass, and this buyer-
dashboard pass.

## Phase 12 — Localisation expansion (audit + parity, not a rewrite)

Reviewed every file touched across phases 1–11 for i18n coverage, consistency, and whether any page
ends up visibly mixing English and Polish.

### What's actually covered vs. not — stated honestly

The app's i18n architecture (`src/lib/i18n`) covers only a "small, demonstrated slice" by its own
design doc comment: the site header/footer, the homepage hero, and — as of this branch — the
foundations directory and profile pages. Every other page this branch touched (`/find-a-dog`,
`/find-your-dog`, `/breeders` + `/breeders/$slug`, `/adoptions/$id`, `/profile/$profileId`,
`/community` + `/community/groups*`, every `dashboard.buyer.*` page) was **already 100% hardcoded
English before this branch touched it**, and stays that way — consistent with how it already was,
not a regression. This branch did not attempt to translate all of it into Polish; that would be a
substantial standalone effort (dozens of files, hundreds of strings) beyond what "harden and audit
what this branch changed" calls for, and doing it half-heartedly (translating a random subset of
strings in an otherwise-English file) would produce exactly the "mixing languages on a page"
problem this phase is supposed to prevent — a file that's 95% hardcoded English with two mystery
translated fragments reads worse than a consistently-English file.

**The rule this branch actually followed, verified file-by-file this phase**: every *new* string
added to a page that was *already* on the i18n path (homepage, foundations pages) got real
English + Polish keys, immediately, in the same commit — never left as a hardcoded gap on an
otherwise-translated page. Every new string added to a page that was *not* on the i18n path stayed
in that page's existing (English-only) convention. Grepped every touched route file for
`useTranslation`/`t(` — confirmed zero pages have a *partial* mix (some `t()` calls alongside
hardcoded strings for equivalent content); a page is either fully on the i18n path or not at all.

One narrow, intentional exception: `_public.community.index.tsx`'s post timestamps (fixed in the
Phase 1 hardening pass) use `useTranslation()` only to read the active `locale` for
`toLocaleDateString`, not for any translated copy — so a Polish-locale visitor sees an English post
feed with Polish month abbreviations in timestamps (e.g. "23 lip 2026"). This was an explicit,
named requirement ("semantic time elements using the active locale rather than permanently
hardcoded en-GB"), and date-format locale is a different concern from content translation — not
treated as a new "mixing" bug.

### Parity checker

Already built in the Phase 1 hardening pass (`src/lib/i18n/completeness.ts`'s
`checkTranslationCompleteness()`, previously real code that nothing ever called, now exercised by
`tests/unit/i18n-completeness.test.ts`). Added a dedicated `npm run i18n:check` script this phase
(`node --test tests/unit/i18n-completeness.test.ts`) so it can be run on its own, not just as part
of the full `test:unit` suite — this is the "run it as a local command" deliverable.

### Quality check on existing Polish content

Re-read every Polish string added across this branch (`pl.json`) for natural phrasing and correct
grammar, not just structural key parity: verb/number agreement in the three-way plural set from
Phase 1 (`countSuffixOne/Few/Many`, `cardDogsForAdoptionOne/Few/Many` — checked `0`, `1`, `2`–`4`,
and `5+` all select the grammatically correct Polish form via `pluralCategory()`), and the
`logoAltPrefix` + name concatenation (`"Logo organizacji" + " " + name`) reads as correct Polish
word order. No machine-translation artifacts found.

### Checks run

`npx tsc --noEmit`, `npm run test:unit` (13/13, including the i18n parity test), `npm run i18n:check`
(new, 3/3), `npm run build` — all clean. No code changes this phase beyond the new package.json
script; the rest was verification, and this doc's honest account of what is and isn't translated.

## Commit

Thirteen commits on branch `ux-marketplace-frontend-pass` (worktree branched from the current local
`ux-marketplace-polish` HEAD, not from stale `origin/main`): the original foundations/saved/followed
feature commit (1444e35), the hardening pass, the navigation-hierarchy pass, the discovery/search UX
pass, the card-system pass, the detail-page pass, the breeder-profile pass, the foundation-
experience pass, the public-profile pass, the community-feed pass, the groups pass, the buyer-
dashboard pass, and this localisation-audit pass.

## Phase 13 — Accessibility pass

Systematically reviewed every one of the 18 route/component files touched across this branch (an
Explore agent pass covering icon-only buttons without accessible names, non-decorative images with
empty alt text, unlabelled form controls, fake-interactive `<div>`/`<span onClick>`, heading-order
skips, and dialog/sheet title presence), then fixed everything it found real.

### Findings

- **Five search/composer inputs relied on `placeholder` as their only accessible name**: the
  adoption-interest `<Textarea>` (label present but not programmatically linked via `htmlFor`/`id`),
  `/breeders`' new search `<Input>`, `/find-a-dog`'s search `<Input>`, and two community composers
  (main feed post box, per-post comment box).
- **`find-a-dog.tsx`'s Breed/Country `<Select>`, Price `<Slider>` and Collection-ready-from
  `<Input>`** each sit under a visible `<Label>` (via the shared `FilterGroup`) that isn't
  programmatically associated with the control it labels — a sighted user sees "Breed" next to a
  dropdown, a screen reader user hears only "combobox."
- **The community feed's send-comment button was icon-only** (`<Send>`) with no `aria-label`,
  inconsistent with the like/comment-toggle buttons in the same file which already had one.
- **`breeders.$slug.tsx` skipped from `<h1>` straight to `<h4>`** in the Parent Dogs and Champions
  tab panels — every other tab on the same page uses `<h3>` for its section/card titles (there's no
  `<h2>` anywhere on the page), so those two tabs' `<h4>`s were an unexplained, inconsistent jump
  past a heading level the rest of the page uses.
- Checked but not flagged: all icon-only buttons in `cards.tsx` and `site-chrome.tsx` already had
  `aria-label`; all cover/background images with `alt=""` are genuinely decorative (paired with a
  visible name/heading, or a gradient-overlay hero image); no fake `onClick`-on-`<div>` interactive
  elements found anywhere; every `Dialog`/`Sheet` already includes its required `DialogTitle`/
  `SheetTitle`.

### Fixes applied

- Added `htmlFor`/`id` pairing to the adoption-interest label/textarea; added `aria-label` matching
  the visible/placeholder text to the four other unlabelled inputs, the four `find-a-dog.tsx` filter
  controls, and the send-comment button.
- Changed the two stray `<h4>`s in `breeders.$slug.tsx` to `<h3>`, matching the heading level every
  other tab on that page already uses.

### Checks run

`npx tsc --noEmit`, `npx eslint --fix` on all six changed files, `npm run test:unit` (13/13,
unaffected), `npm run build` — all clean. This is a code-level accessibility review (verified by
reading the actual markup/attributes), not a screen-reader or automated-axe browser run — no browser
was available in this environment; genuine assistive-technology testing remains a manual follow-up.

## Commit

Fourteen commits on branch `ux-marketplace-frontend-pass` (worktree branched from the current local
`ux-marketplace-polish` HEAD, not from stale `origin/main`): the original foundations/saved/followed
feature commit (1444e35), the hardening pass, the navigation-hierarchy pass, the discovery/search UX
pass, the card-system pass, the detail-page pass, the breeder-profile pass, the foundation-
experience pass, the public-profile pass, the community-feed pass, the groups pass, the buyer-
dashboard pass, the localisation-audit pass, and this accessibility pass.

## Phase 14 — Mobile/responsive pass

Code-level review (Explore-agent pass + manual verification) of all 17 files touched across this
branch for concrete Tailwind responsive-layout risks: missing `flex-wrap` on multi-item rows, fixed
pixel widths outside a scroll container, non-wrapping long text next to fixed-width siblings, and
grids without a mobile column step.

### Findings and fixes applied

- **`find-a-dog.tsx`'s results toolbar** (sort dropdown + separator + grid/list/map-view buttons)
  had no `flex-wrap` on the inner row — on a 320–375px screen the ~180px sort select plus four more
  controls doesn't fit on one line. Added `flex-wrap` and narrowed the select to `w-[150px]
  sm:w-[180px]`.
- **`find-your-dog.tsx`'s transport-preference step** used the same `grid-cols-2` as the other three
  guided-search steps, but its two options are full sentences ("Yes, show only puppies with
  transport available") rather than short labels — cramped into ~140px columns on a narrow phone.
  Changed to `grid-cols-1 sm:grid-cols-2`; left the other three steps (short labels/names) as
  `grid-cols-2`, which fit fine.
- **`breeders.$slug.tsx`'s hero action-button row** ("Contact breeder" + "Follow kennel," both
  `size="lg"` icon+text) had no `flex-wrap` — the exact gap already fixed on the equivalent
  foundation-profile row in the Phase 1 hardening pass, just not carried over to breeders at the
  time. Fixed identically. While in this exact row, also fixed the same misleading-action pattern
  Phase 1 fixed for foundations and explicitly deferred for breeders as out of that commit's scope:
  "Contact breeder" didn't contact anyone, it only switched the active tab — reworded to "View
  available puppies" with a matching icon (`Dog`, replacing the messaging-implying `MessageCircle`).
- **`cards.tsx`: `PuppyCard`, `AdoptionCard` and `BreederCard`'s name+price/response-time header row**
  had no `min-w-0`/`break-words` on the name side or `shrink-0` on the fixed-content side —
  `FoundationCard` already had this guard (added when it was built in the original commit) but the
  other three, older cards didn't. Applied the same guard to all three for a long, real kennel/
  breed/animal name.
- **`dashboard.buyer.followed.tsx`'s `OrgTile`** (name + optional org-type badge) had the identical
  gap — added `flex-wrap`, `min-w-0`/`break-words` on the name, `shrink-0` on the badge, matching the
  sibling `AnimalTile` in `dashboard.buyer.saved.tsx`, which already had this guard.

### Manual review checklist (routes/viewports still needing an actual browser check)

Browser execution was not available in this environment (see Phase 1's note); every fix above was
verified by reading the rendered Tailwind classes, not by measuring a real layout. The following
routes are the highest-value candidates for a manual pass at 320px, 360px, 390px, tablet and desktop
before this branch ships:

- `/find-a-dog` — mobile filter Sheet open/close, results-toolbar wrapping, list-view row at 320px.
- `/find-your-dog` — all four guided-search steps, especially the now-single-column transport step.
- `/breeders/$slug` and `/foundations/$slug` — hero action-button row wrapping, `TabsList` overflow
  with the fullest tab set (Champions present, Updates tab, long kennel/foundation name).
- `/adoptions/$id` — image gallery + sidebar stacking order at narrow widths.
- `dashboard/buyer/followed` and `dashboard/buyer/saved` — tile grid at 320px with a genuinely long
  real name.
- Community feed and group post composer inputs — on-screen keyboard behavior with the new
  `aria-label`s (Phase 13) and existing `rows={1}`/`rows={3}` textareas.

### Checks run

`npx tsc --noEmit`, `npx eslint --fix` on all five changed files, `npm run test:unit` (13/13,
unaffected), `npm run build` — all clean.

## Commit

Fifteen commits on branch `ux-marketplace-frontend-pass` (worktree branched from the current local
`ux-marketplace-polish` HEAD, not from stale `origin/main`): the original foundations/saved/followed
feature commit (1444e35), the hardening pass, the navigation-hierarchy pass, the discovery/search UX
pass, the card-system pass, the detail-page pass, the breeder-profile pass, the foundation-
experience pass, the public-profile pass, the community-feed pass, the groups pass, the buyer-
dashboard pass, the localisation-audit pass, the accessibility pass, and this mobile/responsive
pass.

## Phase 15 — Loading, errors and resilience

Cross-checked every `useQuery` call in every touched public route against whether it has an
`isError` branch, to find any remaining place where a real failure could still silently read as a
legitimate empty result.

### Findings

- **The main community feed's primary content query had no error state.** `postsQuery.data ?? []`
  meant a failed fetch and a genuinely-empty feed both rendered the identical "No posts yet — be the
  first to share something" empty state — the single most-visited page this branch touches, showing
  its most important failure mode as if nothing were wrong.
- **Several supporting queries remain without a dedicated error UI on purpose, not by oversight**:
  "am I already following this breeder/foundation/profile" checks (`breeders.$slug.tsx`,
  `foundations.$slug.tsx`, `profile.$profileId.tsx`), "am I already a member of this group"
  (`community.groups.$slug.tsx`), and "have I already applied to this animal"
  (`adoptions.$id.tsx`). Each of these is a secondary state check, not primary content: a failure
  just means the follow/join/apply button might show its "not yet" state even if the user already
  is — annoying but not data-hiding, and in the apply/follow cases the underlying mutation already
  has its own duplicate-detection safety net (`followOrg`/`joinGroup` treat a duplicate insert as a
  no-op; the adoption interest mutation explicitly catches a duplicate-key error and tells the user
  they'd already applied). Adding a full error-state UI to each of these small boolean checks would
  be disproportionate to the actual risk.
- Mutation rollback: none of the mutations in this app perform an optimistic update, so there is
  nothing to roll back — not a gap, just not applicable here.
- Broken/missing images (a valid database row whose stored image URL 404s, as opposed to no image
  existing at all — the latter already falls back to a placeholder in every mapper function): no
  `<img onError>` fallback exists anywhere in the app. This is a real, pre-existing gap across the
  whole codebase, not something introduced or specific to this branch's files — flagged as a
  worthwhile follow-up rather than fixed here, since verifying an image-load-failure fallback
  actually renders correctly needs a real browser, which this environment doesn't have.

### Fixes applied

- **Added a real error state to the community feed's post query**, with a working `refetch()` retry
  button, matching the pattern already used everywhere else this branch touched.

### Checks run

`npx tsc --noEmit`, `npx eslint --fix` on the changed file, `npm run test:unit` (13/13, unaffected),
`npm run build` — all clean.

## Commit

Sixteen commits on branch `ux-marketplace-frontend-pass` (worktree branched from the current local
`ux-marketplace-polish` HEAD, not from stale `origin/main`): the original foundations/saved/followed
feature commit (1444e35), the hardening pass, the navigation-hierarchy pass, the discovery/search UX
pass, the card-system pass, the detail-page pass, the breeder-profile pass, the foundation-
experience pass, the public-profile pass, the community-feed pass, the groups pass, the buyer-
dashboard pass, the localisation-audit pass, the accessibility pass, the mobile/responsive pass, and
this resilience pass.
