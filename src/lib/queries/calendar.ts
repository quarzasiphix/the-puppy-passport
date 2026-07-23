import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { checkRouteCompatibility, type RouteRow } from "@/lib/queries/routes";

// Operations calendar: a real view over the existing routes/route_stops/route_assignments/
// vehicles/drivers/transport_requests model — no new scheduling tables. docs/IMPLEMENTATION_PLAN.md
// already lists this as the next real gap ("day/week/route views over already-real route/vehicle/
// driver/matching data"); the underlying data has been real and RLS-correct since
// 20260101001700_routes_and_fleet.sql, only the calendar surface itself was ever missing
// (dashboard.operations.calendar.tsx was an honest NotImplemented placeholder).

export type CalendarRouteRow = RouteRow & {
  vehicle_name: string | null;
  driver_name: string | null;
  assignment_count: number;
};

// "ready_for_scheduling" is the one status whose entire meaning is "eligible for a route, not yet
// given one" — reusing that existing enum value rather than inventing a new definition of "ready."
export async function listUnscheduledRequests() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_requests")
    .select(
      "id, request_number, animal_name, pickup_country, pickup_city, destination_country, destination_city, earliest_date, latest_date, status",
    )
    .eq("status", "ready_for_scheduling")
    .is("assigned_route_id", null)
    .order("earliest_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

// Routes whose departure_date falls in [startDate, endDate] (both 'YYYY-MM-DD', inclusive) — the
// same range powers both the day view (start === end) and the week view (a 7-day range) in the UI;
// there's no need for two separate queries; "route view" (single-route drill-down) is already a
// real, separate page (dashboard.operations.routes.$id.tsx) linked to from here, not duplicated.
export async function listRoutesForDateRange(startDate: string, endDate: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("routes")
    .select("*, vehicles(name), drivers(name), route_assignments(id, reservation_status)")
    .gte("departure_date", startDate)
    .lte("departure_date", endDate)
    .order("departure_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const { vehicles, drivers, route_assignments, ...route } = r as unknown as RouteRow & {
      vehicles: { name: string } | null;
      drivers: { name: string } | null;
      route_assignments: { id: string; reservation_status: string }[];
    };
    const activeAssignments = route_assignments.filter(
      (a) => !["released", "cancelled", "expired"].includes(a.reservation_status),
    );
    return {
      ...route,
      vehicle_name: vehicles?.name ?? null,
      driver_name: drivers?.name ?? null,
      assignment_count: activeAssignments.length,
    } as CalendarRouteRow;
  });
}

export type SchedulingConflict = {
  id: string;
  severity: "error" | "warning";
  message: string;
  routeId?: string;
  requestId?: string;
};

type ConflictRouteAssignment = {
  id: string;
  route_id: string;
  transport_request_id: string;
  reservation_status: string;
};
type ConflictRequest = {
  id: string;
  request_number: string | null;
  status: string;
  assigned_route_id: string | null;
  earliest_date: string | null;
  latest_date: string | null;
  destination_country: string | null;
};

const ACTIVE_ROUTE_STATUSES = ["planning", "confirmed", "in_progress"];
const NOT_YET_SCHEDULABLE_STATUSES = [
  "draft",
  "submitted",
  "initial_review",
  "missing_information",
  "documents_under_review",
  "quotation_prepared",
  "quotation_sent",
];
const CLOSED_REQUEST_STATUSES = ["rejected", "cancelled_by_customer", "cancelled_by_operations"];
const ACTIVE_RESERVATION_STATUSES = [
  "temporarily_held",
  "waiting_for_customer_action",
  "confirmed",
];

