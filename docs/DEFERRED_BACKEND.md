# Intentionally deferred backend work

Frontend contracts / typed stubs are being built now; these backend pieces are **not** done and
their UI must say so honestly (no fake success). Each needs DB migrations and/or Supabase edge
functions and/or third-party accounts.

## Payments (Stripe)

Nothing exists. No Stripe dependency, no connected accounts, no payment tables.
Needed: Connect onboarding, Checkout/Payment Element for deposits, platform fee + transfers,
refunds, disputes, webhook processing with idempotency, an internal ledger. See
`docs/RESERVATION_PAYMENT_DESIGN.md`. Frontend `domains/payments/` will be typed interfaces +
`// BACKEND: not wired` stubs until the edge functions and `stripe_*` tables exist.

## Reservation lifecycle widening

DB enum `reservation_status` has 5 values. The target has ~13 (draft, awaiting_seller_acceptance,
awaiting_payment, payment_processing, reserved, refund_pending, refunded, disputed, …). Plus new
columns: `platform_fee`, `seller_amount`, `terms_version`, `cancellation_policy`, `expiry_at`,
`payment_status`, `refund_status`, `dispute_status`, and a `reservation_events` timeline table.
`domains/reservations/status.ts` already exports `ReservationStatusRoadmap` for typing ahead of
the migration.

## Public pedigrees

No pedigree data model exists at all. `parent_dogs` is kennel breeding stock, not linked to
`animals`; there is no sire/dam relationship, no pedigree/relationship table, no per-field
provenance, no revision history, no candidate-match/merge tables.

Needed (schema): a `dog`-centric identity separate from listing (`animals` currently conflates
via `listing_category` + `is_published`); `dog_relationships` (sire/dam edges); `pedigree_assertions`
with per-field `source` (user_submission | breeder_confirmation | uploaded_pedigree |
kennel_club_record | moderator_decision | system_import) and `verification_level`
(`unverified | community_supported | document_supported | breeder_confirmed | registry_verified |
disputed`); `pedigree_revisions`; `dog_match_candidates` + `dog_merge_reviews`; pedigree document
storage with public/private + redacted-source flags.

`domains/pedigrees/` will ship frontend types + service boundaries shaped so provenance and
revisions attach without another rewrite.

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
