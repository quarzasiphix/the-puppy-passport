import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronDown, Truck } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { useAuth } from "@/domains/identity";
import { TransportTimeline } from "@/domains/transport";
import {
  getCustomerTimeline,
  listMyScheduledTransportRequests,
  statusEventLabel,
} from "@/domains/transport";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/buyer/scheduled")({
  component: ScheduledTransportsPage,
});

function ScheduledTransportsPage() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const query = useQuery({
    queryKey: ["my-scheduled-transports", userId],
    enabled: !!userId,
    queryFn: () => listMyScheduledTransportRequests(userId!),
  });
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">{t("buyerPanel.scheduled.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("buyerPanel.scheduled.subtitle")}</p>
      </header>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("buyerPanel.scheduled.loading")}</p>
      ) : !query.data?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <Truck className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            {t("buyerPanel.scheduled.emptyBody")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {query.data.map((req) => (
            <ScheduledCard
              key={req.id}
              item={req}
              expanded={openId === req.id}
              onToggle={() => setOpenId(openId === req.id ? null : req.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduledCard({
  item,
  expanded,
  onToggle,
}: {
  item: Awaited<ReturnType<typeof listMyScheduledTransportRequests>>[number];
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const timelineQuery = useQuery({
    queryKey: ["transport-timeline", item.id],
    enabled: expanded,
    queryFn: () => getCustomerTimeline(item.id),
  });

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-lg font-semibold">
            {item.animal_name ?? item.request_number}
          </div>
          <div className="text-sm text-muted-foreground">
            {item.pickup_city ?? item.pickup_country ?? "?"}{" "}
            <ArrowRight className="mx-1 inline size-3" />{" "}
            {item.destination_city ?? item.destination_country ?? "?"}
          </div>
        </div>
        <Badge variant="secondary">{statusEventLabel(item.status)}</Badge>
      </div>
      {(item.earliest_date || item.latest_date) && (
        <p className="mt-2 text-xs text-muted-foreground">
          {item.earliest_date && new Date(item.earliest_date).toLocaleDateString("en-GB")}
          {item.earliest_date && item.latest_date && " – "}
          {item.latest_date && new Date(item.latest_date).toLocaleDateString("en-GB")}
        </p>
      )}
      <button
        onClick={onToggle}
        className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        {t("buyerPanel.scheduled.timeline")}{" "}
        <ChevronDown className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="mt-3 border-t border-border/60 pt-3">
          {timelineQuery.data ? (
            <TransportTimeline events={timelineQuery.data} />
          ) : (
            <p className="text-sm text-muted-foreground">{t("buyerPanel.scheduled.loading")}</p>
          )}
        </div>
      )}
    </div>
  );
}
