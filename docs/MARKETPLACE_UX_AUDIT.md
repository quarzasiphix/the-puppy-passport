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

## Commit

Two commits on branch `ux-marketplace-frontend-pass` (worktree branched from the current local
`ux-marketplace-polish` HEAD, not from stale `origin/main`): the original foundations/saved/followed
feature commit (1444e35), and this hardening pass.
