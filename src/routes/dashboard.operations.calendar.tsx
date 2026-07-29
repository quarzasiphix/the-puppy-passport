import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { AlertTriangle, ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listVehicles, listDrivers } from "@/lib/queries/fleet";
import {
  getSchedulingConflicts,
  listRoutesForDateRange,
  listUnscheduledRequests,
  type CalendarRouteRow,
} from "@/lib/queries/calendar";

export const Route = createFileRoute("/dashboard/operations/calendar")({
  component: OperationsCalendar,
});

// Route-status meaning, spelled out in plain terms rather than the raw enum value — matches the
// project-wide rule of never showing an internal status code unexplained.
const routeStatusMeaning: Record<string, { label: string; className: string }> = {
  planning: { label: "Proposed", className: "bg-muted text-muted-foreground" },
  confirmed: { label: "Confirmed", className: "bg-success/15 text-success" },
  in_progress: { label: "In transit", className: "bg-accent/15 text-accent" },
  completed: { label: "Completed", className: "bg-secondary text-secondary-foreground" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
};

const dayISO = (d: Date) => format(d, "yyyy-MM-dd");

function OperationsCalendar() {
  const [viewMode, setViewMode] = useState<"day" | "week">("week");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [driverFilter, setDriverFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const rangeStart =
    viewMode === "week" ? startOfWeek(anchorDate, { weekStartsOn: 1 }) : anchorDate;
  const rangeEnd = viewMode === "week" ? endOfWeek(anchorDate, { weekStartsOn: 1 }) : anchorDate;
  const rangeDays = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  const routesQuery = useQuery({
    queryKey: ["ops-calendar-routes", dayISO(rangeStart), dayISO(rangeEnd)],
    queryFn: () => listRoutesForDateRange(dayISO(rangeStart), dayISO(rangeEnd)),
  });
  const unscheduledQuery = useQuery({
    queryKey: ["ops-calendar-unscheduled"],
    queryFn: listUnscheduledRequests,
  });
  const conflictsQuery = useQuery({
    queryKey: ["ops-calendar-conflicts"],
    queryFn: getSchedulingConflicts,
  });
  const driversQuery = useQuery({ queryKey: ["drivers"], queryFn: listDrivers });
  const vehiclesQuery = useQuery({ queryKey: ["vehicles"], queryFn: listVehicles });

  const filteredRoutes = useMemo(() => {
    return (routesQuery.data ?? []).filter((r) => {
      if (driverFilter !== "all" && r.driver_id !== driverFilter) return false;
      if (vehicleFilter !== "all" && r.vehicle_id !== vehicleFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [routesQuery.data, driverFilter, vehicleFilter, statusFilter]);

  const routesByDay = useMemo(() => {
    const map = new Map<string, CalendarRouteRow[]>();
    for (const r of filteredRoutes) {
      if (!r.departure_date) continue;
      map.set(r.departure_date, [...(map.get(r.departure_date) ?? []), r]);
    }
    return map;
  }, [filteredRoutes]);

  const step = (direction: 1 | -1) => {
    setAnchorDate((d) =>
      viewMode === "week"
        ? direction === 1
          ? addWeeks(d, 1)
          : subWeeks(d, 1)
        : addDays(d, direction),
    );
  };

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Pickups, routes, and driver/vehicle availability from the real schedule — no estimates
            presented as confirmed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "day" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("day")}
          >
            Day
          </Button>
          <Button
            variant={viewMode === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("week")}
          >
            Week
          </Button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label={viewMode === "week" ? "Previous week" : "Previous day"}
          onClick={() => step(-1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium">
          {viewMode === "week"
            ? `${format(rangeStart, "d MMM")} – ${format(rangeEnd, "d MMM yyyy")}`
            : format(anchorDate, "EEEE d MMMM yyyy")}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label={viewMode === "week" ? "Next week" : "Next day"}
          onClick={() => step(1)}
        >
          <ChevronRight className="size-4" />
        </Button>

        <div className="ml-auto flex flex-wrap gap-2">
          <Select value={driverFilter} onValueChange={setDriverFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Driver" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All drivers</SelectItem>
              {(driversQuery.data ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Vehicle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vehicles</SelectItem>
              {(vehiclesQuery.data ?? []).map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(routeStatusMeaning).map(([value, meta]) => (
                <SelectItem key={value} value={value}>
                  {meta.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!!conflictsQuery.data?.length && (
        <section className="mb-6 rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <div className="mb-2 flex items-center gap-2 font-display text-sm font-semibold">
            <AlertTriangle className="size-4 text-warning" />
            Scheduling conflicts ({conflictsQuery.data.length})
          </div>
          <ul className="space-y-1.5 text-xs">
            {conflictsQuery.data.map((c) => (
              <li key={c.id} className="flex items-start gap-2">
                <Badge
                  variant={c.severity === "error" ? "destructive" : "secondary"}
                  className="mt-0.5 shrink-0"
                >
                  {c.severity === "error" ? "Conflict" : "Warning"}
                </Badge>
                <span className="flex-1">{c.message}</span>
                {c.routeId && (
                  <Link
                    to="/dashboard/operations/routes/$id"
                    params={{ id: c.routeId }}
                    className="shrink-0 text-primary hover:underline"
                  >
                    View route
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {routesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            rangeDays.map((day) => {
              const iso = dayISO(day);
              const dayRoutes = routesByDay.get(iso) ?? [];
              return (
                <section key={iso} className="rounded-2xl border border-border/70 bg-card p-4">
                  <h3 className="mb-2 font-display text-sm font-semibold">
                    {format(day, "EEEE d MMMM")}
                  </h3>
                  {dayRoutes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No routes departing.</p>
                  ) : (
                    <div className="space-y-2">
                      {dayRoutes.map((r) => {
                        const meta = routeStatusMeaning[r.status] ?? {
                          label: r.status,
                          className: "bg-muted text-muted-foreground",
                        };
                        return (
                          <Link
                            key={r.id}
                            to="/dashboard/operations/routes/$id"
                            params={{ id: r.id }}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 p-3 text-sm transition-colors hover:bg-secondary/40"
                          >
                            <div>
                              <div className="font-medium">{r.route_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {r.origin_country ?? "?"} →{" "}
                                {r.destination_countries.join(", ") || "?"}
                                {" · "}
                                {r.driver_name ?? "No driver assigned"}
                                {" · "}
                                {r.vehicle_name ?? "No vehicle assigned"}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {r.assignment_count}/{r.max_capacity}
                              </span>
                              <Badge className={meta.className}>{meta.label}</Badge>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="mb-2 flex items-center gap-2 font-display text-sm font-semibold">
              <ListChecks className="size-4" />
              Unscheduled ({unscheduledQuery.data?.length ?? 0})
            </div>
            {!unscheduledQuery.data?.length ? (
              <p className="text-xs text-muted-foreground">Nothing waiting for a route.</p>
            ) : (
              <ul className="space-y-2">
                {unscheduledQuery.data.map((r) => (
                  <li key={r.id}>
                    <Link
                      to="/dashboard/operations/requests/$id"
                      params={{ id: r.id }}
                      className="block rounded-lg border border-border/60 p-2 text-xs hover:bg-secondary/40"
                    >
                      <div className="font-medium">{r.animal_name ?? r.request_number}</div>
                      <div className="text-muted-foreground">
                        {r.pickup_city ?? r.pickup_country ?? "?"} →{" "}
                        {r.destination_city ?? r.destination_country ?? "?"}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