// Deterministic, explainable checks over real data only — no route optimisation, no AI, no
// fabricated capacity model. Every check below is answerable from columns that already exist.
export async function getSchedulingConflicts(): Promise<SchedulingConflict[]> {
  const supabase = getSupabaseBrowserClient();
  const [routesResult, assignmentsResult, requestsResult] = await Promise.all([
    supabase
      .from("routes")
      .select(
        "id, route_number, route_name, departure_date, vehicle_id, driver_id, status, max_capacity",
      ),
    supabase
      .from("route_assignments")
      .select("id, route_id, transport_request_id, reservation_status"),
    supabase
      .from("transport_requests")
      .select(
        "id, request_number, status, assigned_route_id, earliest_date, latest_date, destination_country",
      )
      .not("assigned_route_id", "is", null),
  ]);
  if (routesResult.error) throw routesResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;
  if (requestsResult.error) throw requestsResult.error;

  const routes = (routesResult.data ?? []) as Pick<
    RouteRow,
    | "id"
    | "route_number"
    | "route_name"
    | "departure_date"
    | "vehicle_id"
    | "driver_id"
    | "status"
    | "max_capacity"
  >[];
  const assignments = (assignmentsResult.data ?? []) as ConflictRouteAssignment[];
  const requests = (requestsResult.data ?? []) as ConflictRequest[];
  const routeById = new Map(routes.map((r) => [r.id, r]));
  const conflicts: SchedulingConflict[] = [];

  // Driver / vehicle double-booked on the same departure date, among still-active routes.
  const activeRoutes = routes.filter(
    (r) => ACTIVE_ROUTE_STATUSES.includes(r.status) && r.departure_date,
  );
  const byDriverDate = new Map<string, RouteRow[]>();
  const byVehicleDate = new Map<string, RouteRow[]>();
  for (const r of activeRoutes as RouteRow[]) {
    if (r.driver_id) {
      const key = `${r.driver_id}|${r.departure_date}`;
      byDriverDate.set(key, [...(byDriverDate.get(key) ?? []), r]);
    }
    if (r.vehicle_id) {
      const key = `${r.vehicle_id}|${r.departure_date}`;
      byVehicleDate.set(key, [...(byVehicleDate.get(key) ?? []), r]);
    }
  }
  for (const group of byDriverDate.values()) {
    if (group.length > 1) {
      for (const r of group) {
        conflicts.push({
          id: `driver-conflict-${r.id}`,
          severity: "error",
          message: `Driver double-booked: ${group.map((g) => g.route_number).join(", ")} all depart ${r.departure_date}.`,
          routeId: r.id,
        });
      }
    }
  }
  for (const group of byVehicleDate.values()) {
    if (group.length > 1) {
      for (const r of group) {
        conflicts.push({
          id: `vehicle-conflict-${r.id}`,
          severity: "error",
          message: `Vehicle double-booked: ${group.map((g) => g.route_number).join(", ")} all depart ${r.departure_date}.`,
          routeId: r.id,
        });
      }
    }
  }

  // A request assigned (actively) to more than one route.
  const activeAssignmentsByRequest = new Map<string, ConflictRouteAssignment[]>();
  for (const a of assignments) {
    if (!ACTIVE_RESERVATION_STATUSES.includes(a.reservation_status)) continue;
    activeAssignmentsByRequest.set(a.transport_request_id, [
      ...(activeAssignmentsByRequest.get(a.transport_request_id) ?? []),
      a,
    ]);
  }
  for (const [requestId, group] of activeAssignmentsByRequest) {
    if (group.length > 1) {
      const request = requests.find((r) => r.id === requestId);
      conflicts.push({
        id: `multi-route-${requestId}`,
        severity: "error",
        message: `Request ${request?.request_number ?? requestId} is actively assigned to ${group.length} routes at once.`,
        requestId,
      });
    }
  }

  for (const request of requests) {
    const route = request.assigned_route_id ? routeById.get(request.assigned_route_id) : undefined;

    // Cancelled/rejected request still holding a route assignment.
    if (CLOSED_REQUEST_STATUSES.includes(request.status) && request.assigned_route_id) {
      conflicts.push({
        id: `closed-but-scheduled-${request.id}`,
        severity: "error",
        message: `Request ${request.request_number} is ${request.status.replace(/_/g, " ")} but still assigned to a route.`,
        requestId: request.id,
        routeId: request.assigned_route_id,
      });
    }

    // Not yet approved for scheduling but already has a route.
    if (NOT_YET_SCHEDULABLE_STATUSES.includes(request.status) && request.assigned_route_id) {
      conflicts.push({
        id: `not-ready-but-scheduled-${request.id}`,
        severity: "warning",
        message: `Request ${request.request_number} is assigned to a route while still at "${request.status.replace(/_/g, " ")}".`,
        requestId: request.id,
        routeId: request.assigned_route_id,
      });
    }

    // Route departure date outside the request's own date window, or destination mismatch —
    // reuses the same deterministic checkRouteCompatibility() the manual assignment UI already
    // uses, so the calendar and the assignment flow never disagree about what counts as a mismatch.
    if (route) {
      const warnings = checkRouteCompatibility(route as RouteRow, request);
      for (const warning of warnings) {
        conflicts.push({
          id: `compat-${request.id}-${warning}`,
          severity: "warning",
          message: `${request.request_number}: ${warning}`,
          requestId: request.id,
          routeId: route.id,
        });
      }
    }
  }

  // Capacity: active assignments on a route exceeding its declared max_capacity.
  const activeByRoute = new Map<string, number>();
  for (const a of assignments) {
    if (!ACTIVE_RESERVATION_STATUSES.includes(a.reservation_status)) continue;
    activeByRoute.set(a.route_id, (activeByRoute.get(a.route_id) ?? 0) + 1);
  }
  for (const route of routes) {
    const count = activeByRoute.get(route.id) ?? 0;
    if (count > route.max_capacity) {
      conflicts.push({
        id: `capacity-${route.id}`,
        severity: "warning",
        message: `${route.route_number}: ${count} active assignments exceed its capacity of ${route.max_capacity}.`,
        routeId: route.id,
      });
    }
  }

  return conflicts;
}
