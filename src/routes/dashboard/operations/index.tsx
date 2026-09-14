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
  Users,
  Sparkles,
  Calendar as CalendarIcon,
  Route as RouteIcon,
  Car,
  UserRound,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { useAuth } from "@/domains/identity";
import { getOpsKpiCounts } from "@/domains/operations";
import { listUnassignedReadyJobs, listDriverWorkloads } from "@/domains/transport";

export const Route = createFileRoute("/dashboard/operations/")({
  component: OperationsOverview,
});

// Redesigned 2026-09-14 around the dispatcher's own workflow (the product owner runs this as
// their day-to-day operating tool, not just a review-queue tally): "what needs a driver right
// now" and "who's available" lead the page, ahead of the pipeline/compliance counters — those stay
// fully present, just no longer the first thing in view.
function OperationsOverview() {
  const { firstName } = useAuth();
  const kpiQuery = useQuery({ queryKey: ["ops-kpi-counts"], queryFn: getOpsKpiCounts });
  const unassignedQuery = useQuery({
    queryKey: ["unassigned-ready-jobs"],
    queryFn: listUnassignedReadyJobs,
  });
  const workloadQuery = useQuery({ queryKey: ["driver-workloads"], queryFn: listDriverWorkloads });

  const d = kpiQuery.data;
  const needsDispatch = unassignedQuery.data ?? [];
  const availableDrivers = (workloadQuery.data ?? []).slice(0, 5);

  const primaryCards = [
    {
      to: "/dashboard/operations/active",
      label: "Active transports",
      value: d?.active,
      icon: Truck,
    },
    {
      to: "/dashboard/operations/dispatch",
      label: "Needs a driver",
      value: unassignedQuery.data?.length,
      icon: Send,
    },
    {
      to: "/dashboard/operations/active",
      label: "Scheduled",
      value: d?.scheduled,
      icon: CalendarCheck2,
    },
    {
      to: "/dashboard/operations/compliance-holds",
      label: "Compliance holds",
      value: d?.complianceHolds,
      icon: ShieldAlert,
    },
  ];

  const pipelineCards = [
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
  ];

  const quickLinks = [
    { to: "/dashboard/operations/dispatch", label: "Dispatch", icon: Users },
    { to: "/dashboard/operations/matching", label: "Matching", icon: Sparkles },
    { to: "/dashboard/operations/routes", label: "Routes", icon: RouteIcon },
    { to: "/dashboard/operations/calendar", label: "Calendar", icon: CalendarIcon },
    { to: "/dashboard/operations/drivers", label: "Drivers", icon: UserRound },
    { to: "/dashboard/operations/vehicles", label: "Vehicles", icon: Car },
  ];

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-medium">
          {firstName ? `Welcome back, ${firstName}` : "Operations overview"}
        </h1>
        <p className="text-sm text-muted-foreground">What needs your attention right now.</p>
      </header>

      {!!d?.complianceHolds && (
        <Link
          to="/dashboard/operations/compliance-holds"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 transition-colors hover:bg-destructive/10"
        >
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold">
              {d.complianceHolds} {d.complianceHolds === 1 ? "transport is" : "transports are"} on a
              compliance hold
            </p>
            <p className="text-sm text-muted-foreground">
              These are blocked from moving until reviewed — open compliance holds.
            </p>
          </div>
        </Link>
      )}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {primaryCards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:bg-secondary/40"
          >
            <div className="flex items-center gap-2 text-primary">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/10">
                <c.icon className="size-5" />
              </span>
              <span className="text-sm font-semibold">{c.label}</span>
            </div>
            <div className="mt-3 font-display text-2xl font-semibold">{c.value ?? "—"}</div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-3 grid-cols-2 lg:grid-cols-6">
        {quickLinks.map((q) => (
          <Link
            key={q.label}
            to={q.to}
            className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card p-3 transition-colors hover:bg-secondary/40"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <q.icon className="size-4" />
            </span>
            <span className="text-sm font-medium">{q.label}</span>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-8 grid-cols-1 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">
              Needs a driver ({needsDispatch.length})
            </h2>
            <Link
              to="/dashboard/operations/dispatch"
              className="text-sm font-medium text-primary hover:underline"
            >
              Open dispatch
            </Link>
          </div>
          {unassignedQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : needsDispatch.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nothing waiting on a driver right now.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {needsDispatch.slice(0, 5).map((job) => (
                <Link
                  key={job.id}
                  to="/dashboard/operations/dispatch"
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4 transition-colors hover:bg-secondary/40"
                >
                  <div className="min-w-0">
                    <div className="font-medium">
                      {job.animal_name ?? "Animal"}{" "}
                      <span className="text-xs text-muted-foreground">{job.request_number}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {job.pickup_city ?? "?"} → {job.destination_city ?? "?"}
                      {job.earliest_date &&
                        ` · ${new Date(job.earliest_date).toLocaleDateString("en-GB")}`}
                    </div>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Driver availability</h2>
            <Link
              to="/dashboard/operations/dispatch"
              className="text-sm font-medium text-primary hover:underline"
            >
              Open dispatch
            </Link>
          </div>
          {workloadQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : availableDrivers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
              <p className="text-sm text-muted-foreground">No drivers on file.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableDrivers.map((driver) => (
                <div
                  key={driver.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{driver.name}</div>
                    {driver.availability_status && (
                      <div className="text-xs capitalize text-muted-foreground">
                        {driver.availability_status.replace(/_/g, " ")}
                      </div>
                    )}
                  </div>
                  <Badge
                    className={
                      driver.activeJobCount === 0
                        ? "bg-success/15 text-success"
                        : driver.activeJobCount <= 2
                          ? "bg-accent/15 text-accent"
                          : "bg-warning/20 text-foreground"
                    }
                  >
                    {driver.activeJobCount} active
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold">Review pipeline</h2>
        <div className="grid gap-3 grid-cols-1 md:grid-cols-3 lg:grid-cols-4">
          {pipelineCards.map((c) => (
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
      </section>
    </div>
  );
}
