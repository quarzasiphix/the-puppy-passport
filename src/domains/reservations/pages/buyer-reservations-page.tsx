import { useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/domains/identity";
import {
  findActiveTransportRequestsForAnimals,
  nextActionForStatus,
  transportMilestones,
  milestoneIndexForStatus,
} from "@/domains/transport";
import { startApplicationConversation } from "@/domains/messaging";
import { listMyReservationsAsBuyer } from "../services/reservations";
import { reservationStatusLabel, depositStatusLabel, agreementStatusLabel } from "../status";
import { PayDepositButton } from "../components/pay-deposit-button";
import { CancelReservationDialog } from "../components/cancel-reservation-dialog";
import { useTranslation } from "@/shared/i18n";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";

const CANCELLABLE_STATUSES = ["awaiting_breeder", "awaiting_buyer", "confirmed"];

export function BuyerReservationsPage() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: reservations, isLoading } = useQuery({
    queryKey: ["my-reservations", userId],
    enabled: !!userId,
    queryFn: () => listMyReservationsAsBuyer(userId!),
  });

  const messageMutation = useMutation({
    mutationFn: (animalId: string) => startApplicationConversation(animalId),
    onSuccess: (conversationId) => {
      navigate({ to: "/dashboard/buyer/messages", search: { conversation: conversationId } });
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("buyerPanel.reservations.conversationFailed"))),
  });

  // PayDepositButton sends the buyer to a Stripe-hosted Checkout page and back to this exact
  // route with `?deposit=success` / `?deposit=cancelled` appended (see its success/cancel URLs).
  // That redirect itself proves nothing was actually charged — deposit_status only ever flips to
  // 'paid' server-side via the stripe-webhook edge function (see docs/RESERVATION_PAYMENT_DESIGN.md)
  // — so this only ever shows an acknowledgement + triggers a refetch, never marks anything paid
  // itself. The webhook is normally faster than this page finishing its redirect, but isn't
  // guaranteed to be, so a second refetch shortly after covers the rare case where the first one
  // still shows 'pending'. Runs once on mount; the query param is stripped afterwards so a later
  // refresh/back-navigation doesn't re-show the toast.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const depositResult = params.get("deposit");
    if (depositResult !== "success" && depositResult !== "cancelled") return;

    // Strip the param first (not last) so every branch below — including an early return — still
    // cleans up the URL; otherwise a refresh or back-navigation would replay the toast forever.
    params.delete("deposit");
    const rest = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (rest ? `?${rest}` : ""));

    if (depositResult === "cancelled") {
      toast.info(t("buyerPanel.reservations.depositCancelledToast"));
      return;
    }

    toast.success(t("buyerPanel.reservations.depositPaidToast"));
    queryClient.invalidateQueries({ queryKey: ["my-reservations", userId] });
    const recheck = setTimeout(
      () => queryClient.invalidateQueries({ queryKey: ["my-reservations", userId] }),
      2500,
    );
    return () => clearTimeout(recheck);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
  }, []);

  // Once a buyer submits transport for a confirmed reservation, the page needs to say so instead
  // of showing "Request transport" again as if nothing happened — see docs/DECISIONS.md.
  const animalIds = (reservations ?? []).map((r) => r.animalId);
  const transportByAnimalQuery = useQuery({
    queryKey: ["reservation-transport-requests", userId, animalIds],
    enabled: !!userId && animalIds.length > 0,
    queryFn: () => findActiveTransportRequestsForAnimals(userId!, animalIds),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">{t("buyerPanel.reservations.title")}</h1>
      </header>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("buyerPanel.reservations.loading")}</p>
      ) : !reservations?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("buyerPanel.reservations.emptyBody")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-display text-lg font-semibold">
                    {r.puppyName} — {r.breed}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {r.kennelName}
                    {r.plannedCollectionDate &&
                      ` · ${t("buyerPanel.reservations.collectionPrefix")} ${new Date(r.plannedCollectionDate).toLocaleDateString("en-GB")}`}
                  </div>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {reservationStatusLabel(r.status, t)}
                </Badge>
              </div>
              <div className="mt-3 grid gap-2 text-sm grid-cols-1 md:grid-cols-3">
                <div>
                  <span className="text-muted-foreground">
                    {t("buyerPanel.reservations.depositPrefix")}{" "}
                  </span>
                  {r.depositStatus === "paid" && r.depositPaidAt
                    ? `${t("buyerPanel.reservations.paidPrefix")} ${new Date(r.depositPaidAt).toLocaleDateString("en-GB")}`
                    : depositStatusLabel(r.depositStatus, t)}
                </div>
                <div>
                  <span className="text-muted-foreground">
                    {t("buyerPanel.reservations.agreementPrefix")}{" "}
                  </span>
                  {agreementStatusLabel(r.agreementStatus, t)}
                </div>
                {r.agreedPrice != null && (
                  <div>
                    <span className="text-muted-foreground">
                      {t("buyerPanel.reservations.agreedPricePrefix")}{" "}
                    </span>
                    {r.agreedPrice} {r.currency}
                  </div>
                )}
              </div>
              {r.depositStatus === "pending" && r.depositAmount != null && (
                <div className="mt-4 space-y-2">
                  <PayDepositButton
                    reservationId={r.id}
                    depositAmount={r.depositAmount}
                    currency={r.currency}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("payments.nonRefundableNotice")}
                  </p>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={messageMutation.isPending}
                  onClick={() => messageMutation.mutate(r.animalId)}
                >
                  <MessageCircle className="mr-1 size-4" />
                  {t("buyerPanel.reservations.messageBreeder")}
                </Button>
                {CANCELLABLE_STATUSES.includes(r.status) && (
                  <CancelReservationDialog
                    reservationId={r.id}
                    depositStatus={r.depositStatus}
                    invalidateQueryKey={["my-reservations", userId]}
                  />
                )}
              </div>
              {r.status === "confirmed" &&
                (() => {
                  const existing = transportByAnimalQuery.data?.get(r.animalId);
                  if (!existing) {
                    return (
                      <div className="mt-4 flex gap-2">
                        <Button size="sm" asChild>
                          <Link to="/transport/request" search={{ animalId: r.animalId }}>
                            {t("buyerPanel.reservations.requestTransport")}
                          </Link>
                        </Button>
                      </div>
                    );
                  }
                  const milestoneIndex = milestoneIndexForStatus(existing.status);
                  const stepLabel =
                    milestoneIndex !== null ? transportMilestones[milestoneIndex] : existing.status;
                  return (
                    <div className="mt-4 rounded-xl border border-border/70 bg-secondary/40 p-3 text-sm">
                      <div className="font-medium">
                        {t("buyerPanel.reservations.transportAlreadyRequested")}{" "}
                        {existing.request_number ? `(${existing.request_number})` : ""}
                      </div>
                      <div className="mt-0.5 text-muted-foreground">
                        {stepLabel} — {nextActionForStatus(existing.status)}
                      </div>
                      <Button size="sm" variant="outline" className="mt-2" asChild>
                        <Link to="/dashboard/buyer/transport">
                          {t("buyerPanel.reservations.viewTransportStatus")}
                        </Link>
                      </Button>
                    </div>
                  );
                })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
