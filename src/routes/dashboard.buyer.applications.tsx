import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import {
  applicationStatusLabels,
  applicationStatusStyles,
  listMyApplications,
  withdrawApplication,
} from "@/lib/queries/applications";
import { startApplicationConversation } from "@/lib/queries/messaging";
import { useTranslation } from "@/lib/i18n";
import { formatDate } from "@/lib/presentation/date";
import { EmptyState } from "@/components/public/empty-state";
import { ErrorState } from "@/components/public/error-state";

import { getFriendlyErrorMessage } from "@/lib/errors";
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
  const { locale } = useTranslation();
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
          Every puppy application and adoption/rehoming enquiry you've sent, and the response.
        </p>
      </header>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : query.isError ? (
        <ErrorState
          title="Couldn't load your applications"
          description="Something went wrong — this isn't the same as having no applications. Please try again."
          action={
            <Button variant="outline" onClick={() => query.refetch()}>
              Try again
            </Button>
          }
        />
      ) : !query.data?.length ? (
        <EmptyState
          title="No applications yet"
          description="Find a puppy or a dog to adopt and apply from its listing page."
          action={
            <>
              <Button asChild>
                <Link to="/find-a-dog">Browse puppies</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/adoptions">Browse adoptions</Link>
              </Button>
            </>
          }
        />
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
                    {formatDate(a.submitted_at, locale)}
                  </div>
                </div>
                <Badge className={applicationStatusStyles[a.status]}>
                  {applicationStatusLabels[a.status]}
                </Badge>
              </div>
              {a.breeder_response && (
                <p className="mt-3 rounded-lg bg-secondary/50 p-3 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Response: </span>
                  {a.breeder_response}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  {a.application_type === "purchase" ? (
                    <Link to="/puppies/$id" params={{ id: a.animal_id }}>
                      Open puppy
                    </Link>
                  ) : (
                    <Link to="/adoptions/$id" params={{ id: a.animal_id }}>
                      Open listing
                    </Link>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={messageMutation.isPending}
                  onClick={() => messageMutation.mutate(a.animal_id)}
                >
                  <MessageCircle className="mr-1 size-3.5" />{" "}
                  {a.application_type === "purchase" ? "Message breeder" : "Message organisation"}
                </Button>
                {withdrawable.includes(a.status) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        disabled={withdrawMutation.isPending}
                      >
                        Withdraw
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Withdraw this application?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {a.application_type === "purchase"
                            ? "The breeder will no longer see this as an active application. You can apply again later if the puppy is still available."
                            : "The organisation will no longer see this as an active application. You can apply again later if the listing is still available."}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => withdrawMutation.mutate(a.id)}>
                          Withdraw
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
