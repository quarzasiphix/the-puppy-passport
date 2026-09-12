import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { useAuth } from "@/domains/identity";
import { getMyKennel } from "@/domains/breeders";
import { listMyOrgPayouts, type PayoutRow } from "@/domains/reservations";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/breeder/payouts")({
  component: BreederPayoutsPage,
});

// A breeder could have both PLN and EUR owed at once — never naively sum across currencies into
// one number. Grouped totals, one stat per currency actually in play.
function owedTotalsByCurrency(rows: PayoutRow[]): { currency: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (r.status !== "owed") continue;
    totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.amount);
  }
  return [...totals.entries()].map(([currency, total]) => ({ currency, total }));
}

function BreederPayoutsPage() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const { data: kennel } = useQuery({
    queryKey: ["my-kennel", userId],
    enabled: !!userId,
    queryFn: () => getMyKennel(userId!),
  });
  const { data: payouts, isLoading } = useQuery({
    queryKey: ["my-org-payouts", kennel?.id],
    enabled: !!kennel?.id,
    queryFn: () => listMyOrgPayouts(kennel!.id),
  });

  const owedTotals = owedTotalsByCurrency(payouts ?? []);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">{t("breederPanel.payouts.title")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("breederPanel.payouts.subtitle")}
        </p>
      </header>

      {owedTotals.length > 0 && (
        <div className="mb-6 grid gap-4 grid-cols-1 sm:grid-cols-3">
          {owedTotals.map(({ currency, total }) => (
            <div key={currency} className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Coins className="size-3.5" /> {t("breederPanel.payouts.owedStatTitle")}
              </div>
              <div className="mt-1 font-display text-2xl font-semibold">
                {total.toLocaleString()} {currency}
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("breederPanel.payouts.loading")}</p>
      ) : !payouts?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("breederPanel.payouts.emptyBody")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-4">{t("breederPanel.payouts.colPuppy")}</th>
                <th className="p-4">{t("breederPanel.payouts.colAmount")}</th>
                <th className="p-4">{t("breederPanel.payouts.colStatus")}</th>
                <th className="p-4">{t("breederPanel.payouts.colDueBy")}</th>
                <th className="p-4">{t("breederPanel.payouts.colPaidOn")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {payouts.map((p) => {
                const overdue = p.status === "owed" && new Date(p.dueAt) < new Date();
                return (
                  <tr key={p.id} className="hover:bg-secondary/40">
                    <td className="p-4 font-medium">{p.puppyName}</td>
                    <td className="p-4">
                      {p.amount.toLocaleString()} {p.currency}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={p.status === "paid" ? "default" : "secondary"}
                          className={p.status === "paid" ? "bg-success/15 text-success" : ""}
                        >
                          {p.status === "paid"
                            ? t("breederPanel.payouts.statusPaid")
                            : t("breederPanel.payouts.statusOwed")}
                        </Badge>
                        {overdue && (
                          <Badge className="bg-destructive/10 text-destructive">
                            {t("breederPanel.payouts.overdueBadge")}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className={`p-4 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                      {new Date(p.dueAt).toLocaleDateString("en-GB")}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString("en-GB") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">{t("breederPanel.payouts.explainer")}</p>
    </div>
  );
}
