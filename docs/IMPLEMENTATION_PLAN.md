# Havenpaw — Implementation Plan

Phased build order. **Status below was rewritten 2026-07-22 against the actual code and
`docs/MVP_TEST_REPORT.md`/`docs/PRODUCTION_READINESS_REPORT.md`, which are the source of truth for
"what works today."** A much earlier version of this file described phases 5–9 as "Not built" —
that was wrong by the time it was last read; all of them have real Supabase-backed implementations
now, verified end-to-end with authenticated API calls and cross-tenant negative tests (see
`MVP_TEST_REPORT.md`). Don't trust prose status claims over the code — grep for `mock-data` imports
and `NotImplemented` usage under `src/routes` to see the real current state directly.

## 1. Project foundation
TanStack Start app, shadcn/Radix component library, routing, styling — **done**, inherited from the
original visual prototype and preserved as-is throughout every later phase.

## 2. Local database
**Done.** `supabase/config.toml`, 54 ordered migrations, `supabase/seed.sql`, `.env.example`,
`docs/LOCAL_SETUP.md`. Migrations have actually been run against a local Docker/Supabase stack
(not just self-reviewed) — RLS swept schema-wide, every table has `rowsecurity = true` and at least
one policy. See `DECISIONS.md` for the browser/server Supabase client split.

## 3. Accounts and roles
**Working end to end.** Email/password sign up/in/out, session hydration, role-gated dashboard
redirects (`profiles`, `user_roles`, `organisations`, `organisation_members`, `user_verifications`,
`private_addresses` — see `DOMAIN_MODEL.md`). **Requires external configuration**: Google/Facebook
OAuth buttons exist and call `signInWithOAuth`, but show an honest "not configured" toast — no
provider credentials exist (`docs/SOCIAL_AUTH_SETUP.md`). **Not implemented**: password reset,
session-expiry handling, a dedicated multi-step onboarding flow, an account-status page.

## 4. Transport requests
**Working end to end.** The 7-step public request form writes a real `transport_requests` row +
`transport_status_history`; customer dashboards show real request lists with plain-language status.
**Partially implemented**: animal and party data on a transport request is currently an inline
snapshot on `transport_requests`. A dedicated `public.transport_parties` table (legal_owner/
requester/sender/recipient/payer/pickup_contact/delivery_contact, including non-Havenpaw external
contacts) **already exists in the schema with real RLS**
(`20260101002400_animals_transport_fields.sql`) — confirmed by reading the migration directly, this
document previously and incorrectly said it didn't exist yet — but no UI or query layer uses it.
The real remaining work is wiring the 7-step form and ops tooling to it, not building it. Draft
save/resume/edit/delete before submission is **not implemented**.

**Fast, no-account entry point — already existed, connection gap fixed 2026-07-22.**
`/estimate` (`_public.estimate.tsx`) already covered most of "fast standalone transport post":
pickup/destination country, animal size, service type, no sign-up, shows an approximate price range
plus a real "a planned shared route already heads that way" match (`findLikelyRouteMatch`) — all in
4 fields, well under a minute. The real gap: "Continue with full request" linked to
`/transport/request` with **no data carried over**, discarding everything just entered. Fixed by
passing pickup/destination/size/service as URL search params and reading them in a new, unconditional
(not gated on sign-in) `useEffect` in `_public.transport.request.tsx`, mirroring the existing
`?animalId=` prefill pattern. Not independently visually verified in a live browser (client-side
hydration state, same sandbox limitation as `docs/E2E_TESTING.md`) — code-reviewed against the
already-working `animalId` prefill pattern it mirrors, `tsc`/`eslint` clean. **Still not built**:
exact date/flexible-dates fields on `/estimate` itself (only country/size/service), and animal
type beyond dog (tracks the multi-species backlog, phase 15).

## 5. Transport operations
**Working end to end.** Ops/admin dispatch dashboard (`dashboard.operations.dispatch.tsx`), request
detail page with documents/compliance/quotations/status history/route assignment/messages/internal
notes (`dashboard.operations.requests.$id.tsx`), status-changing actions that write status history
+ audit records. **Placeholder**: the operations calendar (`dashboard.operations.calendar.tsx`) is
an honest `NotImplemented` page — dispatch currently has no calendar/timeline surface, even though
the underlying route/vehicle/driver/matching data it would draw on already exists and is real.

