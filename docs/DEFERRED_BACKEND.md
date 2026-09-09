# Intentionally deferred backend work

Frontend contracts / typed stubs are being built now; these backend pieces are **not** done and
their UI must say so honestly (no fake success). Each needs DB migrations and/or Supabase edge
functions and/or third-party accounts.

## Payments (Stripe)

Updated 2026-09-09: **deposit (zaliczka) checkout is wired** — schema, RPC, `create-deposit-checkout-
session`/`stripe-webhook` edge functions, and buyer/breeder UI all exist (see
`docs/RESERVATION_PAYMENT_DESIGN.md`). Still nothing exists for: Stripe Connect onboarding
(deliberately deferred — v1 is "platform collects, breeders paid out manually"), platform fee +
transfers, refunds, disputes. `getConnectedAccountState`/`startConnectOnboarding`/`requestRefund`
in `domains/payments/services/payments.ts` remain `// BACKEND: not wired` stubs. No Stripe account
exists yet either — `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` are unset, so the real edge
functions return a 503 "not configured" until they're added.

## Reservation lifecycle widening

DB enum `reservation_status` has 5 values. The target has ~13 (draft, awaiting_seller_acceptance,
awaiting_payment, payment_processing, reserved, refund_pending, refunded, disputed, …). Plus new
columns: `platform_fee`, `seller_amount`, `terms_version`, `cancellation_policy`, `expiry_at`,
`payment_status`, `refund_status`, `dispute_status`, and a `reservation_events` timeline table.
`domains/reservations/status.ts` already exports `ReservationStatusRoadmap` for typing ahead of
the migration.

## Public pedigrees

**Status (2026-09-10): schema designed + written, frontend built, NOT applied to the live DB.**
See `docs/PEDIGREE_GRAPH.md` for the full architecture and the POK comparison.

**Designed & written (two migrations, not yet applied):**

- `supabase/migrations/20260910000100_pedigree_graph_schema.sql` — `dogs` (permanent identity,
  separate from `animals`/`parent_dogs`, each of which gets a nullable `dog_id`),
  `dog_parent_relationships` (sire/dam edges with a `verification_level` +
  `active`/`disputed`/`rejected` status and a partial-unique "one active parent per role" index),
  `pedigree_sources` (one evidence item), `pedigree_relationship_sources` (M:N "why we believe
  this edge"), `pedigree_submissions` + `pedigree_submission_resolutions` + `dog_match_candidates`
  (the "Add pedigree" contribution + review trail), `dog_claims` ("is this your dog/kennel",
  reviewed separately). Auto-identity triggers on `parent_dogs`/`animals`/`litters` so existing
  breeder data gets a pedigree with no extra step. Curated `public_dogs` /
  `public_dog_parent_relationships` views are the only anon read path. Private
  `pedigree-sources` storage bucket. A self-audit block at the end of the file fixes this
  project's known gotchas (trigger-function grant hygiene, table-level grants, mixed
  public/private columns → views, breeder-owned-dog storage policy).
- `supabase/migrations/20260910000200_pedigree_graph_rpcs.sql` — the client-callable write path
  the part-1 RLS deliberately withholds: `create_pedigree_submission` (anon or signed-in →
  `pending_review`, never a canonical write), `attach_pedigree_submission_document`,
  `resolve_pedigree_slot`, `finalize_pedigree_submission` (staff only),
  `attach_breeder_pedigree_source` (breeder's own dog, ownership-verified, canonical immediately),
  `search_dogs_ranked` (reg-number-exact weighted far above fuzzy name — import dedup).

**Built (compiles clean, unrunnable until the migration is applied):** `domains/pedigrees/`
(view-model types + real `getSupabaseBrowserClient()` services via a loosely-typed client cast,
since `src/lib/supabase/types.ts` has no pedigree tables yet); public routes
`_public/dogs.$slug` (dog page: overview + evidence indicators + mobile ancestor tree),
`_public/pedigrees` (search), `_public/pedigrees.add` (upload/manual/build → review/matching →
submit); breeder-panel `dashboard/breeder/pedigrees` ("enter once, reused everywhere").

**Still deferred:**

- **Applying the migration** to the live project, regenerating `src/lib/supabase/types.ts`,
  running `get_advisors`, and live-smoke-testing submission → resolution → canonical write. Blocked
  this pass by Supabase MCP account scope (only the `pok` project was reachable).
- OCR/AI document extraction — behind `PedigreeDocumentExtractor` with a no-op impl; the brief is
  explicit "do not fake OCR". Upload routes straight to manual transcription.
- A real moderation queue UI for `pending_review` submissions (staff run `finalize_*` today; no
  surface for it yet). `dog_match_candidates` rows are written by that future staff review, not
  by the public flow.
- Registry/association import (POK projection → `source_type = 'registry_record'`), DNA
  verification, COI / test-mating / completeness analytics, kennel auto-discovery/claim,
  per-field `pedigree_assertions` for name/colour/title (only the relationship edge carries
  provenance today), revision history table, merge-review workflow beyond the `dog_match_candidates`
  audit trail.

## Breeder social layer

See `docs/SOCIAL_DOMAIN.md` for the full breakdown. Summary of what's deferred: feed/composer/
comment-thread UI, personalized/breed/dog/litter feeds beyond one following query, litter-owner
private communities (schema value reserved, inert), social notification wiring, org-follow
consolidation, section drag-reordering, richer theming, multilingual page content, analytics,
Facebook/Instagram import assistant, and all custom-domain/subdomain DNS/routing infrastructure
(`organisation_domains` is schema-only).

## Marketplace listing entity

No `listings` / `listing_animals` tables — a "listing" is `animals.is_published = true`. Litter
listings, expected litters and multi-puppy availability are all forced through `animals`. Target:
distinct `Dog` / `Litter` / `Listing` / `ListingAnimal`.

## Messaging context

`conversations` links only to `linked_animal_id` + `linked_transport_request_id`. Needed: links to
buyer application, reservation, payment issue, report/dispute; structured system-event messages
(non-editable), unread counts, participant permissions.

## Verification granularity

One generic `user_verifications` pipeline + a coarse `organisations.verification_status`. Target:
distinct states for breeder / kennel / identity-or-org / dog-document / pedigree / health-document
verification, each with its own moderator review surface.

## Transport

Backend is mature. Frontend just needs relocating into `domains/transport/` and decoupling from
the listing flow (it already references reservation/dog/buyer/seller/provider loosely).
