// Creates a Stripe Checkout Session for a reservation's zaliczka (deposit). "Platform collects,
// manual payout" model — see supabase/migrations/20260909000100_reservation_deposit_payments.sql
// and docs/RESERVATION_PAYMENT_DESIGN.md. No Stripe Connect: the platform account collects the
// deposit directly; breeders are paid out manually outside the app for now.
//
// Deployed with verify_jwt = true (default) — the caller must be a signed-in buyer.
//
// Requires these Supabase Edge Function secrets (not set yet as of 2026-09-09 — no Stripe account
// exists; until they're set this function returns a clear 503, never a fake success):
//   STRIPE_SECRET_KEY
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are auto-injected by the platform.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.4.0";
import { corsHeaders } from "../_shared/cors.ts";
import { detectStripeKeyMode } from "../_shared/stripe-mode.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const stripeMode = detectStripeKeyMode(stripeSecretKey);
  if (!stripeSecretKey || stripeMode === "unconfigured") {
    return jsonResponse(
      { error: "Stripe is not configured yet. This deposit cannot be paid online until it is." },
      503,
    );
  }
  // Visible in function logs on every real call — the fastest way to confirm in production
  // whether a given deposit was actually charged against a real card (live) or not (test),
  // without having to go look up the key itself.
  console.log(`create-deposit-checkout-session: Stripe key mode = ${stripeMode}`);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  let reservationId: string | undefined;
  let successUrl: string | undefined;
  let cancelUrl: string | undefined;
  try {
    const body = await req.json();
    reservationId = body.reservationId;
    successUrl = body.successUrl;
    cancelUrl = body.cancelUrl;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  if (!reservationId || !successUrl || !cancelUrl) {
    return jsonResponse(
      { error: "reservationId, successUrl and cancelUrl are all required" },
      400,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // RLS-scoped client, carrying the caller's own JWT — the reservation SELECT below is only ever
  // as permissive as "buyers view their own reservations", so a buyer can't probe someone else's
  // reservation by id even before the explicit buyer_id check further down.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  const { data: reservation, error: reservationError } = await userClient
    .from("reservations")
    .select(
      "id, buyer_id, currency, deposit_amount, deposit_status, animal_id, animals(name)",
    )
    .eq("id", reservationId)
    .maybeSingle();
  if (reservationError || !reservation) {
    return jsonResponse({ error: "Reservation not found" }, 404);
  }
  if (reservation.buyer_id !== user.id) {
    return jsonResponse({ error: "This reservation does not belong to you" }, 403);
  }
  if (reservation.deposit_status !== "pending") {
    return jsonResponse(
      { error: "No deposit is currently awaiting payment on this reservation" },
      409,
    );
  }
  if (!reservation.deposit_amount || reservation.deposit_amount <= 0) {
    return jsonResponse({ error: "This reservation has no deposit amount set" }, 409);
  }

  const currency = (reservation.currency ?? "PLN").toLowerCase();
  const puppyName =
    (reservation.animals as { name?: string } | null)?.name ?? "your reservation";

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    client_reference_id: reservation.id,
    customer_email: user.email ?? undefined,
    metadata: { reservation_id: reservation.id },
    line_items: [
      {
        price_data: {
          currency,
          unit_amount: Math.round(reservation.deposit_amount * 100),
          product_data: {
            name: `Reservation deposit — ${puppyName}`,
            description: "Anemalo reservation deposit (zaliczka)",
          },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  // Service-role write — the reservation's stripe_checkout_session_id column is locked against
  // any authenticated-role write by prevent_client_writes_to_deposit_payment_fields(); only this
  // service-role client (auth.uid() is null server-side) can set it.
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { error: updateError } = await serviceClient
    .from("reservations")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", reservation.id);
  if (updateError) {
    console.error("Failed to record checkout session id on reservation", updateError);
  }

  return jsonResponse({
    checkoutUrl: session.url,
    checkoutSessionId: session.id,
    // Lets the frontend show a "test mode" notice on the checkout button if it ever wants to —
    // never used to decide whether to trust payment success, which always comes from the webhook.
    stripeMode,
  });
});
