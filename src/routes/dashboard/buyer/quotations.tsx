import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Receipt } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
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
} from "@/shared/ui/alert-dialog";
import { useAuth } from "@/domains/identity";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { documentExpiryWarning, listMyQuotations, respondToQuotation } from "@/domains/transport";
import { useTranslation } from "@/shared/i18n";

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

function getStatusLabels(t: (key: string) => string): Record<string, string> {
  return {
    sent: t("buyerPanel.quotations.statusSent"),
    viewed: t("buyerPanel.quotations.statusViewed"),
    accepted: t("buyerPanel.quotations.statusAccepted"),
    rejected: t("buyerPanel.quotations.statusRejected"),
    expired: t("buyerPanel.quotations.statusExpired"),
    replaced: t("buyerPanel.quotations.statusReplaced"),
  };
}

function BuyerQuotationsPage() {
  const { t } = useTranslation();
  const statusLabels = getStatusLabels(t);
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["my-quotations", userId],
    enabled: !!userId,
    queryFn: () => listMyQuotations(userId!),
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, response }: { id: string; response: "accepted" | "rejected" }) =>
      respondToQuotation(id, response),
    onSuccess: (_data, vars) => {
      toast.success(
        vars.response === "accepted"
          ? t("buyerPanel.quotations.accepted")
          : t("buyerPanel.quotations.declined"),
      );
      queryClient.invalidateQueries({ queryKey: ["my-quotations", userId] });
      queryClient.invalidateQueries({ queryKey: ["my-transport-requests", userId] });
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, t("buyerPanel.quotations.couldNotRespond"))),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">{t("buyerPanel.quotations.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("buyerPanel.quotations.subtitle")}</p>
      </header>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("buyerPanel.quotations.loading")}</p>
      ) : !query.data?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <Receipt className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            {t("buyerPanel.quotations.emptyBody")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {query.data.map((q) => {
            const isExpired = documentExpiryWarning(q.expiry_date) === "expired";
            return (
              <div key={q.id} className="rounded-2xl border border-border/70 bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {q.transport_requests?.animal_name ?? t("buyerPanel.quotations.animal")}{" "}
                      <span className="text-sm text-muted-foreground">
                        · {q.transport_requests?.request_number}
                      </span>
                    </div>
                    <div className="mt-1 font-display text-2xl font-semibold">
                      {q.total_price?.toLocaleString()} {q.currency}
                    </div>
                    {q.expiry_date && (
                      <p
                        className={
                          documentExpiryWarning(q.expiry_date) === "expired"
                            ? "text-xs font-medium text-destructive"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        {documentExpiryWarning(q.expiry_date) === "expired"
                          ? `${t("buyerPanel.quotations.expiredOn")} ${new Date(q.expiry_date).toLocaleDateString("en-GB")} — ${t("buyerPanel.quotations.askForUpdatedPrice")}`
                          : `${t("buyerPanel.quotations.validUntil")} ${new Date(q.expiry_date).toLocaleDateString("en-GB")}`}
                      </p>
                    )}
                    {q.assumptions && (
                      <p className="mt-2 max-w-md text-xs text-muted-foreground">{q.assumptions}</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("buyerPanel.quotations.estimateNote")}
                    </p>
                  </div>
                  <Badge className={statusStyles[q.status] ?? "bg-muted text-muted-foreground"}>
                    {statusLabels[q.status] ?? q.status}
                  </Badge>
                </div>
                {(q.status === "sent" || q.status === "viewed") && (
                  <div className="mt-4 flex gap-2">
                    {!isExpired && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm">{t("buyerPanel.quotations.acceptQuotation")}</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("buyerPanel.quotations.acceptConfirmTitle")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("buyerPanel.quotations.acceptConfirmBodyPrefix")}{" "}
                              {q.total_price?.toLocaleString()} {q.currency}{" "}
                              {t("buyerPanel.quotations.acceptConfirmBodySuffix")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("buyerPanel.quotations.cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                respondMutation.mutate({ id: q.id, response: "accepted" })
                              }
                            >
                              {t("buyerPanel.quotations.accept")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={respondMutation.isPending}
                      onClick={() => respondMutation.mutate({ id: q.id, response: "rejected" })}
                    >
                      {isExpired
                        ? t("buyerPanel.quotations.dismiss")
                        : t("buyerPanel.quotations.decline")}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
