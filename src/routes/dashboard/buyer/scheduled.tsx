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

export const Route = createFileRoute("/dashboard/buyer/scheduled")({
  component: ScheduledTransportsPage,
});

function ScheduledTransportsPage() {
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
        <h1 className="font-display text-3xl font-medium">Scheduled transports</h1>
        <p className="text-sm text-muted-foreground">
          Transport requests that have moved past quotation into a confirmed pickup date and route.
        </p>
      </header>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !query.data?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <Truck className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing scheduled yet — once a quotation is accepted and a route is confirmed, it'll
            appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {query.data.map((t) => (
            <ScheduledCard
              key={t.id}
              t={t}
              expanded={openId === t.id}
              onToggle={() => setOpenId(openId === t.id ? null : t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduledCard({
  t,
  expanded,
  onToggle,
}: {
  t: Awaited<ReturnType<typeof listMyScheduledTransportRequests>>[number];
  expanded: boolean;
  onToggle: () => void;
}) {
  const timelineQuery = useQuery({
    queryKey: ["transport-timeline", t.id],
    enabled: expanded,
    queryFn: () => getCustomerTimeline(t.id),
  });

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-lg font-semibold">
            {t.animal_name ?? t.request_number}
          </div>
          <div className="text-sm text-muted-foreground">
            {t.pickup_city ?? t.pickup_country ?? "?"} <ArrowRight className="mx-1 inline size-3" />{" "}
            {t.destination_city ?? t.destination_country ?? "?"}
          </div>
        </div>
        <Badge variant="secondary">{statusEventLabel(t.status)}</Badge>
      </div>
      {(t.earliest_date || t.latest_date) && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t.earliest_date && new Date(t.earliest_date).toLocaleDateString("en-GB")}
          {t.earliest_date && t.latest_date && " – "}
          {t.latest_date && new Date(t.latest_date).toLocaleDateString("en-GB")}
        </p>
      )}
      <button
        onClick={onToggle}
        className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        Timeline{" "}
        <ChevronDown className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="mt-3 border-t border-border/60 pt-3">
          {timelineQuery.data ? (
            <TransportTimeline events={timelineQuery.data} />
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </div>
      )}
    </div>
  );
}
