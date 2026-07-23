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

## Commit

One commit on branch `ux-marketplace-frontend-pass` (worktree branched from the current local
`ux-marketplace-polish` HEAD, not from stale `origin/main`).
