// Stripe webhook receiver — the ONLY thing allowed to mark a reservation deposit "paid". Never the
// browser return/success_url redirect (a client can hit that URL without ever having paid). See
// docs/RESERVATION_PAYMENT_DESIGN.md ("Webhook-driven status updates ... the frontend never marks a
// payment succeeded from a client redirect") and
// supabase/migrations/20260909000100_reservation_deposit_payments.sql.
//
// Deployed with verify_jwt = false — Stripe does not send a Supabase JWT. Authenticity comes
// entirely from the Stripe-Signature header, verified below against STRIPE_WEBHOOK_SECRET. Do not
// remove that verification step.
//
// Configure the Stripe Dashboard webhook endpoint to send at least:
//   checkout.session.completed, checkout.session.expired
// Any other event type is logged to the ledger (if it carries a reservation_id) but otherwise
// ignored — extend the switch below deliberately, don't wildcard-handle events.
//
// Requires these Supabase Edge Function secrets (not set yet as of 2026-09-09 — no Stripe account
// exists; until they're set this function returns a clear 503, never a fake success):
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.4.0";
import { detectStripeKeyMode } from "../_shared/stripe-mode.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const stripeMode = detectStripeKeyMode(stripeSecretKey);
  if (!stripeSecretKey || !webhookSecret || stripeMode === "unconfigured") {
    console.error("stripe-webhook called but STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET are unset");
    return new Response("Stripe is not configured yet", { status: 503 });
  }
  console.log(`stripe-webhook: Stripe key mode = ${stripeMode}`);

  const signature = req.headers.get("Stripe-Signature");
  if (!signature) {
    return new Response("Missing Stripe-Signature header", { status: 400 });
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    // constructEventAsync (not the sync constructEvent) — required in Deno's Web Crypto runtime,
    // this is Stripe's own documented pattern for Deno/edge environments.
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (err) {
    console.error("Stripe signature verification failed", err);
    return new Response(`Webhook signature verification failed: ${(err as Error).message}`, {
      status: 400,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  let reservationId: string | null = null;
  // Set true only for a genuine, possibly-transient failure (a DB write that should have
  // succeeded returned an error) — never for a legitimate no-op (idempotent redelivery, an event
  // for a superseded session). Determines the HTTP status returned to Stripe: Stripe retries on
  // anything other than 2xx, so this must reflect "retrying might actually help," not just "did
  // some branch not fire." Previously this function unconditionally returned 200 even when a
  // deposit-paid write failed — a transient DB outage could permanently lose a payment record
  // with Stripe considering delivery successful (2026-09-13 external review finding).
  let hadFailure = false;

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    reservationId =
      session.client_reference_id ?? (session.metadata?.reservation_id as string | undefined) ?? null;

    if (reservationId) {
      // Reconcile against this session's OWN attempt row (supabase/migrations/
      // 20260913100000_reservation_checkout_attempts.sql), not just the reservation's single
      // "current session" pointer — every session ever created for this reservation has its own
      // row, so a late/duplicate/out-of-order event for any of them (not only the latest) can
      // still be looked up and validated by its own amount/currency, and a stale session's expiry
      // can never be confused with a different, still-live session's row.
      const { data: attempt, error: attemptLookupError } = await serviceClient
        .from("reservation_checkout_attempts")
        .select("id, amount, currency, status")
        .eq("stripe_checkout_session_id", session.id)
        .maybeSingle();
      if (attemptLookupError) {
        console.error("Failed to look up checkout attempt", attemptLookupError);
        hadFailure = true;
      }
      if (!attempt) {
        // Should not happen for any session created after this migration shipped — log loudly,
        // but still process the reservation-level update below (defensive fallback, e.g. a
        // session created just before this deploy that never got an attempt row).
        console.error(
          `No reservation_checkout_attempts row for session ${session.id} (event ${event.id}) — proceeding without amount/currency validation.`,
        );
      } else if (
        event.type === "checkout.session.completed" &&
        (session.amount_total !== Math.round(Number(attempt.amount) * 100) ||
          session.currency?.toLowerCase() !== attempt.currency.toLowerCase())
      ) {
        // We set price_data ourselves at session-creation time — Stripe reporting a different
        // captured amount/currency than what we recorded for this exact attempt should never
        // happen and is not a reason to withhold recording the payment (Stripe is the source of
        // truth for what was actually charged), but it needs a human to look at it.
        console.error(
          `Amount/currency mismatch for reservation ${reservationId}, session ${session.id}: expected ${attempt.amount} ${attempt.currency}, Stripe reports ${session.amount_total} ${session.currency}.`,
        );
        const { error: auditError } = await serviceClient.from("audit_logs").insert({
          action: "reservation.checkout_amount_mismatch",
          target_type: "reservations",
          target_id: reservationId,
          before: { expected_amount: attempt.amount, expected_currency: attempt.currency },
          after: { stripe_amount_total: session.amount_total, stripe_currency: session.currency },
        });
        if (auditError) console.error("Failed to log amount-mismatch audit row", auditError);
      }

      if (event.type === "checkout.session.completed" && session.payment_status === "paid") {
        if (attempt) {
          const { error: attemptUpdateError } = await serviceClient
            .from("reservation_checkout_attempts")
            .update({ status: "complete", completed_at: new Date().toISOString() })
            .eq("id", attempt.id)
            .neq("status", "complete"); // idempotent guard against redelivery
          if (attemptUpdateError) {
            console.error("Failed to mark checkout attempt complete", attemptUpdateError);
            hadFailure = true;
          }
        }

        // No longer scoped to `stripe_checkout_session_id` matching the reservation's CURRENT
        // pointer — with a per-attempt ledger now recording exactly which session this is, ANY
        // attempt's genuine payment is honored, preserving every real financial event rather than
        // dropping one just because a newer attempt (or a cancellation) has since superseded it as
        // the "current" one. `neq('deposit_status', 'paid')` is the only remaining guard, purely
        // for idempotency against event redelivery.
        const { data: updated, error } = await serviceClient
          .from("reservations")
          .update({
            deposit_status: "paid",
            deposit_paid_at: new Date().toISOString(),
            stripe_payment_intent_id:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : (session.payment_intent?.id ?? null),
          })
          .eq("id", reservationId)
          .neq("deposit_status", "paid")
          .select("id, status")
          .maybeSingle();
        if (error) {
          console.error("Failed to mark deposit paid", error);
          hadFailure = true;
        } else if (updated?.status === "cancelled") {
          // The deposit IS recorded as paid above — never silently lost — but a paid deposit on a
          // cancelled reservation has no automatic next step (refund? honor it and un-cancel?).
          // Flag it so a human resolves it; see cancel_reservation()'s own comment on paid deposits
          // never being auto-refunded.
          console.error(
            `Reservation ${reservationId} deposit paid via session ${session.id} AFTER cancellation — needs manual reconciliation.`,
          );
          const { error: auditError } = await serviceClient.from("audit_logs").insert({
            action: "reservation.paid_after_cancellation",
            target_type: "reservations",
            target_id: reservationId,
            after: { stripe_checkout_session_id: session.id, stripe_event_id: event.id },
          });
          if (auditError) console.error("Failed to log paid-after-cancellation audit row", auditError);
        }
      } else if (event.type === "checkout.session.expired") {
        if (attempt) {
          const { error: attemptUpdateError } = await serviceClient
            .from("reservation_checkout_attempts")
            .update({ status: "expired" })
            .eq("id", attempt.id)
            .eq("status", "open"); // idempotent guard; also never overwrite an already-paid attempt
          if (attemptUpdateError) {
            console.error("Failed to mark checkout attempt expired", attemptUpdateError);
            hadFailure = true;
          }
        }

        // Reservation-level revert stays scoped to stripe_checkout_session_id matching the
        // reservation's CURRENT pointer — without that, an old abandoned session's expiry could
        // arrive AFTER a newer checkout attempt was already created for the same reservation
        // (deposit_status is still 'pending' at that point too, since the newer attempt hasn't
        // been paid yet either) and incorrectly revert that newer, still-live attempt. Requiring
        // the id match means only the actual current session's own expiry can do that.
        const { error } = await serviceClient
          .from("reservations")
          .update({ deposit_status: "not_required" })
          .eq("id", reservationId)
          .eq("stripe_checkout_session_id", session.id)
          .eq("deposit_status", "pending");
        if (error) {
          console.error("Failed to revert expired deposit", error);
          hadFailure = true;
        }
      }
    } else {
      console.error(`${event.type} event ${event.id} had no reservation_id / client_reference_id`);
    }
  }

  if (reservationId) {
    // Idempotent: stripe_event_id is unique, so a redelivered event is a no-op here.
    const { error } = await serviceClient.from("reservation_payment_events").insert({
      reservation_id: reservationId,
      stripe_event_id: event.id,
      event_type: event.type,
      occurred_at: new Date(event.created * 1000).toISOString(),
      raw: event as unknown as Record<string, unknown>,
    });
    if (error && error.code !== "23505") {
      // 23505 = unique_violation on stripe_event_id — expected on redelivery, not an error.
      console.error("Failed to record payment ledger event", error);
      hadFailure = true;
    }
  }

  // A non-2xx here makes Stripe retry delivery later — see the hadFailure comment above. Every
  // branch that flips it logs its own specific error first, so what actually failed is always in
  // the function logs even though the response body stays generic.
  return new Response(JSON.stringify({ received: !hadFailure }), {
    status: hadFailure ? 500 : 200,
    headers: { "Content-Type": "application/json" },
  });
});
