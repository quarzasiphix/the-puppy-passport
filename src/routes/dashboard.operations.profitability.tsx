import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { listRouteProfitability } from "@/lib/queries/routes";

export const Route = createFileRoute("/dashboard/operations/profitability")({
  component: ProfitabilityPage,
});

function money(n: number, currency = "EUR") {
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`;
}

function ProfitabilityPage() {
  const query = useQuery({ queryKey: ["route-profitability"], queryFn: listRouteProfitability });
  const rows = query.data ?? [];

  const totals = rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + (r.actualRevenue > 0 ? r.actualRevenue : r.estimatedRevenue),
      cost: acc.cost + r.estimatedCost,
    }),
    { revenue: 0, cost: 0 },
  );

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-medium">Profitability</h1>
        <p className="text-sm text-muted-foreground">
          Internal only — not shown to customers or drivers. Revenue is real accepted-quotation
          totals where available, falling back to the route's planning estimate otherwise.
        </p>
      </header>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <div className="text-xs text-muted-foreground">Total revenue (all routes)</div>
          <div className="mt-1 font-display text-2xl font-semibold">{money(totals.revenue)}</div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <div className="text-xs text-muted-foreground">Total estimated cost</div>
          <div className="mt-1 font-display text-2xl font-semibold">{money(totals.cost)}</div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <div className="text-xs text-muted-foreground">Estimated margin</div>
          <div
            className={`mt-1 font-display text-2xl font-semibold ${totals.revenue - totals.cost >= 0 ? "text-success" : "text-destructive"}`}
          >
            {money(totals.revenue - totals.cost)}
          </div>
        </div>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No routes yet.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Route</th>
                <th className="p-3">Jobs</th>
                <th className="p-3">Revenue</th>
                <th className="p-3">Est. cost</th>
                <th className="p-3">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((r) => {
                const revenue = r.actualRevenue > 0 ? r.actualRevenue : r.estimatedRevenue;
                return (
                  <tr key={r.route.id}>
                    <td className="p-3">
                      <div className="font-medium">{r.route.route_name}</div>
                      <div className="text-xs text-muted-foreground">{r.route.route_number}</div>
                    </td>
                    <td className="p-3">{r.jobCount}</td>
                    <td className="p-3">
                      {money(revenue)}
                      {r.actualRevenue === 0 && r.estimatedRevenue > 0 && (
                        <Badge variant="outline" className="ml-1.5 text-[10px]">
                          estimated
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">{money(r.estimatedCost)}</td>
                    <td className="p-3">
                      {r.margin === null ? (
                        <span className="text-muted-foreground">No cost estimate</span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${r.margin >= 0 ? "text-success" : "text-destructive"}`}
                        >
                          {r.margin >= 0 ? (
                            <TrendingUp className="size-3.5" />
                          ) : (
                            <TrendingDown className="size-3.5" />
                          )}
                          {money(r.margin)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
