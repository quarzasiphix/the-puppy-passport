import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/shared/ui/panel";
import { Badge } from "@/shared/ui/badge";
import { useAuth } from "@/domains/identity";
import { getMyKennel } from "@/domains/breeders";
import {
  listTransportRequestsForKennel,
  transportMilestones,
  milestoneIndexForStatus,
  isOnHold,
  isClosed,
} from "@/domains/transport";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/breeder/transport")({
  component: BreederTransportPage,
});

function BreederTransportPage() {
  const { t } = useTranslation();
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
        <h1 className="font-display text-3xl font-medium">{t("breederPanel.transport.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("breederPanel.transport.subtitle")}</p>
      </header>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("breederPanel.transport.loading")}</p>
      ) : !requests?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("breederPanel.transport.emptyBody")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <Card
              key={req.id}
              title={`${req.animal_name ?? req.animals?.name ?? t("breederPanel.transport.puppy")} — ${req.pickup_city ?? "?"} → ${req.destination_city ?? "?"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="secondary">{req.requested_service_type}</Badge>
                  <span className="text-muted-foreground">
                    {t("breederPanel.transport.requestedPrefix")}{" "}
                    {new Date(req.created_at).toLocaleDateString("en-GB")}
                  </span>
                  {req.earliest_date && (
                    <span className="text-muted-foreground">
                      {t("breederPanel.transport.earliestPrefix")}{" "}
                      {new Date(req.earliest_date).toLocaleDateString("en-GB")}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium">{req.request_number}</div>
                  <div className="text-xs text-muted-foreground">
                    {isClosed(req.status)
                      ? t("breederPanel.transport.statusClosed")
                      : isOnHold(req.status)
                        ? t("breederPanel.transport.statusOnHold")
                        : (transportMilestones[milestoneIndexForStatus(req.status) ?? 0] ??
                          req.status)}
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
