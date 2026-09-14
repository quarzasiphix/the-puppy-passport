import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/shared/ui/badge";
import { listOpsTrips } from "@/domains/transport";

export const Route = createFileRoute("/dashboard/operations/trips")({
  component: OpsTripsPage,
});

const statusStyles: Record<string, "secondary" | "destructive" | "outline"> = {
  in_progress: "secondary",
  planning: "outline",
  completed: "secondary",
  cancelled: "destructive",
};

function OpsTripsPage() {
  const query = useQuery({ queryKey: ["ops-trips"], queryFn: listOpsTrips });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-medium">Company trips</h1>
        <p className="text-sm text-muted-foreground">
          Every transport company's own multi-stop trips — oversight only; day-to-day dispatch stays
          that company's own job.
        </p>
      </header>

      {query.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {query.data?.map((t) => (
          <Link
            key={t.id}
            to="/dashboard/operations/trips/$id"
            params={{ id: t.id }}
            className="rounded-2xl border border-border/70 bg-card p-5 transition-colors hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-display text-lg font-semibold">{t.name}</div>
                <div className="text-sm text-muted-foreground">
                  {t.organisations?.name ?? "Unknown company"}
                </div>
              </div>
              <Badge variant={statusStyles[t.status] ?? "secondary"} className="capitalize">
                {t.status.replace(/_/g, " ")}
              </Badge>
            </div>
            {t.departure_date && (
              <p className="mt-2 text-xs text-muted-foreground">
                Departs {new Date(t.departure_date).toLocaleDateString("en-GB")}
              </p>
            )}
          </Link>
        ))}
        {query.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No trips created by any company yet.</p>
        )}
      </div>
    </div>
  );
}
