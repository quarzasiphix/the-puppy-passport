# Reservation & payment design

Status (updated 2026-09-09): **reservation state machine implemented (frontend); deposit (zaliczka)
payments now wired end-to-end for the "platform collects, manual payout" model** — schema, RPC,
edge functions and UI all exist. **No Stripe *secret* key exists yet** — `STRIPE_SECRET_KEY`/
`STRIPE_WEBHOOK_SECRET` are unset, so `create-deposit-checkout-session` returns a clear 503 "Stripe
is not configured yet" until real keys are added as Supabase Edge Function secrets. Stripe Connect
(per-breeder split payout) was deliberately **not** built — see "What is NOT built" below.

Both edge functions auto-detect **test vs live mode from the key's own prefix**
(`supabase/functions/_shared/stripe-mode.ts` — `sk_test_`/`sk_live_`, etc.), logged on every call
and returned as `stripeMode` in `create-deposit-checkout-session`'s response — never a
separately-maintained "which environment" flag that could drift from the actual key in use.

A Stripe **publishable** key (`pk_test_...`) was provided 2026-09-09 but is not currently wired
anywhere — this architecture uses a Stripe-hosted Checkout redirect (same pattern as the Gryfin
York POK panel's applications engine), which needs no client-side Stripe.js/Elements and therefore
no publishable key at all. It's recorded here for whenever a future Stripe.js/Payment Element
integration needs one; the *secret* key (`sk_test_...` or `sk_live_...`) is what's still required
to make the deposit flow actually work.

## What's real as of 2026-09-09 (deposit payments, platform-collects model)

- DB: `supabase/migrations/20260909000100_reservation_deposit_payments.sql` — adds
  `reservations.stripe_checkout_session_id` / `stripe_payment_intent_id` / `deposit_requested_at` /
  `deposit_paid_at` (all locked to service-role/admin writes only, see
  `prevent_client_writes_to_deposit_payment_fields()`), plus an append-only
  `reservation_payment_events` ledger table (one row per verified Stripe webhook event,
  `stripe_event_id` unique = idempotency key). Deliberately did **not** widen `reservation_status`
  or `deposit_status` — the existing 3-state `deposit_status` (`not_required | pending | paid`)
  already matches this simpler, non-Connect flow.
- DB RPC: `request_reservation_deposit(reservation_id, amount, currency)` — the only client path
  from `not_required` to `pending`; breeder/admin only, atomic, gives clear errors.
- Edge functions (`supabase/functions/`): `create-deposit-checkout-session` (buyer-authenticated,
  creates the Stripe Checkout Session, records its id) and `stripe-webhook` (no JWT — Stripe
  signature verified instead; the *only* thing that ever sets `deposit_status = 'paid'`, on
  `checkout.session.completed`; reverts a still-`pending` deposit to `not_required` on
  `checkout.session.expired`; every event is logged to `reservation_payment_events` regardless).
- Frontend: `domains/payments/services/payments.ts` `createDepositCheckoutSession()` is real
  (calls the edge function, redirects to the hosted Checkout URL). `domains/reservations/` gained
  `RequestDepositDialog` (breeder — sets amount + requests) and `PayDepositButton` (buyer —
  redirects to Checkout), wired into both reservation dashboard pages.

## What is still NOT built

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
