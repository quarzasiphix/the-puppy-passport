import { Clock } from "lucide-react";

// A small, reusable rendering of a chronological event list — the three real event sources
// (customer-safe, ops-complete, driver-minimum; see getCustomerTimeline()/getOpsTimeline()/
// getDriverTimeline() in src/lib/queries/{transport,operations,driver}.ts) each decide what's safe
// to fetch for their own role; this component only renders whatever it's given, in order.
export type TimelineEntry = {
  id: string;
  timestamp: string;
  label: string;
  detail?: string | null;
};

export function TransportTimeline({ events }: { events: TimelineEntry[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No timeline events yet.</p>;
  }
  return (
    <ol className="space-y-3 border-l border-border/60 pl-4">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary" />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" /> {new Date(e.timestamp).toLocaleString("en-GB")}
          </div>
          <div className="text-sm font-medium capitalize">{e.label}</div>
          {e.detail && <div className="text-xs text-muted-foreground">{e.detail}</div>}
        </li>
      ))}
    </ol>
  );
}
