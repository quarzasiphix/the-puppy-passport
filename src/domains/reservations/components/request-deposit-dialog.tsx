import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePostHog } from "posthog-js/react";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { requestReservationDeposit } from "../services/reservations";
import { useTranslation } from "@/shared/i18n";

// Breeder-side action: sets the deposit amount and moves deposit_status to 'pending', which makes
// the buyer's "Pay deposit" button appear. All real authorization/state-machine rules live
// server-side in request_reservation_deposit() — this dialog is just the entry point to it.
export function RequestDepositDialog({ reservationId }: { reservationId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"PLN" | "EUR">("PLN");
  const queryClient = useQueryClient();
  const posthog = usePostHog();

  const mutation = useMutation({
    mutationFn: () => requestReservationDeposit(reservationId, Number.parseFloat(amount), currency),
    onSuccess: () => {
      posthog.capture("deposit_requested", {
        amount: Number.parseFloat(amount),
        currency,
      });
      toast.success(t("payments.requestedToast"));
      setOpen(false);
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["kennel-reservations"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t("payments.requestFailed")),
  });

  const parsedAmount = Number.parseFloat(amount);
  const isValid = amount.trim() !== "" && Number.isFinite(parsedAmount) && parsedAmount > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Wallet className="mr-1 size-4" /> {t("payments.requestDepositButton")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("payments.requestDepositDialogTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("payments.requestDepositExplain")}</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label>{t("payments.fieldAmount")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="500"
              />
            </div>
            <div>
              <Label>{t("payments.fieldCurrency")}</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as "PLN" | "EUR")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLN">PLN</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="w-full"
            disabled={!isValid || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {t("payments.requestDepositButton")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
