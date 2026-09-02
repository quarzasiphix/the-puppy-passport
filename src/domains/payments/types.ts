// Payments domain — type contracts only. No Stripe integration exists yet (see
// docs/DEFERRED_BACKEND.md and docs/RESERVATION_PAYMENT_DESIGN.md). Every state below is kept
// deliberately separate from the others and from reservations.ReservationStatus — a reservation
// is a platform workflow, Stripe state is a financial event attached to it, and the two must
// never be conflated. The eventual source of truth for all of these is server-side webhook
// processing with idempotency keys — never a client redirect.

export type StripeConnectedAccountState =
  | "not_started"
  | "onboarding_incomplete"
  | "pending_verification"
  | "active"
  | "restricted"
  | "rejected";

export type PaymentIntentState =
  | "requires_payment_method"
  | "requires_confirmation"
  | "requires_action"
  | "processing"
  | "succeeded"
  | "canceled";

export type CheckoutSessionState = "open" | "complete" | "expired";

export type PayoutState = "not_scheduled" | "in_transit" | "paid" | "failed" | "canceled";

export type RefundState = "none" | "requested" | "processing" | "succeeded" | "failed";

export type DisputeState =
  "none" | "warning_needs_response" | "needs_response" | "under_review" | "won" | "lost";

export type ReservationDeposit = {
  reservationId: string;
  currency: string;
  amount: number;
  platformFee: number;
  sellerAmount: number;
  paymentIntentId: string | null;
  paymentIntentState: PaymentIntentState | null;
  checkoutSessionId: string | null;
  checkoutSessionState: CheckoutSessionState | null;
  refundState: RefundState;
  disputeState: DisputeState;
};

/** One row of the internal payment/event ledger — an append-only audit trail of every state
 * transition this domain observes, sourced from a verified webhook, never a client claim. */
export type PaymentLedgerEvent = {
  id: string;
  reservationId: string;
  kind:
    | "payment_intent.created"
    | "payment_intent.succeeded"
    | "payment_intent.payment_failed"
    | "checkout.session.expired"
    | "charge.refunded"
    | "charge.dispute.created"
    | "payout.paid"
    | "payout.failed";
  stripeEventId: string; // idempotency key
  occurredAt: string;
  raw: unknown;
};
