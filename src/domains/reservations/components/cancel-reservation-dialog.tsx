import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePostHog } from "posthog-js/react";
import { toast } from "sonner";
import { XCircle } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
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
import { cancelReservation } from "../services/reservations";
import { useTranslation } from "@/shared/i18n";

// Shared by both the buyer and breeder reservation lists — cancel_reservation() (see
// supabase/migrations/20260912120000_reservation_cancellation.sql) authorizes either party (or
// an admin) itself, so this one component works unmodified from both sides. The non-refundable
// warning only renders when a deposit has actually been paid — never shown as a blanket scare
// line on a reservation with nothing at stake yet.
export function CancelReservationDialog({
  reservationId,
  depositStatus,
  invalidateQueryKey,
}: {
  reservationId: string;
  depositStatus: string;
  /** react-query key to refetch on success — different on the buyer vs breeder list. */
  invalidateQueryKey: readonly unknown[];
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();
  const posthog = usePostHog();

  const mutation = useMutation({
    mutationFn: () => cancelReservation(reservationId, reason),
    onSuccess: () => {
      posthog.capture("reservation_cancelled", { hadPaidDeposit: depositStatus === "paid" });
      toast.success(t("reservationCancel.cancelledToast"));
      setOpen(false);
      setReason("");
      queryClient.invalidateQueries({ queryKey: invalidateQueryKey });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : t("reservationCancel.cancelFailed")),
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-destructive">
          <XCircle className="mr-1 size-4" /> {t("reservationCancel.cancelButton")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("reservationCancel.dialogTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("reservationCancel.dialogBody")}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          {depositStatus === "paid" && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {t("reservationCancel.nonRefundableWarning")}
            </p>
          )}
          <div>
            <Label>{t("reservationCancel.reasonLabel")}</Label>
            <Textarea
              rows={2}
              placeholder={t("reservationCancel.reasonPlaceholder")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("reservationCancel.backButton")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={mutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            {mutation.isPending
              ? t("reservationCancel.cancellingButton")
              : t("reservationCancel.confirmButton")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
