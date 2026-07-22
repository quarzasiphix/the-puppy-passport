import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  activateCampaign,
  approveCampaign,
  campaignStatusLabels,
  listCampaignsForReview,
  suspendCampaign,
} from "@/lib/queries/fundraising";
import { FUNDRAISING_ENABLED } from "@/lib/fundraising-flag";
import { FundraisingDisabledNotice } from "@/components/fundraising-disabled-notice";

export const Route = createFileRoute("/dashboard/admin/fundraising")({
  component: AdminFundraisingPage,
});

function AdminFundraisingPage() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const campaignsQuery = useQuery({
    queryKey: ["all-fundraising-campaigns"],
    queryFn: listCampaignsForReview,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["all-fundraising-campaigns"] });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveCampaign(id, userId!),
    onSuccess: () => {
      invalidate();
      toast.success("Approved.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not approve."),
  });
  const activateMutation = useMutation({
    mutationFn: (id: string) => activateCampaign(id),
    onSuccess: () => {
      invalidate();
      toast.success("Campaign is now active.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not activate."),
  });
  const suspendMutation = useMutation({
    mutationFn: (id: string) => suspendCampaign(id),
    onSuccess: () => {
      invalidate();
      toast.success("Suspended.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not suspend."),
  });

  if (!FUNDRAISING_ENABLED) {
    return (
      <div>
        <header className="mb-6">
          <h1 className="font-display text-3xl font-medium">Fundraising</h1>
        </header>
        <FundraisingDisabledNotice />
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Fundraising</h1>
        <p className="text-sm text-muted-foreground">
          Review and manage every organisation's campaigns. Only approved foundations, shelters and
          rescues can create one at all — this is a review/suspend queue, not an eligibility gate.
        </p>
      </header>

      {!campaignsQuery.data?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center text-sm text-muted-foreground">
          No fundraising campaigns yet.
        </div>
      ) : (
        <div className="space-y-3">
          {campaignsQuery.data.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-display text-lg font-semibold">{c.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {c.organisationName} — {c.animalName}
                  </div>
                </div>
                <Badge variant="secondary">{campaignStatusLabels[c.status]}</Badge>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {c.amountCollected} / {c.targetAmount} {c.currency} collected
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {c.status === "organisation_review" && (
                  <Button
                    size="sm"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate(c.id)}
                  >
                    Approve
                  </Button>
                )}
                {c.status === "approved" && (
                  <Button
                    size="sm"
                    disabled={activateMutation.isPending}
                    onClick={() => activateMutation.mutate(c.id)}
                  >
                    Activate
                  </Button>
                )}
                {["active", "approved", "target_reached", "partially_funded"].includes(
                  c.status,
                ) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={suspendMutation.isPending}
                    onClick={() => suspendMutation.mutate(c.id)}
                  >
                    Suspend
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
