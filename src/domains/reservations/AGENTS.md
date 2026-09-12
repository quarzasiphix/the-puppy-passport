# Reservations domain

The post-application, pre-transport workflow: a reservation, its deposit, and its agreement state.
"Created only from an *approved* `buyer_applications` row (enforced in the RLS insert policy
itself, not just the UI)" per `docs/DOMAIN_MODEL.md`.

## What this owns

- `reservations` — read via `listMyReservationsAsBuyer`/`listReservationsForMyKennel`
  (`services/reservations.ts`), created exclusively via the `convert_application_to_reservation()`
  RPC ("Stage IR-6: the one real way to create a reservation... does the reservation insert, the
  application status flip, and the animal availability update atomically", `services/reservations
  .ts:54-58`) — never a direct client insert.
- Deposit lifecycle — `requestReservationDeposit()` is a thin wrapper over the
  `request_reservation_deposit()` RPC; "all the actual authorization/state-machine rules... live
  server-side" (`services/reservations.ts:76-78`, migration
  `20260909000100_reservation_deposit_payments.sql`). Actual payment collection is the separate
  `payments` domain's concern (Stripe Checkout session), not this one.
- `status.ts` — the reservation state machine: `RESERVATION_STATUSES`
  (`awaiting_breeder|awaiting_buyer|confirmed|cancelled|completed`), `RESERVATION_TRANSITIONS`
  (explicit legal-transition map), `canTransitionReservation`/`assertReservationTransition`,
  `isTerminalReservationStatus`, `isReservationAwaitingBreederAction`. Also documents a **future,
  wider vocabulary** (`ReservationStatusRoadmap`) for when payments land (draft/submitted/
  awaiting_seller_acceptance/accepted/awaiting_payment/payment_processing/reserved/rejected/
  expired/refund_pending/refunded/disputed) — typed today, not backed by the DB enum yet, "widening
  the enum is a deliberate, separate DB migration" (`status.ts:14-17`).

## File structure

- `index.ts` — curated re-export (unlike most domains' `export *`) of specific names from
  `services/reservations`, `types`, `status`, `pages/breeder-reservations-page`,
  `pages/buyer-reservations-page`, `components/request-deposit-dialog`, `components/pay-deposit
  -button`.
- `services/reservations.ts` — list/convert/deposit-request functions above.
- `status.ts` — state machine + `reservationStatusLabel(status, t)` (converted 2026-09-12 from a
  hardcoded `RESERVATION_STATUS_LABELS` `Record` to a `t()`-based function — the old export was
  removed entirely, not deprecated-in-place, so anything still importing
  `RESERVATION_STATUS_LABELS` directly is now a build error, not a silent staleness).
- `types.ts` — `ReservationRow` (raw PostgREST shape), `ReservationSummary` (view model shared by
  both breeder and buyer list pages), `ConvertApplicationToReservationInput`.
- `pages/breeder-reservations-page.tsx`, `pages/buyer-reservations-page.tsx` — the two dashboard
  pages, each re-exported and mounted directly by `dashboard/breeder/reservations.tsx` /
  `dashboard/buyer/reservations.tsx` (thin route wrappers, not in this domain).
- `components/request-deposit-dialog.tsx`, `components/pay-deposit-button.tsx` — breeder-side
  "request a deposit" and buyer-side "pay the deposit" UI, the latter presumably calling into the
  `payments` domain's `createDepositCheckoutSession` (not verified in this pass).

## Public API

Curated (not `export *`) — see the exact list in `index.ts` above. A caller reaching for something
not in that list should ask whether it belongs in the public API before importing the internal file
directly (the barrel comment: "never reach into ./services, ./pages or internal files directly").

## Known gaps

- `ReservationStatusRoadmap` exists only as a type — no migration widens the real enum yet; don't
  assume any of its extra states (`awaiting_payment`, `disputed`, etc.) are reachable today.

## Related docs

- `docs/DOMAIN_MODEL.md` — reservation creation invariant (approved-application-only).
- `docs/RESERVATION_PAYMENT_DESIGN.md` — the deposit/payment design this domain's deposit fields
  implement a slice of (full payment processing lives in the `payments` domain, still stubbed).

## Last significant change

2026-09-12: `reservationStatusLabel` converted from a hardcoded English `Record` lookup to a
`t()`-based function (both call sites, in the two `pages/*.tsx` files, updated to pass `t`); this
was done as part of the same pass that fixed `applicationStatusLabels` in the `marketplace` domain
— see the repo-root `TODO.md`.
