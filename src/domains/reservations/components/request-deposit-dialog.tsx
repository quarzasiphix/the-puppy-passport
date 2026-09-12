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

// Breeder-side action: sets the deposit amount and moves deposit_status to 'pending', which makes
// the buyer's "Pay deposit" button appear. All real authorization/state-machine rules live
// server-side in request_reservation_deposit() — this dialog is just the entry point to it.
export function RequestDepositDialog({ reservationId }: { reservationId: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"PLN" | "EUR">("PLN");
  const queryClient = useQueryClient();
  const posthog = usePostHog();

  const mutation = useMutation({
    mutationFn: () =>
      requestReservationDeposit(reservationId, Number.parseFloat(amount), currency),
    onSuccess: () => {
      posthog.capture("deposit_requested", {
        amount: Number.parseFloat(amount),
        currency,
      });
      toast.success("Deposit requested — the buyer can now pay it.");
      setOpen(false);
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["kennel-reservations"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not request deposit."),
  });

  const parsedAmount = Number.parseFloat(amount);
  const isValid = amount.trim() !== "" && Number.isFinite(parsedAmount) && parsedAmount > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Wallet className="mr-1 size-4" /> Request deposit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a deposit</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            The buyer will be able to pay this online. It's collected by Anemalo — you'll be paid
            out separately.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label>Amount</Label>
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
              <Label>Currency</Label>
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
            Request deposit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
