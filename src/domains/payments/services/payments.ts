// BACKEND: not wired. No Stripe account, no edge functions, no `stripe_*` tables exist yet (see
// docs/DEFERRED_BACKEND.md). These functions describe the intended service contract so UI can be
// built and typed against it ahead of the integration. Every one throws rather than faking
// success — a payment UI must never mark a deposit paid without a server-verified webhook.

import type { ReservationDeposit, StripeConnectedAccountState } from "../types";

function notWired(operation: string): never {
  throw new Error(
    `Payments: ${operation} is not available yet — no Stripe integration exists. ` +
      "See docs/DEFERRED_BACKEND.md and docs/RESERVATION_PAYMENT_DESIGN.md.",
  );
}

export async function getConnectedAccountState(
  _organisationId: string,
): Promise<StripeConnectedAccountState> {
  return notWired("connected account lookup");
}

export async function startConnectOnboarding(_organisationId: string): Promise<{ url: string }> {
  return notWired("Connect onboarding");
}

export async function getReservationDeposit(_reservationId: string): Promise<ReservationDeposit> {
  return notWired("deposit lookup");
}

/** Creates the checkout/payment session for a reservation's deposit. The frontend must poll or
 * subscribe for the resulting `PaymentIntentState`/`CheckoutSessionState` — it never derives
 * success from the client-side redirect alone. */
export async function createDepositCheckoutSession(
  _reservationId: string,
): Promise<{ checkoutUrl: string; checkoutSessionId: string }> {
  return notWired("deposit checkout session creation");
}

export async function requestRefund(
  _reservationId: string,
  _reason: string,
): Promise<{ refundId: string }> {
  return notWired("refund");
}
