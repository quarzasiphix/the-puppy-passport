import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "./dashboard.breeder.index";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { getMyKennel } from "@/lib/queries/breeder";
import {
  listTransportRequestsForKennel,
  transportMilestones,
  milestoneIndexForStatus,
  isOnHold,
  isClosed,
} from "@/lib/queries/transport";

export const Route = createFileRoute("/dashboard/breeder/transport")({
  component: BreederTransportPage,
});

function BreederTransportPage() {
  const { userId } = useAuth();
  const { data: orgId } = useQuery({
    queryKey: ["my-kennel-id", userId],
    enabled: !!userId,
    queryFn: async () => {
      const kennel = await getMyKennel(userId!);
      return kennel?.id ?? null;
    },
  });
  const { data: requests, isLoading } = useQuery({
    queryKey: ["kennel-transport-requests", orgId],
    enabled: !!orgId,
    queryFn: () => listTransportRequestsForKennel(orgId!),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Transport</h1>
        <p className="text-sm text-muted-foreground">
          Transport requests linked to puppies from your kennel.
        </p>
      </header>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !requests?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No linked transport requests yet — they'll show up here once a buyer or you request
            transport for a puppy from a confirmed reservation.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((t) => (
            <Card
              key={t.id}
              title={`${t.animal_name ?? t.animals?.name ?? "Puppy"} — ${t.pickup_city ?? "?"} → ${t.destination_city ?? "?"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="secondary">{t.requested_service_type}</Badge>
                  <span className="text-muted-foreground">
                    Requested {new Date(t.created_at).toLocaleDateString("en-GB")}
                  </span>
                  {t.earliest_date && (
                    <span className="text-muted-foreground">
                      Earliest {new Date(t.earliest_date).toLocaleDateString("en-GB")}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium">{t.request_number}</div>
                  <div className="text-xs text-muted-foreground">
                    {isClosed(t.status)
                      ? "Closed"
                      : isOnHold(t.status)
                        ? "On hold — action needed"
                        : (transportMilestones[milestoneIndexForStatus(t.status) ?? 0] ?? t.status)}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
