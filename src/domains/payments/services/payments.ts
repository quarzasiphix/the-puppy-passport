// "Platform collects, manual payout" model (2026-09-09 decision — see
// docs/RESERVATION_PAYMENT_DESIGN.md and supabase/functions/create-deposit-checkout-session,
// supabase/functions/stripe-webhook). Stripe Connect is deliberately NOT built — breeders are paid
// out manually/by bank transfer outside the app for now, so getConnectedAccountState/
// startConnectOnboarding stay stubs until that changes. createDepositCheckoutSession is real: it
// calls the create-deposit-checkout-session edge function, which itself returns a clear "Stripe is
// not configured yet" error (503) until a real Stripe account's STRIPE_SECRET_KEY/
// STRIPE_WEBHOOK_SECRET are set as Supabase Edge Function secrets — never a fake success. Deposit
// state (`reservations.deposit_status`) only ever flips to 'paid' via the stripe-webhook edge
// function's server-verified webhook — never this file, never a client redirect.

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ReservationDeposit, StripeConnectedAccountState } from "../types";

function notWired(operation: string): never {
  throw new Error(
    `Payments: ${operation} is not available yet — no Stripe Connect integration exists. ` +
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
  return notWired("deposit lookup — read reservations.deposit_* columns directly for now");
}

/** Creates the Stripe Checkout Session for a reservation's deposit and returns its hosted URL to
 * redirect the buyer to. The frontend never derives payment success from the redirect back to
 * `successUrl` — only the webhook-driven `deposit_status` on the reservation row means anything. */
export async function createDepositCheckoutSession(
  reservationId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<{ checkoutUrl: string; checkoutSessionId: string }> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.functions.invoke("create-deposit-checkout-session", {
    body: { reservationId, successUrl, cancelUrl },
  });
  if (error) throw error;
  return data as { checkoutUrl: string; checkoutSessionId: string };
}

export async function requestRefund(
  _reservationId: string,
  _reason: string,
): Promise<{ refundId: string }> {
  return notWired("refund");
}