## 6. Route planning
**Working end to end.** `routes`/`route_stops`/`route_assignments`/`vehicles`/`drivers` tables, a
real ops UI for routes/vehicles/drivers (`dashboard.operations.routes.tsx`,
`dashboard.operations.routes.$id.tsx`), and a public-safe planned-route listing (`/planned-routes`).

## 7. Matching engine
**Working end to end.** Deterministic, explainable, non-generative scoring of request↔route
compatibility (date/region/capacity/crate/document/compliance) at
`dashboard.operations.matching.tsx`, producing `strong_match`/`possible_match`/`manual_review`/
`blocked` with visible blocking reasons — recommendations only, writes to `audit_logs`, never an
automatic assignment.

## 8. Breeder discovery
**Working end to end.** `/breeder-map` (privacy-reduced public locations only — exact addresses
stay in `private_addresses`) and `/find-your-dog` (a guided questionnaire producing "potential
match based on the information provided" results, never a guarantee), plus breeder achievement and
verified-champion-dog profiles.

## 9. Marketplace
**Working end to end.** `/find-a-dog`, `/puppies/$id`, `/breeders`, `/breeders/$slug`,
`/planned-litters` and homepage stats all query Supabase directly — confirmed by grep, zero
`mock-data.ts` imports remain in any of these pages. (`src/components/cards.tsx` still imports
`Puppy`/`Litter`/`Breeder` **types** from `mock-data.ts` — a naming/type-source detail, not a data
source; the card components themselves render real query results.) Publication-category
restrictions are enforced by RLS, not just UI filtering.

**Purchase→transport journey fix, 2026-07-22**: the buyer reservations page
(`dashboard.buyer.reservations.tsx`) already linked "Request transport" with the animal pre-filled
(`/transport/request?animalId=...` — reuse of known data was already correct), but had a real gap:
once submitted, the page kept showing the same "Request transport" button forever, with no
acknowledgement a request already existed. `findActiveTransportRequestForAnimal` existed in
`src/lib/queries/transport.ts` but was only ever used inside the request form itself, never on this
page. Added a batched version (`findActiveTransportRequestsForAnimals`) and wired it in: a
confirmed reservation with an existing transport request now shows its real plain-language
milestone (reusing `transportMilestones`/`nextActionForStatus`, not raw status codes) and a link to
`/dashboard/buyer/transport`, instead of a button that looks like nothing happened. Verified against
the real API (created a real transport request for a seeded reservation's animal, confirmed the
exact query the page uses finds it, cleaned up).

## 10. Compliance and documents
**Partially implemented.** `transport_documents` and `compliance_reviews` exist and are used by the
ops request-detail page; two storage buckets (`kennel-media` public, `transport-documents` private)
exist with RLS/access-policy verified directly against the storage API (see
`PRODUCTION_READINESS_REPORT.md`). **Placeholder**: no customer-facing document library or upload
UI exists yet for breeder/buyer/foundation/operations
(`dashboard.{breeder,buyer,foundation,operations}.documents.tsx` are all honest `NotImplemented`
pages) — the storage layer those would sit on top of is real, but nothing has been uploaded through
the app itself yet. A `legal_requirements` table is deliberately not built — see `DECISIONS.md` on
never inventing a legal database without a source URL + review date.

## 11. Foundations
**Working end to end.** Foundation dashboard (adoption listings, transport requests, applications
inbox), public `/adoptions` + `/adoptions/$id` with first-contact "express interest", private
rehoming (`/rehome`) with an admin approval queue and RLS-enforced invisibility until approved.
**Placeholder**: `dashboard.foundation.urgent.tsx` (welfare-urgent flag/intake) and
`dashboard.foundation.team.tsx` (volunteer/staff invitation) are both honest `NotImplemented` pages.

## 12. Community
**Partially implemented.** Public post feed, like, comment are real data (`_public.community.tsx`),
not mocked. **Added 2026-07-22**: a public profile page (`/profile/$profileId`,
`src/routes/_public.profile.$profileId.tsx`) for any individual user — avatar, display name, city/
country (only the columns anon/authenticated are actually granted, never email/phone), their public
posts, a link into their kennel's full profile if they own one, and a follow/unfollow button using
`follows.followed_profile_id` (previously fully supported in the schema but with zero UI — only
org-following existed before). Community post/comment author names now link there. **Still not
implemented**: general user-to-user messaging outside the existing relationship-gated RPCs
(`start_application_conversation`/`start_transport_conversation`) — no message requests, accept/
decline, block, or mute exist; a richer profile portfolio (animals, achievements, reviews) beyond
posts; a public detail page for foundations (`getKennelBySlug` is kennel-only — `/foundations` has
no equivalent to `/breeders/$slug`). These were deliberately deferred rather than rushed — general
messaging in particular needs real spam/harassment safeguards designed on purpose, not bolted on.
**Added 2026-07-22 (feed quality pass)**: post-type badges (litter announcement, adoption,
achievement, transport update, planned route — `post_type` already existed in the schema but the
feed only ever rendered/created `'general'` posts before) and a real, honest first pass at
recommendation — posts from profiles/kennels you follow now surface in their own "From people and
kennels you follow" section above the rest, using real `follows` data, clearly labelled as such
rather than presented as a sophisticated algorithm. **Still not built**: linked-content previews
(a post with `linked_animal_id`/`linked_transport_request_id`/`linked_route_id` set doesn't render
any preview of that animal/transport/route — no seed data exercises this yet, and joining
transport_requests safely for a public feed needs its own deliberate design, not an ad-hoc join);
interest/topic preferences (species, breeds, exhibitions, transport, local, etc.) and any signal
beyond "who you follow" (location, saved searches, viewed/saved animals, joined groups) — no schema
or settings UI exists for these.
**Community groups — built 2026-07-22.** `/community/groups` (list, join/leave) and
`/community/groups/$slug` (detail, group-scoped posting, reporting) are real, working pages.
11 default groups seeded via migration (breed communities, breeders, foundations & rescue,
adoption, Poland↔Netherlands transport, Poland↔Germany transport, shared transport, exhibitions,
rabbits/small mammals, cats/catteries — `20260101005400_groups.sql`). Fixed two real bugs found
while building this: (1) `posts`/`comments` had no SELECT policy at all for `visibility = 'group'`
rows beyond the author themselves — a fellow group member could never read another member's post;
added `is_group_member()`-gated policies. (2) `group_members` had no anon grant/policy, so the
group detail page's member count crashed anonymous visitors with a 401 — added anon read access,
matching the already-public `groups` table. Verified end-to-end: join (201), a group-only post
correctly invisible to a non-member (empty result) and correctly visible after joining, exactly as
RLS intends. Transport-route-type groups get a "Request transport for this route" button plus copy
steering users to submit a real transport request instead of leaving a need as unsearchable text —
deliberately a manual CTA, not AI-parsed text-to-structured-data extraction (out of scope/unsafe to
rush). **Not built**: group roles beyond member/moderator (no promote/demote UI), pinned
posts/group-specific rules text, moderation queue specifically for group content (reuses the
existing generic report → moderation_cases flow, which works but isn't group-aware).

## 13. Verified-organisation fundraising
**Built 2026-07-22** — schema, RLS, query layer, org/admin/public UI, all real and tested, kept
**disabled by default behind `VITE_FUNDRAISING_ENABLED`** (`src/lib/fundraising-flag.ts`) until a
real payment provider, refund rules and legal texts are approved — see `docs/FUNDRAISING_POLICY.md`
for the full policy this implementation follows, and `docs/DATABASE_TESTING.md` /
`tests/db/fundraising.test.ts` for the security test coverage. Corresponds to hierarchy pillar 7 in
`docs/PRODUCT_VISION.md`.

**What's real**: `fundraising_campaigns` + `fundraising_contributions` tables
(`20260101005600_fundraising.sql`), gated to `org_type in ('foundation','shelter','rescue')` +
`verification_status = 'approved'` only (never kennels); a campaign requires a real animal owned
by that org, a real adoption/rehoming application (never `purchase`), a real transport request and
an *accepted* quotation, enforced by a shared `fundraising_campaign_links_are_valid()` function used
identically on insert and update (not just at creation time); one non-terminal campaign per
quotation (unique index); the campaign's animal/transport/quotation/organisation is locked by a
trigger once a completed contribution exists; only `is_simulated = true` contributions can be
created at all (no real payment path exists); anonymity (`display_publicly = false`) hides a
contribution's attribution from the public per-row view but **not** from the campaign total — a
separate `public_fundraising_totals` aggregate view exists specifically so an anonymous
contribution still counts toward "target reached" (found and fixed during this build: the naive
approach of computing the total from the same privacy-filtered view undercounted anonymous
contributions). Org self-service is deliberately narrow: an org can move their own campaign through
draft/organisation_review/active/expired/transport_cancelled, but only admin can set
approved/suspended/refund_review/completed, and **organisations have no DELETE policy on
campaigns at all** — a campaign moves through states, it never just disappears (found while writing
the tests: attempting to delete as the org silently affects zero rows, not an error).

**UI**: `dashboard.foundation.fundraising` (org: create from an eligible accepted-quotation
picker, submit for review, view contributions), `dashboard.admin.fundraising` (approve/activate/
suspend), `/fundraising` (public list + detail with a development-only simulated-contribution
form, clearly labelled, never available in production). Two real bugs found and fixed while
building this against the real local API (not assumed from reading SQL): (1) the public
campaign query originally embedded `transport_requests` directly for route display — anon has no
grant on that table at all, so this failed with a real "permission denied" the first time an
anonymous visitor loaded the page; fixed by querying the existing `public_transport_requests` view
separately instead. (2) the amount-collected aggregation originally read
`fundraising_contributions` directly — same anon-grant problem, plus it would have silently
undercounted anonymous contributions even for authenticated readers; fixed with the dedicated
`public_fundraising_totals` view described above.

**Not built**: real payment provider integration (by design, this phase), a UI for the
excess-funds/refund/dispute states beyond the schema supporting them, and email notifications when
a campaign changes state.

## 14. Internationalisation
**Not started beyond schema readiness** — confirmed by code inspection, no localisation library
(i18next, react-intl, etc.) or locale-resource files exist anywhere in `src/`.
`profiles.preferred_language`/`preferred_currency` exist as columns; `country`/`currency` are plain
text fields everywhere rather than hardcoded enums specifically so this doesn't require a schema
rewrite later. All customer-facing copy today is English only. Initial operational focus stays
Poland/Germany/Netherlands/Belgium, Polish/English, PLN/EUR — see `PRODUCT_VISION.md`.

## 15. Multi-species support
**Schema foundation done (2026-07-22), everything else not started.** A `species` reference table
(`20260101005300_species.sql`) with 5 enabled species (dog, cat, rabbit, guinea pig, other small
companion mammal) and 5 deliberately disabled future ones (bird, reptile/amphibian, fish, exotic,
horse — real rows, never publicly selectable until a dedicated workflow exists), plus `species_id`
on `breeds` and `animals`, both defaulting to 'dog' via a fixed row id so every existing insert path
(puppy/litter forms, rehoming, transport's inline snapshot) needed zero changes and keeps working
exactly as before — verified with a full `supabase db reset` and the complete `test:db` suite,
both clean. **Not built**: every animal-facing flow is still dog-specific in its UI (kennel/puppy/
litter language, dog-specific health fields, no species picker anywhere); no cattery/cat-litter/
kitten model exists yet (a real cat "parent"/litter model needs its own tables — `parent_dogs` stays
dog-only, not repurposed); no rabbit/guinea-pig-specific fields (size/weight, social needs, housing,
diet, behaviour, transport sensitivity) exist; no configurable per-species field/document/
eligibility model exists — `species_id` is currently just a tag, nothing reads it yet. This was a
deliberate scope decision for this pass: a full multi-species UI buildout is a substantial,
multi-part effort that deserves its own dedicated pass per species rather than being rushed
alongside everything else queued this session — see the prioritised backlog.

## 16. Animal-related products/services architecture
**Schema-only, entirely disabled, built 2026-07-22.** A `product_service_categories` reference
table (`20260101005700_product_service_categories.sql`) with 14 real but `enabled = false` rows
(animal food, accessories, carriers/crates, kennel equipment, aquariums/terrariums, equestrian
equipment, transport trailers, veterinary services, trainers, behaviourists, groomers, pet hotels,
photographers, exhibitions/events) — a fixed, deliberately-scoped list; cars/electronics/furniture/
tools are never acceptable additions here (see `docs/PRODUCT_VISION.md` "It is not: a general
marketplace"). Each row has a `config jsonb` column for the eventual per-category
listing-fields/seller-eligibility/moderation-level/legal-requirements/transaction-actions/delivery-
options shape — deliberately a single flexible column rather than five real normalised tables,
since nothing currently reads or writes them and building real tables for a feature with zero
consumers would be premature abstraction (see CLAUDE.md). Confirmed anon sees zero rows (all
disabled) and admin sees all 14. **Not built, and not started until the animal marketplace itself
is stable per this phase's own brief**: any listing table, query layer, or UI for any category —
this is architecture preparation only, matching hierarchy pillar 8's framing as a real but
not-yet-committed differentiator.

## 17. Future integrations
Explicitly out of scope until the above phases are further along: AI-assisted matching/pricing/
translation/fraud-detection, insurance, instalment credit, escrow payments, online training, an
exhibition calendar, a European market/locale registry. Kept on the list (`PRODUCT_VISION.md`), not
committed.

---

## Prioritised backlog (real missing functionality, ordered by launch risk / dependency)

1. **Fix the four open findings in `docs/DATABASE_TESTING.md`** — real, currently-open bugs (a
   customer can change their own transport request's operational status; suspending a breeder's
   role doesn't revoke org-management access; the org-owner-notify-applicant path fails outright;
   a column-shadowing bug blocks assigned drivers from their own job's documents in Storage). Each
   has a deliberately-failing regression test already written — fixing the bug flips the test, not
   the other way around.
2. **Automated tests** — a Playwright auth spec and a Node-based DB/API regression suite
   (`tests/db/`, `npm run test:db`) exist as of 2026-07-22; everything else is still manually
   verified only (see `docs/MVP_TEST_REPORT.md` §5, `docs/E2E_TESTING.md`, `docs/DATABASE_TESTING.md`).
3. **Production Supabase project + production Cloudflare deployment** — business/account steps, not
   code; procedures documented in `docs/PRODUCTION_SETUP.md`/`docs/DEPLOYMENT_CHECKLIST.md` but not
   yet executed.
4. **Legal text finalisation** (`/terms`, `/privacy`, `/cookies`) — needs a real registered business
   entity and lawyer review before further code work there is useful.
5. **Transport data-model decision**: the snapshot-on-`transport_requests` vs. dedicated
   `transport_parties` question (phase 4 above) is **less open than earlier versions of this
   document claimed** — `public.transport_parties` (legal_owner/requester/sender/recipient/payer/
   pickup_contact/delivery_contact, including external non-Havenpaw contacts) already exists in the
   schema with real RLS (`20260101002400_animals_transport_fields.sql`), just entirely unused by any
   UI. The remaining decision is narrower: wire the 7-step transport form and ops tooling to actually
   use this table instead of (or alongside) the inline snapshot fields — not whether to build it.
6. **Operations calendar** (phase 5) — day/week/route views over already-real route/vehicle/driver/
   matching data.
7. **Document library / upload UI** (phase 10) — the storage layer is verified and ready; no
   customer-facing or ops-facing UI exists yet.
8. **Notification preferences** — currently all-or-nothing; only a "coming soon" placeholder exists
   on breeder/foundation settings pages.
9. **Foundation welfare-urgent flow and team/volunteer management** (phase 11) — both honest
   placeholders today.
10. **Full adoption/rehoming application questionnaire** — currently simplified to a first-contact
    message; puppy-purchase applications already have the full multi-step questionnaire as the
    template to extend from.
11. **Community groups** (phase 12) — schema exists, zero UI.
11a. **General user-to-user messaging** (phase 12) — message requests/accept/decline/block/mute
    beyond the existing relationship-gated conversation RPCs; needs deliberate spam/harassment
    safeguards designed up front, not bolted on. **Foundation public detail page** — `/foundations`
    has no equivalent to `/breeders/$slug`.
12. **Multi-species UI buildout** (phase 15) — the `species` reference table + `species_id` schema
    foundation landed 2026-07-22 (see phase 15 above), but no UI, no cattery/cat-litter/kitten
    model, no rabbit/guinea-pig-specific fields, and no configurable per-species field/document/
    eligibility model exist yet — each species deserves its own dedicated design pass rather than
    one universal animal form.
13. **Internationalisation** (phase 14) — genuinely not started beyond schema readiness; a
    significant, deliberate architectural effort (locale/translation infrastructure) that should get
    its own design pass rather than being bolted on ad hoc.
14. **Verified-organisation fundraising module** (phase 13) — policy is fully defined
    (`docs/FUNDRAISING_POLICY.md`), no schema/RLS/UI exists yet; stays behind a feature flag until a
    payment provider, refund rules and legal texts are approved.
15. **Accessibility and mobile-usability audits** — not yet done as a dedicated pass (see
    `PRODUCTION_READINESS_REPORT.md`).
