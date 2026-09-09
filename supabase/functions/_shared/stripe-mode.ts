// Stripe keys are self-describing by prefix (sk_test_/sk_live_, pk_test_/pk_live_, and their
// restricted-key equivalents rk_test_/rk_live_) — this reads that prefix instead of relying on a
// separately-maintained "which environment am I" flag that could drift from the actual key in use.
// Used so ops/logs can always see which mode a deployed function is actually running in, and so a
// visibly-wrong pairing (e.g. a live key where a test key was expected) can be caught rather than
// silently charging real cards.
export type StripeKeyMode = "test" | "live" | "unconfigured";

export function detectStripeKeyMode(key: string | undefined | null): StripeKeyMode {
  if (!key) return "unconfigured";
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_") || key.startsWith("pk_live_")) {
    return "live";
  }
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_") || key.startsWith("pk_test_")) {
    return "test";
  }
  return "unconfigured";
}
