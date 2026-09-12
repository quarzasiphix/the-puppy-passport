# Payments domain

Smallest domain in the app — three files, no DB tables of its own, no `index.ts` barrel comment.
"Platform collects, manual payout" model (2026-09-09 decision, per
`services/payments.ts:1`) — Stripe Connect is deliberately not built.

## What this owns

- No tables. Reads/writes go through `reservations.deposit_*` columns directly (owned by the
  `reservations` domain) rather than through anything here.
- One real edge function call: `supabase.functions.invoke("create-deposit-checkout-session")`
  (`services/payments.ts:45`). The counterpart `stripe-webhook` edge function is the only writer
  of `reservations.deposit_status` — never this domain, never a client redirect
  (`services/payments.ts:36-38`).

## File structure

- `index.ts` — re-exports `./types` and `./services/payments`. No header comment.
- `types.ts` — type contracts only (`StripeConnectedAccountState`, `PaymentIntentState`,
  `CheckoutSessionState`, `PayoutState`, `RefundState`, `DisputeState`, `ReservationDeposit`,
  `PaymentLedgerEvent`). Comment at the top: "Every state below is kept deliberately separate from
  the others and from `reservations.ReservationStatus` — a reservation is a platform workflow,
  Stripe state is a financial event attached to it, and the two must never be conflated."
- `services/payments.ts` — `getConnectedAccountState`, `startConnectOnboarding`,
  `getReservationDeposit`, `requestRefund` are all stubs that throw via a shared `notWired()`
  helper (`services/payments.ts:15-19`) with a message pointing at `docs/DEFERRED_BACKEND.md` and
  `docs/RESERVATION_PAYMENT_DESIGN.md`. Only `createDepositCheckoutSession` is real.

## Public API

`index.ts` re-exports everything from `types.ts` and `services/payments.ts` — no filtering, since
the domain is small enough that its full surface is its public surface.

## Known gaps

- No Stripe Connect integration exists — `getConnectedAccountState`/`startConnectOnboarding` are
  permanent stubs until that changes (not "not yet started", a deliberate model choice per the
  2026-09-09 decision).
- `getReservationDeposit` stub explicitly tells callers to "read reservations.deposit_* columns
  directly for now" instead (`services/payments.ts:33`) — i.e. this function is not actually used
  anywhere the deposit state is needed; verify before calling it.
- `requestRefund` is unimplemented — no refund flow exists in the product yet.
- `createDepositCheckoutSession`'s edge function counterpart returns a 503 "Stripe is not
  configured yet" until real `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` secrets are set
  (`services/payments.ts:6-8`) — this is expected/correct behavior in any environment without those
  secrets, not a bug.

## Related docs

- `docs/RESERVATION_PAYMENT_DESIGN.md` — the payment/reservation design this domain implements a
  slice of.
- `docs/DEFERRED_BACKEND.md` — why Stripe Connect specifically is deferred.
- `supabase/functions/create-deposit-checkout-session`, `supabase/functions/stripe-webhook` — the
  actual server-side logic; this domain is a thin client over both.

## Last significant change

Unknown from in-domain evidence beyond the 2026-09-09 model decision cited in
`services/payments.ts:1`; no changes observed in this pass (2026-09-12), file created as part of
this pass's project-wide `AGENTS.md` rollout.
