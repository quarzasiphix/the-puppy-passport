import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { listMyQuotations, respondToQuotation } from "@/lib/queries/transport";
import { useTranslation } from "@/lib/i18n";
import { formatDate } from "@/lib/presentation/date";

export const Route = createFileRoute("/dashboard/buyer/quotations")({
  component: BuyerQuotationsPage,
});

const statusStyles: Record<string, string> = {
  sent: "bg-accent/15 text-accent",
  viewed: "bg-accent/15 text-accent",
  accepted: "bg-success/15 text-success",
  rejected: "bg-destructive/10 text-destructive",
  expired: "bg-destructive/10 text-destructive",
  replaced: "bg-muted text-muted-foreground",
};

function BuyerQuotationsPage() {
  const { userId } = useAuth();
  const { locale } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["my-quotations", userId],
    enabled: !!userId,
    queryFn: () => listMyQuotations(userId!),
  });

  const respondMutation = useMutation({
    mutationFn: ({
      id,
      transportRequestId,
      response,
    }: {
      id: string;
      transportRequestId: string;
      response: "accepted" | "rejected";
    }) => respondToQuotation(id, transportRequestId, response, userId!),
    onSuccess: (_data, vars) => {
      toast.success(vars.response === "accepted" ? "Quotation accepted." : "Quotation declined.");
      queryClient.invalidateQueries({ queryKey: ["my-quotations", userId] });
      queryClient.invalidateQueries({ queryKey: ["my-transport-requests", userId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not respond."),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Quotations</h1>
        <p className="text-sm text-muted-foreground">
          Review price quotes operations has prepared for your transport requests.
        </p>
      </header>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !query.data?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <Receipt className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No quotations yet — you'll see one here once operations prepares it for a request.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {query.data.map((q) => (
            <div key={q.id} className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {q.transport_requests?.animal_name ?? "Animal"}{" "}
                    <span className="text-sm text-muted-foreground">
                      · {q.transport_requests?.request_number}
                    </span>
                  </div>
                  <div className="mt-1 font-display text-2xl font-semibold">
                    {q.total_price?.toLocaleString()} {q.currency}
                  </div>
                  {q.expiry_date && (
                    <p className="text-xs text-muted-foreground">
                      Valid until {formatDate(q.expiry_date, locale)}
                    </p>
                  )}
                  {q.assumptions && (
                    <p className="mt-2 max-w-md text-xs text-muted-foreground">{q.assumptions}</p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    This is an estimate based on the details you provided — final confirmation
                    happens after acceptance.
                  </p>
                </div>
                <Badge className={statusStyles[q.status] ?? "bg-muted text-muted-foreground"}>
                  {q.status}
                </Badge>
              </div>
              {(q.status === "sent" || q.status === "viewed") && (
                <div className="mt-4 flex gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm">Accept quotation</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Accept this quotation?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This confirms you agree to {q.total_price?.toLocaleString()} {q.currency}{" "}
                          for this transport. Operations will follow up on scheduling and remaining
                          documents.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            respondMutation.mutate({
                              id: q.id,
                              transportRequestId: q.transport_request_id,
                              response: "accepted",
                            })
                          }
                        >
                          Accept
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={respondMutation.isPending}
                    onClick={() =>
                      respondMutation.mutate({
                        id: q.id,
                        transportRequestId: q.transport_request_id,
                        response: "rejected",
                      })
                    }
                  >
                    Decline
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
