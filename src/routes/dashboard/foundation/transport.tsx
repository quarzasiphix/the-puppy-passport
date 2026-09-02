import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/shared/ui/badge";
import { useAuth } from "@/domains/identity";
import { getMyFoundation } from "@/domains/breeders";
import {
  listTransportRequestsForKennel,
  transportMilestones,
  milestoneIndexForStatus,
  isOnHold,
  isClosed,
} from "@/domains/transport";
import { Card } from "@/shared/ui/panel";

export const Route = createFileRoute("/dashboard/foundation/transport")({
  component: FoundationTransportPage,
});

function FoundationTransportPage() {
  const { userId } = useAuth();
  const { data: org } = useQuery({
    queryKey: ["my-foundation", userId],
    enabled: !!userId,
    queryFn: () => getMyFoundation(userId!),
  });
  const { data: requests, isLoading } = useQuery({
    queryKey: ["foundation-transport-requests", org?.id],
    enabled: !!org?.id,
    queryFn: () => listTransportRequestsForKennel(org!.id),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Transport requests</h1>
        <p className="text-sm text-muted-foreground">
          Track transport requests connected to your animals, from submission through to handover.
        </p>
      </header>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !requests?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No linked transport requests yet — they'll show up here once someone requests transport
            for one of your animals after a confirmed adoption.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((t) => (
            <Card
              key={t.id}
              title={`${t.animal_name ?? t.animals?.name ?? "Animal"} — ${t.pickup_city ?? "?"} → ${t.destination_city ?? "?"}`}
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
