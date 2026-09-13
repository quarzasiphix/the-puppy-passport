// Cancels a reservation AND closes out any live Stripe Checkout session for its deposit in the
// same request — added 2026-09-13 to close a race the plain cancel_reservation() SQL RPC could
// not: a plpgsql function has no way to call Stripe, so cancelling a reservation could leave its
// checkout page open and payable even after the reservation (and the puppy it held) had moved on.
// See docs/RESERVATION_PAYMENT_DESIGN.md and the 2026-09-13 comments in stripe-webhook/index.ts
// and create-deposit-checkout-session/index.ts for the full race this is part of fixing — this
// function shrinks the window further by actively expiring the session; stripe-webhook's
// session-id-scoped guards are still the real safety net if a payment lands anyway (never drops
// money, flags it for manual reconciliation instead).
//
// Deployed with verify_jwt = true (default) — the caller must be a signed-in buyer, breeder, or
// admin; the actual authorization/state-machine rules stay entirely in cancel_reservation() itself
// (called here via the caller's own JWT, not duplicated).
//
// Requires the same Supabase Edge Function secrets as create-deposit-checkout-session:
//   STRIPE_SECRET_KEY
// If unset, the reservation is still cancelled (the RPC doesn't need Stripe) — only the session
// expiry step is skipped, logged, and otherwise non-fatal.

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

// Mirrors the errcodes cancel_reservation() actually raises (see
// supabase/migrations/20260912120000_reservation_cancellation.sql) — gives the frontend a proper
// HTTP status instead of a blanket 400 for every failure.
function statusForPgError(code: string | undefined): number {
  if (code === "42501") return 403;
  if (code === "P0002") return 404;
  if (code === "P0001") return 409;
  return 400;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  let reservationId: string | undefined;
  let reason: string | undefined;
  try {
    const body = await req.json();
    reservationId = body.reservationId;
    reason = body.reason;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  if (!reservationId) {
    return jsonResponse({ error: "reservationId is required" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // RLS-scoped client carrying the caller's own JWT — cancel_reservation() re-checks
  // buyer/owns_org/is_admin itself, so this call is exactly as authorized as calling the RPC
  // directly from the browser was before this function existed.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // Read the deposit/session state BEFORE cancelling — cancel_reservation() may itself flip
  // deposit_status to 'not_required', so this is the only chance to see whether there was a live
  // 'pending' checkout session worth expiring at Stripe.
  const { data: before } = await userClient
    .from("reservations")
    .select("deposit_status, stripe_checkout_session_id")
    .eq("id", reservationId)
    .maybeSingle();

  const { error: cancelError } = await userClient.rpc("cancel_reservation", {
    p_reservation_id: reservationId,
    p_reason: reason?.trim() || undefined,
  });
  if (cancelError) {
    return jsonResponse(
      { error: cancelError.message },
      statusForPgError((cancelError as { code?: string }).code),
    );
  }

  if (before?.deposit_status === "pending" && before.stripe_checkout_session_id) {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (detectStripeKeyMode(stripeSecretKey) !== "unconfigured") {
      try {
        const stripe = new Stripe(stripeSecretKey!, {
          apiVersion: "2024-06-20",
          httpClient: Stripe.createFetchHttpClient(),
        });
        const session = await stripe.checkout.sessions.retrieve(before.stripe_checkout_session_id);
        if (session.status === "open") {
          await stripe.checkout.sessions.expire(before.stripe_checkout_session_id);
        }
      } catch (err) {
        // Non-fatal — the reservation is already cancelled either way. stripe-webhook's
        // session-id-scoped guard is the backstop if this session somehow still gets paid.
        console.error("Could not expire checkout session on cancellation (continuing)", err);
      }
    }
  }

  return jsonResponse({ success: true });
});
