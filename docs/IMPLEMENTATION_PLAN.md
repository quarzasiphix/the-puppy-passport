# Havenpaw — Implementation Plan

Phased build order. Status reflects what's actually in the repo, not what's been requested —
"requested" work that hasn't landed yet stays in the task queue (tracked in-session; this document
is the durable record of the plan itself).

## 1. Project foundation
TanStack Start app, shadcn/Radix component library, routing, styling — **pre-existing**, inherited
from the original visual prototype. Preserved as-is throughout every later phase.

## 2. Local database
**Done.** `supabase/config.toml`, ordered migrations, `supabase/seed.sql`, `.env.example`,
`docs/LOCAL_SETUP.md`, hand-written typed Supabase client config (`src/lib/supabase/types.ts`,
replaced wholesale by `npm run db:types` once Docker is available). See `DECISIONS.md` for why the
Supabase client split into a browser client (all data queries) and a cookie-aware server client
(session lookup + auth actions only).

## 3. Accounts and roles
**Schema done** (`profiles`, `user_roles`, `organisations`, `organisation_members`,
`user_verifications`, `private_addresses`) — see `DOMAIN_MODEL.md`. **App-level auth partially
done**: email/password sign up/in/out work end-to-end; password reset, session-expiry handling, a
proper onboarding flow (multi-step, purpose-driven role creation), the account-status page, and
`docs/SOCIAL_AUTH_SETUP.md` are the next slice of this phase.

## 4. Transport requests
**Core flow done**: 7-step public request form writes a real `transport_requests` row +
`transport_status_history`, customer can view their requests and status. **Still needed**: a
dedicated reusable `animals` record model for transport-linked animals (distinct from the
marketplace `animals` table's public-listing shape), a `transport_parties` table separating
legal-owner/sender/recipient/payer/pickup-contact/delivery-contact (including external,
non-Havenpaw-user contacts), and draft save/resume/edit/delete before submission.

## 5. Transport operations
**Not built.** Ops/admin-only dispatch dashboard: KPI counts from real data, dense filterable
request table, request detail page (documents, compliance, quotations, status history, route
assignment, messages, internal notes), and status-changing actions that each write status history
+ an audit record.

## 6. Route planning
**Not built.** `routes`/`route_stops`/`route_assignments` tables exist (minimal shape, one seeded
demo route); the full spec adds vehicle/driver/crate management, a route builder UI, capacity and
compatibility warnings, and a public-safe planned-route listing.

## 7. Matching engine
**Not built.** Deterministic, explainable, non-generative scoring of request↔route compatibility
(date/region/capacity/crate/document/compliance) producing `strong_match` /`possible_match`/
`manual_review`/`blocked` with visible blocking reasons — recommendations only, never an automatic
assignment.

## 8. Breeder discovery
**Not built.** Breeder/animal discovery map (privacy-reduced public locations only — exact
addresses stay in `private_addresses`), plus a guided "find your ideal dog" questionnaire that
produces "potential match based on the information provided" results, never a guarantee.

## 9. Marketplace
**Schema done, UI still on mock data.** `animals`/`litters`/`parent_dogs`/`breeds` exist with full
RLS; the public pages (`find-a-dog`, puppy detail, breeder list/profile, planned litters) still
read `src/lib/mock-data.ts` and need to be re-pointed at Supabase queries, plus publication-category
restrictions enforced in the UI to match what RLS already enforces at the data layer.

## 10. Compliance and documents
**Baseline done, refinement pending.** `transport_documents` and `compliance_reviews` exist; the
fuller spec adds stricter access control (signed URLs, driver access only when operationally
assigned), a customer-facing document checklist, an ops review queue with expiry warnings, and a
`legal_requirements` placeholder table (never populated without a source URL + review date — see
`DECISIONS.md` on not inventing a legal database).

## 11. Foundations
**Schema supports it** (organisations of `org_type = 'foundation' | 'shelter' | 'rescue'`,
`animals.listing_category = 'adoption'`), but the foundation-specific dashboard, adoption workflow
UI, and urgent-transport-request flag aren't built.

## 12. Community
**Schema exists** (`posts`, `comments`, `reactions`, `follows`, `groups`, messaging tables); no UI.
Deliberately last among the "supporting pillar" phases — the brief is explicit that a full social
layer shouldn't be built before the transport workflow is operational.

## 13. Internationalisation
**Not started beyond schema readiness.** `profiles.preferred_language`/`preferred_currency` exist;
`country`/`currency` are plain text fields everywhere rather than hardcoded enums specifically so
this doesn't require a schema rewrite later. Initial operational focus stays Poland/Germany/
Netherlands/Belgium, Polish/English, PLN/EUR — see `PRODUCT_VISION.md`.

## 14. Future integrations
Explicitly out of scope until the above phases are real: AI-assisted matching/pricing/translation/
fraud-detection, insurance, instalment credit, escrow payments, a food/accessories marketplace,
vet/groomer/hotel directories, online training, an exhibition calendar, a behaviourist/trainer/
photographer service marketplace. Kept on the list (`PRODUCT_VISION.md`), not committed.

---

## Immediate next slice (in queue order)

1. Finish `docs/` (`DECISIONS.md`, `CURRENT_STATE_AUDIT.md`).
2. Auth + onboarding foundation (rest of phase 3).
3. Navigation + role-based dashboard shells (customer/breeder/foundation/operations/admin
   workspace switcher, off real role data).
4. Transport workflow refinement (phase 4 remainder: `animals`, `transport_parties`, drafts).
5. Transport operations dashboard (phase 5).
6. Vehicles/crates/drivers (phase 6, part 1).
7. Planned route management (phase 6, part 2).
8. Matching engine v1 (phase 7).
9. Transport price estimation.
10. Breeder/animal discovery map (phase 8, part 1).
11. Breeder achievement & champion-dog profiles.
12. Marketplace on real data + publication restrictions (phase 9).
13. Connect marketplace/adoption/reservations to transport requests.
14. Document/compliance review refinement + legal-requirement placeholders (phase 10).
15. MVP integration review + `docs/MVP_TEST_REPORT.md` (quality gate, not a feature phase).
