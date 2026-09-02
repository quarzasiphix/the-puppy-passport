import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { useAuth } from "@/domains/identity";
import {
  applicationStatusLabels,
  applicationStatusStyles,
  listMyApplications,
  withdrawApplication,
} from "@/domains/marketplace";
import { startApplicationConversation } from "@/domains/messaging";

import { getFriendlyErrorMessage } from "@/shared/lib/errors";
export const Route = createFileRoute("/dashboard/buyer/applications")({
  component: BuyerApplications,
});

const withdrawable: string[] = [
  "submitted",
  "under_review",
  "more_info_requested",
  "call_requested",
  "waiting_list",
];

function BuyerApplications() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["my-applications", userId],
    enabled: !!userId,
    queryFn: () => listMyApplications(userId!),
  });

  const withdrawMutation = useMutation({
    mutationFn: withdrawApplication,
    onSuccess: () => {
      toast.success("Application withdrawn.");
      queryClient.invalidateQueries({ queryKey: ["my-applications", userId] });
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not withdraw.")),
  });

  const messageMutation = useMutation({
    mutationFn: (animalId: string) => startApplicationConversation(animalId),
    onSuccess: (conversationId) => {
      navigate({ to: "/dashboard/buyer/messages", search: { conversation: conversationId } });
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not open conversation.")),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Your applications</h1>
        <p className="text-sm text-muted-foreground">
          Every puppy application you've sent, and the breeder's response.
        </p>
      </header>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !query.data?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <p className="font-medium">No applications yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Find a puppy you love and apply from its listing page.
          </p>
          <Button asChild className="mt-4">
            <Link to="/find-a-dog">Browse available puppies</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {query.data.map((a) => (
            <li key={a.id} className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-display text-lg font-semibold">
                    {a.animals?.name ?? "This listing"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {a.animals?.organisations?.name ?? "Independent listing"} · Applied{" "}
                    {new Date(a.submitted_at).toLocaleDateString("en-GB")}
                  </div>
                </div>
                <Badge className={applicationStatusStyles[a.status]}>
                  {applicationStatusLabels[a.status]}
                </Badge>
              </div>
              {a.breeder_response && (
                <p className="mt-3 rounded-lg bg-secondary/50 p-3 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Breeder: </span>
                  {a.breeder_response}
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/puppies/$id" params={{ id: a.animal_id }}>
                    Open puppy
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={messageMutation.isPending}
                  onClick={() => messageMutation.mutate(a.animal_id)}
                >
                  <MessageCircle className="mr-1 size-3.5" /> Message breeder
                </Button>
                {withdrawable.includes(a.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    disabled={withdrawMutation.isPending}
                    onClick={() => withdrawMutation.mutate(a.id)}
                  >
                    Withdraw
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
