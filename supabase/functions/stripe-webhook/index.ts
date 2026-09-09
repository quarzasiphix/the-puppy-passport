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

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    reservationId =
      session.client_reference_id ?? (session.metadata?.reservation_id as string | undefined) ?? null;

    if (reservationId) {
      if (event.type === "checkout.session.completed" && session.payment_status === "paid") {
        const { error } = await serviceClient
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
          .eq("deposit_status", "pending"); // idempotent guard against redelivery
        if (error) console.error("Failed to mark deposit paid", error);
      } else if (event.type === "checkout.session.expired") {
        // Only revert if still pending — a late/duplicate expired event must never clobber an
        // already-paid deposit (e.g. paid via a retried checkout attempt after the first expired).
        const { error } = await serviceClient
          .from("reservations")
          .update({ deposit_status: "not_required" })
          .eq("id", reservationId)
          .eq("deposit_status", "pending");
        if (error) console.error("Failed to revert expired deposit", error);
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
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
