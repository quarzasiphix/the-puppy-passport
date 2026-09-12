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
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/foundation/transport")({
  component: FoundationTransportPage,
});

function FoundationTransportPage() {
  const { t } = useTranslation();
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
        <h1 className="font-display text-3xl font-medium">
          {t("foundationPanel.transportPage.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("foundationPanel.transportPage.subtitle")}
        </p>
      </header>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          {t("foundationPanel.transportPage.loading")}
        </p>
      ) : !requests?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t("foundationPanel.transportPage.emptyBody")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <Card
              key={r.id}
              title={`${r.animal_name ?? r.animals?.name ?? t("foundationPanel.transportPage.animalFallback")} — ${r.pickup_city ?? "?"} → ${r.destination_city ?? "?"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="secondary">{r.requested_service_type}</Badge>
                  <span className="text-muted-foreground">
                    {t("foundationPanel.transportPage.requestedPrefix")}{" "}
                    {new Date(r.created_at).toLocaleDateString("en-GB")}
                  </span>
                  {r.earliest_date && (
                    <span className="text-muted-foreground">
                      {t("foundationPanel.transportPage.earliestPrefix")}{" "}
                      {new Date(r.earliest_date).toLocaleDateString("en-GB")}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium">{r.request_number}</div>
                  <div className="text-xs text-muted-foreground">
                    {isClosed(r.status)
                      ? t("foundationPanel.transportPage.closed")
                      : isOnHold(r.status)
                        ? t("foundationPanel.transportPage.onHold")
                        : (transportMilestones[milestoneIndexForStatus(r.status) ?? 0] ?? r.status)}
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
