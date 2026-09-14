import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/shared/ui/badge";
import { OpsRequestTable, listRoutes, listOpsTrips } from "@/domains/transport";

// Routes (ops's own plans) and trips (a company's own runs) each carry a status entirely separate
// from transport_requests.status, which is all OpsRequestTable below ever reads — marking a route
// or trip "in_progress" previously had zero effect on this page, with no visible reason why.
// Rather than cascading that status onto every assigned request (a bigger, riskier change to a
// deliberately human-gated, compliance-audited state machine), this surfaces in-progress
// routes/trips as their own cards here — the same "browsable, not auto-derived" posture
// trips.tsx already uses for ops oversight of company trips.
const routeStatusStyle: Record<string, "secondary" | "destructive" | "outline"> = {
  in_progress: "secondary",
};

export const Route = createFileRoute("/dashboard/operations/active")({
  component: ActivePage,
});

function ActivePage() {
  const routesQuery = useQuery({ queryKey: ["routes"], queryFn: listRoutes });
  const tripsQuery = useQuery({ queryKey: ["ops-trips"], queryFn: listOpsTrips });

  const activeRoutes = (routesQuery.data ?? []).filter((r) => r.status === "in_progress");
  const activeTrips = (tripsQuery.data ?? []).filter((t) => t.status === "in_progress");

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-medium">Active transports</h1>
        <p className="text-sm text-muted-foreground">Scheduled through in-transit.</p>
      </header>

      {activeRoutes.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-display text-base font-semibold">
            Active routes ({activeRoutes.length})
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {activeRoutes.map((r) => (
              <Link
                key={r.id}
                to="/dashboard/operations/routes/$id"
                params={{ id: r.id }}
                className="rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-display text-base font-semibold">{r.route_name}</div>
                  <Badge variant={routeStatusStyle[r.status] ?? "secondary"} className="capitalize">
                    {r.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.origin_country ?? "?"} → {r.destination_countries.join(", ") || "?"}
                  {r.departure_date &&
                    ` · Departs ${new Date(r.departure_date).toLocaleDateString("en-GB")}`}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {activeTrips.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-display text-base font-semibold">
            Active company trips ({activeTrips.length})
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {activeTrips.map((t) => (
              <Link
                key={t.id}
                to="/dashboard/operations/trips/$id"
                params={{ id: t.id }}
                className="rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-display text-base font-semibold">{t.name}</div>
                  <Badge variant="secondary" className="capitalize">
                    {t.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.organisations?.name ?? "Unknown company"}
                  {t.departure_date &&
                    ` · Departs ${new Date(t.departure_date).toLocaleDateString("en-GB")}`}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <OpsRequestTable
        fixedStatuses={[
          "scheduled",
          "driver_assigned",
          "pickup_confirmed",
          "animal_collected",
          "in_transport",
          "rest_or_care_stop",
          "approaching_destination",
        ]}
      />
    </div>
  );
}
