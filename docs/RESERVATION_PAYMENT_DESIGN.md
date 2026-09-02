# Reservation & payment design

Status: **reservation state machine implemented (frontend); payments NOT wired.**

## Principle

A **reservation** is a platform business workflow. It is modelled independently of any payment
provider. A **payment** is a financial event attached to a reservation. Stripe state
(PaymentIntent, Checkout Session, connected account, payout, refund, dispute) is tracked
separately from platform reservation state and is never the source of truth for "is this
reserved" — that is the reservation row, updated by verified server-side webhook processing.

## What exists today

- DB: `public.reservations` (`supabase/migrations/20260101001100_reservations.sql`) with
  `status public.reservation_status`, `agreed_price`, `deposit_amount`, `deposit_status`,
  `agreement_status`, `planned_collection_date`, `collection_method`. FK to `buyer_id`,
  `organization_id`, `animal_id`, `application_id` (unique — one reservation per application).
- DB RPC: `convert_application_to_reservation()` — the only creation path, atomic (reservation
  insert + application status flip + animal availability update), idempotent-retry safe.
- Frontend: `src/domains/reservations/`
  - `status.ts` — `ReservationStatus` (the live enum: `awaiting_breeder | awaiting_buyer |
    confirmed | cancelled | completed`), `RESERVATION_TRANSITIONS` map,
    `canTransitionReservation`, `assertReservationTransition`, display labels/styles. Unit-tested
    in `tests/unit/reservation-status.test.ts`.
  - `services/reservations.ts` — list (buyer / kennel) + `convertApplicationToReservation`.
  - `pages/` — breeder table view, buyer card view (faithful ports of the old route bodies).

## What is NOT built (needs DB migrations + edge functions + Stripe account)

The product brief's fuller lifecycle:
`draft → submitted → awaiting_seller_acceptance → accepted → awaiting_payment →
payment_processing → reserved → completed`, plus `rejected / expired / cancelled /
refund_pending / refunded / disputed`.

`status.ts` exports `ReservationStatusRoadmap` (the target union) so payment UI can be typed
against the intended contract now. Widening the machine is **additive** — extend the union and
`RESERVATION_TRANSITIONS`; no rewrite.

Reservation row also needs (deferred): `platform_fee`, `seller_amount`, `currency` (has it),
`terms_version`, `cancellation_policy`, `acceptance_timestamps`, `expiry_at`, `payment_status`,
`refund_status`, `dispute_status`, and a `reservation_events` timeline table.

### Payment domain (`src/domains/payments/`, to be created)

Typed service interfaces + clearly-marked stubs only, until the backend exists:

- **Stripe Connect** onboarding (breeder connected account state).
- **Checkout Session / Payment Element** for the deposit.
- **PaymentIntent** lifecycle: `requires_payment_method → requires_confirmation →
  processing → succeeded | requires_action | canceled`.
- **Platform fee** + **connected-account transfer**.
- **Refunds**, **failed payments**, **expired sessions**, **disputes**.
- **Webhook-driven status updates** with idempotency keys — the eventual source of truth. The
  frontend never marks a payment succeeded from a client redirect.
- Internal **payment/event ledger**.

Hard rules: no fake payment success; no privileged Stripe keys in the frontend; no client-trusted
payment state; do not call a deposit "escrow" unless the real flow implements escrow (it does
not).

## Separation of concerns (keep distinct)

`platform reservation state` · `Stripe PaymentIntent state` · `Stripe Checkout state` ·
`connected-account state` · `payout state` · `refund state` · `dispute state`.
