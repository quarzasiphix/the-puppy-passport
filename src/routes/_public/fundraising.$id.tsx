import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, FlaskConical, MapPin } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Checkbox } from "@/shared/ui/checkbox";
import { useAuth } from "@/domains/identity";
import {
  contributeSimulated,
  getPublicCampaign,
  listPublicContributions,
} from "@/domains/fundraising";
import { FUNDRAISING_ENABLED } from "@/domains/fundraising";
import { FundraisingDisabledNotice } from "@/domains/fundraising";

import { getFriendlyErrorMessage } from "@/shared/lib/errors";
export const Route = createFileRoute("/_public/fundraising/$id")({
  loader: async ({ params }) => {
    if (!FUNDRAISING_ENABLED) return null;
    const campaign = await getPublicCampaign(params.id).catch(() => null);
    if (!campaign) throw notFound();
    return campaign;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.title} — Havenpaw` : "Campaign — Havenpaw" }],
  }),
  component: CampaignPage,
});

function CampaignPage() {
  const campaign = Route.useLoaderData();
  const { userId, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("20");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const contributionsQuery = useQuery({
    queryKey: ["campaign-public-contributions", campaign?.id],
    enabled: !!campaign,
    queryFn: () => listPublicContributions(campaign!.id),
  });

  const contributeMutation = useMutation({
    mutationFn: () =>
      contributeSimulated({
        campaignId: campaign!.id,
        supporterId: userId!,
        amount: Number(amount),
        currency: campaign!.currency,
        displayPublicly: !anonymous,
        publicMessage: message.trim() || undefined,
      }),
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["campaign-public-contributions", campaign?.id] });
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not contribute.")),
  });

  if (!FUNDRAISING_ENABLED || !campaign) {
    return (
      <div className="container-page max-w-2xl py-10">
        <FundraisingDisabledNotice />
      </div>
    );
  }

  const remaining = Math.max(0, campaign.targetAmount - campaign.amountCollected);

  return (
    <div className="container-page max-w-2xl py-10">
      <Link
        to="/fundraising"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> All campaigns
      </Link>

      <div className="rounded-2xl border border-border/70 bg-card p-6">
        <h1 className="font-display text-2xl font-semibold">{campaign.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {campaign.organisationName} — {campaign.animalName}
        </p>
        {(campaign.pickupCountry || campaign.destinationCountry) && (
          <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5" />
            {campaign.pickupCountry ?? "?"} → {campaign.destinationCountry ?? "?"} (approximate
            route only)
          </div>
        )}
        {campaign.description && <p className="mt-3 text-sm">{campaign.description}</p>}

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary"
            style={{
              width: `${Math.min(100, (campaign.amountCollected / Math.max(campaign.targetAmount, 1)) * 100)}%`,
            }}
          />
        </div>
        <div className="mt-1 text-sm">
          <span className="font-semibold">
            {campaign.amountCollected} {campaign.currency}
          </span>{" "}
          <span className="text-muted-foreground">
            collected of {campaign.targetAmount} {campaign.currency} — {remaining} remaining
          </span>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          When the target is reached, funds are applied directly to this animal's Havenpaw transport
          — never paid out to an individual. This is not a donation toward the cost of the animal
          itself.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-border/70 bg-card p-6">
        {!isSignedIn ? (
          <p className="text-sm text-muted-foreground">
            <Link to="/signin" className="text-primary hover:underline">
              Sign in
            </Link>{" "}
            to support this campaign.
          </p>
        ) : submitted ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto size-8 text-success" />
            <p className="mt-2 font-medium">Thank you for your support</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This was a simulated, development-only contribution — no real payment provider is
              connected yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2 text-xs text-warning-foreground">
              <FlaskConical className="size-3.5 shrink-0" />
              Development payment simulation only — no real payment provider is connected, and this
              is never available in production.
            </div>
            <div>
              <Label>Amount ({campaign.currency})</Label>
              <Input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Public message (optional)</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="anon"
                checked={anonymous}
                onCheckedChange={(v) => setAnonymous(v === true)}
              />
              <Label htmlFor="anon" className="text-sm font-normal">
                Keep my name private on the public campaign page
              </Label>
            </div>
            <Button
              className="w-full"
              disabled={!amount || Number(amount) <= 0 || contributeMutation.isPending}
              onClick={() => contributeMutation.mutate()}
            >
              Simulate contribution
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6">
        <h2 className="mb-3 font-display text-lg font-semibold">Supporters</h2>
        {!contributionsQuery.data?.length ? (
          <p className="text-sm text-muted-foreground">Be the first to support this campaign.</p>
        ) : (
          <div className="space-y-2">
            {contributionsQuery.data.map((c) => (
              <div key={c.id} className="rounded-xl border border-border/70 bg-card p-3 text-sm">
                <span className="font-medium">
                  {c.amount} {c.currency}
                </span>
                {c.public_message && (
                  <span className="text-muted-foreground"> — "{c.public_message}"</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
