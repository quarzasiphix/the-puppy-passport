# Frontend user journeys — audited against real code this session

Each journey below was walked through by reading the actual loader/component/mutation code for
every step (not a live browser — see `docs/FRONTEND_BROWSER_QA.md` for why), verifying links resolve
to real routes, states are distinguished honestly, and mobile/signed-out behavior is handled.

## Buyer: find and apply for a puppy

1. Homepage → real Supabase counts, `/find-a-dog` CTA. ✅
2. `/find-a-dog` → data-derived filters, honest empty/no-match distinction, mobile filter sheet. ✅
3. Puppy detail (`/puppies/$id`) → gallery (accessible thumbnails, broken-image fallback), litter/
   parent tabs, breeder card, transport estimate tool. ✅
4. Save → `useIsSaved`, cross-invalidates `saved-animal-ids`/`my-saved-animals`. ✅
5. Apply → `ApplyDialog`, duplicate-application check before showing the form. ✅
6. Dashboard (`/dashboard/buyer`) → applications/saved/transport previews, all now with `isError`
   states distinguishing failure from "none yet" (fixed this session for reservations/quotations/
   messages; applications/saved/followed already had it). ✅
7. Withdraw an application → now requires confirmation (fixed this session). ✅

## Adopter: browse organisations and adopt

1. `/foundations` → directory, correct foundation/shelter/rescue terminology, real `is_public`+
   `verification_status` scoping (this session found and fixed the equivalent gap in the *breeder*
   directory's direct-slug lookup, `getKennelBySlug` — the foundation lookup was already correct).
2. `/foundations/$slug` → About/Available for adoption/Updates/Transport/Contact tabs, follow,
   report, real photo gallery with broken-image fallback (this session).
3. `/adoptions/$id` → org-type-aware verification badge, private-rehoming-specific copy, transport
   CTA, photo gallery (added this session, previously showed only the first photo).
4. Apply/express interest → duplicate-check, honest "not confirmed yet" copy distinguishing
   submitted vs. accepted.

## Private rehoming

1. Discovery — appears in `/adoptions` alongside org listings but visually distinct (`Private
   rehoming` badge, never the verified-organisation badge).
2. Detail page — "Ask about rehoming" instead of "I'm interested in adopting," "Rehoming fee" instead
   of "Adoption fee," org name shown as plain text (no foundation-profile link) since there's no
   organisation behind it.
3. `/rehome` submission form — all 8 previously-unlabelled fields fixed (earlier phase this branch).

## Breeder discovery

1. `/breeders` → directory with a real (previously non-functional, fixed earlier this branch) search
   box.
2. `/breeders/$slug` → About/Parent Dogs/Champions/Puppies/Litters/Updates tabs, "View available
   puppies" (fixed earlier — was misleadingly labelled "Contact breeder" and just switched tabs).
3. Planned litter card → links to the specific breeder's profile (fixed earlier — previously always
   linked to the generic litters index regardless of which litter was clicked).

## Community

1. `/community` feed → real error/empty/loading distinction, followed-content section (now
   correctly updates immediately after following someone from their profile page — fixed this
   session), locale-aware timestamps.
2. Author link → routes to the correct profile type (kennel → `/breeders/$slug`, foundation/shelter/
   rescue → `/foundations/$slug`, person → `/profile/$profileId`) via `orgProfileRoute`/
   `isFoundationOrgType`.
3. `/community/groups` → directory + detail, join/leave, honest error states (fixed earlier this
   branch — a query failure previously read as "no groups").

## Backend-dependent steps not testable from this frontend session

- Real sign-in/sign-up round trip (no local Supabase instance reachable in this sandbox this
  session — see `docs/FRONTEND_BROWSER_QA.md`).
- Backend-owned transport quotation/scheduling flow past the buyer-facing quotations page (read-only
  from this branch).
- Actual database-level RLS enforcement (verified defensively at the query layer per
  `docs/FRONTEND_BACKEND_GAPS.md`'s "Owner-preview vs. public detail pages" section, not re-tested
  live).
