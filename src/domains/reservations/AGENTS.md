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
- **Cancellation** (added 2026-09-12) — `cancelReservation()` wraps `cancel_reservation()`
  (`20260912120000_reservation_cancellation.sql`); either party or an admin, any non-terminal
  reservation. A paid deposit is never refunded (money is effectively the breeder's once paid); a
  merely-requested one reverts to `not_required`. UI: `components/cancel-reservation-dialog.tsx`
  (`CancelReservationDialog`), already wired into both `pages/*.tsx`.
- **Breeder payout tracking** (added 2026-09-12, manual-payout v1) — `reservation_payouts` table,
  one row per reservation, auto-created by a DB trigger when `deposit_status` flips to `paid`. Read
  via `listMyOrgPayouts()`/`listAllPayouts()` (`services/payouts.ts`, a new file — not part of
  `services/reservations.ts`), the only write is admin-only `markReservationPayoutPaid()` (wraps
  `mark_reservation_payout_paid()`). See
  `docs/RESERVATION_PAYMENT_DESIGN.md` "Breeder payout tracking" for the full design (20-day SLA,
  v1's no-platform-fee assumption, RLS shape). UI: `/dashboard/breeder/payouts` (read-only),
  `/dashboard/operations/payouts` (internal, mark-as-paid action) — both outside this domain's own
  route files (thin route wrappers, same pattern as the reservation list pages).
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
  `services/reservations`, `services/payouts`, `types`, `status`, `pages/breeder-reservations-page`,
  `pages/buyer-reservations-page`, `components/request-deposit-dialog`, `components/pay-deposit
  -button`, `components/cancel-reservation-dialog`.
- `services/reservations.ts` — list/convert/deposit-request/**cancel** functions above.
- `services/payouts.ts` (new 2026-09-12) — `PayoutRow` + the three payout functions above.
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
- `components/cancel-reservation-dialog.tsx` (new 2026-09-12) — `CancelReservationDialog`, shared
  verbatim by both list pages (`cancel_reservation()` authorizes either party itself, so the same
  component works unmodified from both sides).

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

2026-09-12: cancellation (`cancel_reservation()` + `CancelReservationDialog`) and breeder payout
tracking (`reservation_payouts` + `services/payouts.ts` + both payout dashboard pages) added — see
`docs/RESERVATION_PAYMENT_DESIGN.md` for the full design. Same day, separately:
`reservationStatusLabel` converted from a hardcoded English `Record` lookup to a `t()`-based
function (both call sites, in the two `pages/*.tsx` files, updated to pass `t`) as part of the same
pass that fixed `applicationStatusLabels` in the `marketplace` domain — see the repo-root
`TODO.md`.
