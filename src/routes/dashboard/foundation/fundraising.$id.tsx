import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/domains/identity";
import { getMyFoundation } from "@/domains/breeders";
import {
  campaignStatusLabels,
  listCampaignsForOrg,
  listPublicContributions,
  submitCampaignForReview,
} from "@/domains/fundraising";
import { FUNDRAISING_ENABLED } from "@/domains/fundraising";
import { FundraisingDisabledNotice } from "@/domains/fundraising";

import { getFriendlyErrorMessage } from "@/shared/lib/errors";
export const Route = createFileRoute("/dashboard/foundation/fundraising/$id")({
  component: CampaignDetailPage,
});

function CampaignDetailPage() {
  const { id } = Route.useParams();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const orgQuery = useQuery({
    queryKey: ["my-foundation", userId],
    enabled: !!userId,
    queryFn: () => getMyFoundation(userId!),
  });
  const org = orgQuery.data;

  const campaignsQuery = useQuery({
    queryKey: ["org-fundraising-campaigns", org?.id],
    enabled: !!org?.id,
    queryFn: () => listCampaignsForOrg(org!.id),
  });
  const campaign = campaignsQuery.data?.find((c) => c.id === id);

  const contributionsQuery = useQuery({
    queryKey: ["campaign-public-contributions", id],
    enabled: !!campaign,
    queryFn: () => listPublicContributions(id),
  });

  const submitMutation = useMutation({
    mutationFn: () => submitCampaignForReview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-fundraising-campaigns", org?.id] });
      toast.success("Submitted for admin review.");
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not submit.")),
  });

  if (!FUNDRAISING_ENABLED) {
    return <FundraisingDisabledNotice />;
  }

  if (campaignsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!campaign) {
    throw notFound();
  }

  return (
    <div>
      <Link
        to="/dashboard/foundation/fundraising"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> All campaigns
      </Link>

      <header className="rounded-2xl border border-border/70 bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">{campaign.title}</h1>
            <p className="text-sm text-muted-foreground">{campaign.animalName}</p>
          </div>
          <Badge variant="secondary">{campaignStatusLabels[campaign.status]}</Badge>
        </div>
        {campaign.description && <p className="mt-3 text-sm">{campaign.description}</p>}
        <div className="mt-4 font-display text-2xl font-semibold">
          {campaign.amountCollected} / {campaign.targetAmount} {campaign.currency}
        </div>
        {campaign.status === "draft" && (
          <Button
            className="mt-4"
            disabled={submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            Submit for admin review
          </Button>
        )}
      </header>

      <div className="mt-6">
        <h2 className="mb-3 font-display text-lg font-semibold">Public updates & contributions</h2>
        {!contributionsQuery.data?.length ? (
          <p className="text-sm text-muted-foreground">No contributions yet.</p>
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
