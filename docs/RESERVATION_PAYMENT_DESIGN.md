# Reservation & payment design

Status (updated 2026-09-12): **reservation state machine implemented (frontend); deposit (zaliczka)
payments wired end-to-end for the "platform collects, manual payout" model; cancellation and
breeder payout tracking now also real and applied** — schema, RPCs, edge functions and UI all
exist for all four pieces (deposit request/pay, cancellation, payout tracking). **Stripe *secret*
key status as of 2026-09-09 was unset** — `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` unset would
make `create-deposit-checkout-session` return a clear 503 "Stripe is not configured yet"; this has
not been independently re-checked since (no `stripe` edge-function log lines found in a 2026-09-12
sweep, meaning either it's still unconfigured or simply hasn't been called in production yet —
confirm directly in the Supabase dashboard before assuming either way). Stripe Connect (per-breeder
split payout) was deliberately **not** built — see "What is NOT built" below.

## Cancellation (built 2026-09-12)

`cancel_reservation(reservation_id, reason?)` — `supabase/migrations/20260912120000_reservation_
cancellation.sql`. Either party (buyer, the owning org via `owns_org()`, or an admin) can cancel any
non-terminal reservation. Adds `cancelled_at`/`cancelled_by`/`cancellation_reason` columns. Business
rule: **a paid deposit is never refunded on cancellation** — "platform collects, manual payout"
already means the money is effectively the breeder's once paid, so a `'paid'` `deposit_status` is
left untouched; a merely-*requested*-but-unpaid deposit (`'pending'`) reverts to `'not_required'`
instead, mirroring the stripe-webhook's own `checkout.session.expired` handling. Also frees the
animal back to `available` if this reservation was the reason it was `reserved`. UI:
`CancelReservationDialog` (`src/domains/reservations/components/`), wired into both
`buyer-reservations-page.tsx` and `breeder-reservations-page.tsx` — only rendered for
`awaiting_breeder`/`awaiting_buyer`/`confirmed` reservations, shows the non-refundable warning only
when `depositStatus === 'paid'`.

## Breeder payout tracking (manual-payout v1, built 2026-09-12)

Once a deposit is paid, Anemalo owes that money to the breeder (still no Stripe Connect — a manual
bank-transfer payout). `supabase/migrations/20260912130000_reservation_payouts.sql`:

- `reservation_payouts` table (`owed | paid`), one row per reservation, created automatically by a
  trigger (`create_reservation_payout_on_deposit_paid`, fires on `deposit_status` flipping to
  `'paid'` — survives any future write path, not just today's one webhook call). `due_at` = 20 days
  from `deposit_paid_at` (a comfortable buffer over Stripe's own Poland settlement timing).
- **v1 assumption: the full `deposit_amount` is owed, no platform-fee deduction** — no fee concept
  exists anywhere in this schema yet (`platform_fee` is still a deferred `reservations` column, see
  below). Cancellation never touches a paid deposit (see above) — that money is correctly still
  owed regardless of a later cancellation.
- RLS mirrors `organisation_trust_claims`: the owning org can `SELECT` its own payouts (`owns_org()`
  only, no self-service update at all), admin `for all`. A breeder can see what's owed to them but
  can never mark themselves paid.
- `mark_reservation_payout_paid(payout_id, reference?)` — admin/ops-only, one-way `owed → paid`,
  audited. UI: `/dashboard/breeder/payouts` (read-only, grouped totals by currency, overdue badge
  past the 20-day SLA) and `/dashboard/operations/payouts` (internal-only, all breeders, the
  "Mark as paid" action with an optional bank-transfer reference).

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
