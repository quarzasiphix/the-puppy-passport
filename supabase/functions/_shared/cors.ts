// Shared CORS headers for edge functions called directly from the browser (supabase.functions.invoke).
// The stripe-webhook function does NOT use this — Stripe calls it server-to-server, no browser
// CORS preflight involved, and it must never echo back this permissive header for a POST it treats
// as authenticated by signature alone.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
