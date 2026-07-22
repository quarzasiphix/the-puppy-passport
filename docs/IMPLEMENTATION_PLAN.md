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
**Partially implemented / architectural decision pending**: animal and party data on a transport
request is currently an inline snapshot on `transport_requests` rather than a dedicated reusable
`animals` link + a `transport_parties` table separating legal-owner/sender/recipient/payer/pickup/
delivery contact (including non-Havenpaw external contacts). No decision has been made yet on
whether/how to change this — see the "Prioritised backlog" below. Draft save/resume/edit/delete
before submission is **not implemented**.

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
not mocked. **Not implemented**: community groups — `groups`/`group_members` exist in the schema but
are unused by any UI (confirmed by grep — zero references outside migrations); no join/leave, no
group-scoped posts, no route-group or breed-group structure. Deliberately scheduled after the
transport workflow per the original brief; still true that a full social layer isn't required yet.

## 13. Internationalisation
**Not started beyond schema readiness** — confirmed by code inspection, no localisation library
(i18next, react-intl, etc.) or locale-resource files exist anywhere in `src/`.
`profiles.preferred_language`/`preferred_currency` exist as columns; `country`/`currency` are plain
text fields everywhere rather than hardcoded enums specifically so this doesn't require a schema
rewrite later. All customer-facing copy today is English only. Initial operational focus stays
Poland/Germany/Netherlands/Belgium, Polish/English, PLN/EUR — see `PRODUCT_VISION.md`.

## 14. Multi-species support
**Not started** — confirmed by code inspection, no "species" concept exists anywhere in the schema
or UI; every animal-facing flow is dog-specific (kennel/puppy/litter language, dog-specific health
fields). Not part of the original brief until requested separately; kept out of this document's
phase order until a decision is made on the configurable-species model question (see backlog).

## 15. Future integrations
Explicitly out of scope until the above phases are further along: AI-assisted matching/pricing/
translation/fraud-detection, insurance, instalment credit, escrow payments, a food/accessories
marketplace, vet/groomer/hotel directories, online training, an exhibition calendar, a
behaviourist/trainer/photographer service marketplace, a European market/locale registry. Kept on
the list (`PRODUCT_VISION.md`), not committed.

---

## Prioritised backlog (real missing functionality, ordered by launch risk / dependency)

1. **Automated tests** — no automated test suite existed at all until 2026-07-22's first Playwright
   auth spec; everything else is still manually verified only (see `docs/MVP_TEST_REPORT.md` §5,
   `docs/E2E_TESTING.md`).
2. **Production Supabase project + production Cloudflare deployment** — business/account steps, not
   code; procedures documented in `docs/PRODUCTION_SETUP.md`/`docs/DEPLOYMENT_CHECKLIST.md` but not
   yet executed.
3. **Legal text finalisation** (`/terms`, `/privacy`, `/cookies`) — needs a real registered business
   entity and lawyer review before further code work there is useful.
4. **Transport data-model decision**: snapshot vs. dedicated `transport_parties`/reusable `animals`
   link (phase 4 above) — a real architectural choice affecting privacy, historical accuracy,
   repeat-customer UX and external non-account contacts; needs to be decided deliberately before
   more transport features are layered on top, per `DECISIONS.md`'s migration-discipline note.
5. **Operations calendar** (phase 5) — day/week/route views over already-real route/vehicle/driver/
   matching data.
6. **Document library / upload UI** (phase 10) — the storage layer is verified and ready; no
   customer-facing or ops-facing UI exists yet.
7. **Notification preferences** — currently all-or-nothing; only a "coming soon" placeholder exists
   on breeder/foundation settings pages.
8. **Foundation welfare-urgent flow and team/volunteer management** (phase 11) — both honest
   placeholders today.
9. **Full adoption/rehoming application questionnaire** — currently simplified to a first-contact
   message; puppy-purchase applications already have the full multi-step questionnaire as the
   template to extend from.
10. **Community groups** (phase 12) — schema exists, zero UI.
11. **Internationalisation and multi-species support** (phases 13–14) — both genuinely not started;
    each is a significant, deliberate architectural effort (locale/translation infrastructure;
    configurable per-species field/document/eligibility model) that should get its own design pass
    rather than being bolted on ad hoc.
12. **Accessibility and mobile-usability audits** — not yet done as a dedicated pass (see
    `PRODUCTION_READINESS_REPORT.md`).
