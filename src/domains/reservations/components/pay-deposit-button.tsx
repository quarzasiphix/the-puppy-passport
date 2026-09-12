import { useMutation } from "@tanstack/react-query";
import { usePostHog } from "posthog-js/react";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { createDepositCheckoutSession } from "@/domains/payments";

// Buyer-side action: redirects to a Stripe Checkout Session for the reservation's deposit. Never
// marks anything paid itself — deposit_status only ever flips to 'paid' via the stripe-webhook
// edge function, after redirect. See docs/RESERVATION_PAYMENT_DESIGN.md.
export function PayDepositButton({
  reservationId,
  depositAmount,
  currency,
}: {
  reservationId: string;
  depositAmount: number;
  currency: string;
}) {
  const posthog = usePostHog();
  const mutation = useMutation({
    mutationFn: async () => {
      const returnPath = window.location.pathname;
      const { checkoutUrl } = await createDepositCheckoutSession(
        reservationId,
        `${window.location.origin}${returnPath}?deposit=success`,
        `${window.location.origin}${returnPath}?deposit=cancelled`,
      );
      posthog.capture("deposit_checkout_started", {
        amount: depositAmount,
        currency,
      });
      window.location.href = checkoutUrl;
    },
    onError: (err) => {
      // The edge function returns a plain 503 with a "not configured" message until a real Stripe
      // account is wired up — surface that as-is rather than a generic failure.
      const message =
        err instanceof Error ? err.message : "Could not start payment. Please try again.";
      toast.error(message);
    },
  });

  return (
    <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
      <CreditCard className="mr-1 size-4" />
      Pay deposit — {depositAmount} {currency}
    </Button>
  );
}
