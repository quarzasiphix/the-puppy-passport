import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/domains/identity";
import { getMyKennel } from "@/domains/breeders";
import { startApplicationConversation } from "@/domains/messaging";
import { listReservationsForMyKennel } from "../services/reservations";
import { reservationStatusLabel, depositStatusLabel, agreementStatusLabel } from "../status";
import { RequestDepositDialog } from "../components/request-deposit-dialog";
import { CancelReservationDialog } from "../components/cancel-reservation-dialog";
import { useTranslation } from "@/shared/i18n";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";

const CANCELLABLE_STATUSES = ["awaiting_breeder", "awaiting_buyer", "confirmed"];

export function BreederReservationsPage() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const navigate = useNavigate();
  const { data: orgId } = useQuery({
    queryKey: ["my-kennel-id", userId],
    enabled: !!userId,
    queryFn: async () => {
      const kennel = await getMyKennel(userId!);
      return kennel?.id ?? null;
    },
  });
  const { data: reservations, isLoading } = useQuery({
    queryKey: ["kennel-reservations", orgId],
    enabled: !!orgId,
    queryFn: () => listReservationsForMyKennel(orgId!),
  });

  const messageMutation = useMutation({
    mutationFn: ({ animalId, buyerId }: { animalId: string; buyerId: string }) =>
      startApplicationConversation(animalId, buyerId),
    onSuccess: (conversationId) => {
      navigate({ to: "/dashboard/breeder/messages", search: { conversation: conversationId } });
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("breederPanel.reservations.conversationFailed"))),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">
          {t("breederPanel.reservations.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("breederPanel.reservations.subtitle")}</p>
      </header>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("breederPanel.reservations.loading")}</p>
      ) : !reservations?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t("breederPanel.reservations.emptyBody")}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-4">{t("breederPanel.reservations.colPuppy")}</th>
                <th className="p-4">{t("breederPanel.reservations.colBuyer")}</th>
                <th className="p-4">{t("breederPanel.reservations.colDeposit")}</th>
                <th className="p-4">{t("breederPanel.reservations.colAgreement")}</th>
                <th className="p-4">{t("breederPanel.reservations.colCollection")}</th>
                <th className="p-4">{t("breederPanel.reservations.colStatus")}</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {reservations.map((r) => (
                <tr key={r.id} className="hover:bg-secondary/40">
                  <td className="p-4 font-medium">{r.puppyName}</td>
                  <td className="p-4">{r.buyerName}</td>
                  <td className="p-4">
                    <Badge
                      variant={r.depositStatus === "paid" ? "default" : "secondary"}
                      className={r.depositStatus === "paid" ? "bg-success/15 text-success" : ""}
                    >
                      {depositStatusLabel(r.depositStatus, t)}
                    </Badge>
                    {r.depositStatus === "paid" && r.depositPaidAt && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {t("breederPanel.reservations.depositPaidOn")}{" "}
                        {new Date(r.depositPaidAt).toLocaleDateString("en-GB")}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <Badge variant="secondary" className="capitalize">
                      {agreementStatusLabel(r.agreementStatus, t)}
                    </Badge>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {r.plannedCollectionDate
                      ? new Date(r.plannedCollectionDate).toLocaleDateString("en-GB")
                      : t("breederPanel.reservations.notSet")}
                  </td>
                  <td className="p-4">{reservationStatusLabel(r.status, t)}</td>
                  <td className="p-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {r.depositStatus === "not_required" &&
                        r.status !== "cancelled" &&
                        r.status !== "completed" && <RequestDepositDialog reservationId={r.id} />}
                      {r.status === "confirmed" && (
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/transport/request" search={{ animalId: r.animalId }}>
                            {t("breederPanel.reservations.requestTransport")}
                          </Link>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={messageMutation.isPending}
                        onClick={() =>
                          messageMutation.mutate({ animalId: r.animalId, buyerId: r.buyerId })
                        }
                      >
                        <MessageCircle className="mr-1 size-4" />
                        {t("breederPanel.reservations.messageBuyer")}
                      </Button>
                      {CANCELLABLE_STATUSES.includes(r.status) && (
                        <CancelReservationDialog
                          reservationId={r.id}
                          depositStatus={r.depositStatus}
                          invalidateQueryKey={["kennel-reservations", orgId]}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
