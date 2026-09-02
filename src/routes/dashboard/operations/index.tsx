import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Inbox,
  ClipboardCheck,
  AlertCircle,
  FileSearch,
  Receipt,
  Send,
  CalendarCheck2,
  Truck,
  ShieldAlert,
} from "lucide-react";
import { getOpsKpiCounts } from "@/domains/operations";

export const Route = createFileRoute("/dashboard/operations/")({
  component: OperationsOverview,
});

function OperationsOverview() {
  const query = useQuery({ queryKey: ["ops-kpi-counts"], queryFn: getOpsKpiCounts });
  const d = query.data;

  const cards = [
    {
      to: "/dashboard/operations/new-requests",
      label: "New requests",
      value: d?.newRequests,
      icon: Inbox,
    },
    {
      to: "/dashboard/operations/review-queue",
      label: "Awaiting review",
      value: d?.awaitingReview,
      icon: ClipboardCheck,
    },
    {
      to: "/dashboard/operations/review-queue",
      label: "Missing information",
      value: d?.missingInformation,
      icon: AlertCircle,
    },
    {
      to: "/dashboard/operations/review-queue",
      label: "Documents under review",
      value: d?.documentsUnderReview,
      icon: FileSearch,
    },
    {
      to: "/dashboard/operations/quotations",
      label: "Quotations to prepare",
      value: d?.quotationsToPrepare,
      icon: Receipt,
    },
    {
      to: "/dashboard/operations/quotations",
      label: "Awaiting customer response",
      value: d?.quotationsAwaitingResponse,
      icon: Send,
    },
    {
      to: "/dashboard/operations/review-queue",
      label: "Ready for scheduling",
      value: d?.readyForScheduling,
      icon: CalendarCheck2,
    },
    { to: "/dashboard/operations/active", label: "Scheduled", value: d?.scheduled, icon: Truck },
    {
      to: "/dashboard/operations/active",
      label: "Active transports",
      value: d?.active,
      icon: Truck,
    },
    {
      to: "/dashboard/operations/compliance-holds",
      label: "Compliance holds",
      value: d?.complianceHolds,
      icon: ShieldAlert,
    },
  ];

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-medium">Operations overview</h1>
        <p className="text-sm text-muted-foreground">
          Real-time counts from submitted transport requests.
        </p>
      </header>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="rounded-xl border border-border/70 bg-card p-4 transition-colors hover:bg-secondary/40"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <c.icon className="size-4" />
              <span className="text-xs uppercase tracking-wide">{c.label}</span>
            </div>
            <div className="mt-2 font-display text-2xl font-semibold">{c.value ?? "—"}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
