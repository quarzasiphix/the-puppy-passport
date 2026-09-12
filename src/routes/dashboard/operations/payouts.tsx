import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/ui/alert-dialog";
import { listAllPayouts, markReservationPayoutPaid, type PayoutRow } from "@/domains/reservations";

export const Route = createFileRoute("/dashboard/operations/payouts")({
  component: PayoutsPage,
});

function money(n: number, currency: string) {
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}

// Same "never sum across currencies" reasoning as the breeder-facing page.
function totalsByCurrency(rows: PayoutRow[]): { currency: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.amount);
  return [...totals.entries()].map(([currency, total]) => ({ currency, total }));
}

function PayoutsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["all-payouts"], queryFn: listAllPayouts });
  const rows = query.data ?? [];

  const owed = rows.filter((r) => r.status === "owed");
  const overdue = owed.filter((r) => new Date(r.dueAt) < new Date());
  const now = new Date();
  const paidThisMonth = rows.filter(
    (r) =>
      r.status === "paid" &&
      r.paidAt &&
      new Date(r.paidAt).getMonth() === now.getMonth() &&
      new Date(r.paidAt).getFullYear() === now.getFullYear(),
  );

  const owedTotals = totalsByCurrency(owed);
  const paidThisMonthTotals = totalsByCurrency(paidThisMonth);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-medium">Payouts</h1>
        <p className="text-sm text-muted-foreground">
          Internal only — not shown to breeders. Every paid deposit owed to a breeder, manual bank
          transfer, marked here once sent. 20-day SLA from deposit paid to payout sent.
        </p>
      </header>

      <div className="mb-6 grid gap-4 grid-cols-1 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <div className="text-xs text-muted-foreground">Currently owed (all breeders)</div>
          <div className="mt-1 font-display text-2xl font-semibold">
            {owedTotals.length === 0
              ? money(0, "PLN")
              : owedTotals.map((t) => money(t.total, t.currency)).join(" · ")}
          </div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <div className="text-xs text-muted-foreground">Overdue (past 20-day SLA)</div>
          <div
            className={`mt-1 font-display text-2xl font-semibold ${overdue.length > 0 ? "text-destructive" : ""}`}
          >
            {overdue.length}
          </div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <div className="text-xs text-muted-foreground">Paid out this month</div>
          <div className="mt-1 font-display text-2xl font-semibold">
            {paidThisMonthTotals.length === 0
              ? money(0, "PLN")
              : paidThisMonthTotals.map((t) => money(t.total, t.currency)).join(" · ")}
          </div>
        </div>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payouts yet.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3">Breeder</th>
                  <th className="p-3">Puppy</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Due by</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((r) => {
                  const isOverdue = r.status === "owed" && new Date(r.dueAt) < new Date();
                  return (
                    <tr key={r.id}>
                      <td className="p-3 font-medium">{r.kennelName}</td>
                      <td className="p-3">{r.puppyName}</td>
                      <td className="p-3">{money(r.amount, r.currency)}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant={r.status === "paid" ? "default" : "secondary"}
                            className={r.status === "paid" ? "bg-success/15 text-success" : ""}
                          >
                            {r.status}
                          </Badge>
                          {isOverdue && (
                            <Badge className="bg-destructive/10 text-destructive">overdue</Badge>
                          )}
                        </div>
                      </td>
                      <td
                        className={`p-3 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {new Date(r.dueAt).toLocaleDateString("en-GB")}
                      </td>
                      <td className="p-3 text-right">
                        {r.status === "owed" && (
                          <MarkPaidDialog
                            payout={r}
                            onDone={() =>
                              queryClient.invalidateQueries({ queryKey: ["all-payouts"] })
                            }
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MarkPaidDialog({ payout, onDone }: { payout: PayoutRow; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState("");

  const mutation = useMutation({
    mutationFn: () => markReservationPayoutPaid(payout.id, reference),
    onSuccess: () => {
      toast.success(`Marked ${payout.kennelName}'s payout as paid.`);
      setOpen(false);
      setReference("");
      onDone();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not mark this payout as paid."),
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline">
          Mark as paid
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Mark {money(payout.amount, payout.currency)} to {payout.kennelName} as paid?
          </AlertDialogTitle>
        </AlertDialogHeader>
        <div>
          <Label>Bank transfer reference (optional)</Label>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. transfer ID or date"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            {mutation.isPending ? "Marking…" : "Confirm paid"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
