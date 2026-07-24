import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";

export type RouteRow = Database["public"]["Tables"]["routes"]["Row"];

export async function listRoutes() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("routes")
    .select("*")
    .order("departure_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as RouteRow[];
}

export async function createRoute(payload: Database["public"]["Tables"]["routes"]["Insert"]) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("routes").insert(payload).select("id").single();
  if (error) throw error;
  return data;
}

export async function getRoute(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("routes").select("*").eq("id", id).single();
  if (error) throw error;
  return data as RouteRow;
}

export async function listRouteAssignments(routeId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("route_assignments")
    .select(
      "id, route_id, transport_request_id, reservation_status, hold_expires_at, compatibility_checked, compatibility_notes, assigned_at",
    )
    .eq("route_id", routeId)
    .order("assigned_at", { ascending: true });
  if (error) throw error;
  return data;
}

// A basic, explainable compatibility check — not the full deterministic matching engine (that's
// its own later phase), just what's needed to sanity-check an assignment made by a human here.
export function checkRouteCompatibility(
  route: RouteRow,
  request: {
    earliest_date: string | null;
    latest_date: string | null;
    destination_country: string | null;
  },
) {
  const warnings: string[] = [];
  if (
    route.departure_date &&
    request.earliest_date &&
    route.departure_date < request.earliest_date
  ) {
    warnings.push("Route departs before the customer's earliest acceptable date.");
  }
  if (route.departure_date && request.latest_date && route.departure_date > request.latest_date) {
    warnings.push("Route departs after the customer's latest acceptable date.");
  }
  if (
    request.destination_country &&
    !route.destination_countries.includes(request.destination_country)
  ) {
    warnings.push("Route's destination countries don't include the request's destination.");
  }
  return warnings;
}

// Both the route_assignments insert and the transport_requests.assigned_route_id update used to
// be separate client-side calls (the second one's error wasn't even checked -- a failure there
// silently left the two tables inconsistent), and assigned_by trusted a client-supplied id.
// assign_request_to_route() does both writes in one transaction with a server-stamped actor.
export async function assignRequestToRoute(input: {
  routeId: string;
  transportRequestId: string;
  compatibilityNotes?: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("assign_request_to_route", {
    p_route_id: input.routeId,
    p_transport_request_id: input.transportRequestId,
    p_compatibility_notes: input.compatibilityNotes || null,
  });
  if (error) throw error;
}

export type RouteWaitlistRow = Database["public"]["Tables"]["route_waitlist"]["Row"];

export async function joinRouteWaitlist(input: {
  profileId: string;
  originCountry: string;
  destinationCountry: string;
  earliestDate?: string | null;
  latestDate?: string | null;
  notes?: string | null;
}) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("route_waitlist").insert({
    profile_id: input.profileId,
    origin_country: input.originCountry,
    destination_country: input.destinationCountry,
    earliest_date: input.earliestDate || null,
    latest_date: input.latestDate || null,
    notes: input.notes || null,
  });
  if (error) throw error;
}

export async function listMyWaitlistEntries(profileId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("route_waitlist")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RouteWaitlistRow[];
}

export async function cancelWaitlistEntry(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("route_waitlist")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) throw error;
}

export type DemandCluster = {
  originCountry: string;
  destinationCountry: string;
  count: number;
  earliestWanted: string | null;
};

// Groups open waitlist entries by country pair — the raw signal ops uses to decide which route to
// plan next. Deliberately simple counting, not a forecasting model.
export async function listDemandClusters(): Promise<DemandCluster[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("route_waitlist")
    .select("origin_country, destination_country, earliest_date")
    .eq("status", "open");
  if (error) throw error;
  const clusters = new Map<string, DemandCluster>();
  for (const row of data ?? []) {
    const key = `${row.origin_country}→${row.destination_country}`;
    const existing = clusters.get(key);
    if (existing) {
      existing.count += 1;
      if (
        row.earliest_date &&
        (!existing.earliestWanted || row.earliest_date < existing.earliestWanted)
      ) {
        existing.earliestWanted = row.earliest_date;
      }
    } else {
      clusters.set(key, {
        originCountry: row.origin_country,
        destinationCountry: row.destination_country,
        count: 1,
        earliestWanted: row.earliest_date,
      });
    }
  }
  return Array.from(clusters.values()).sort((a, b) => b.count - a.count);
}

export type RouteProfitability = {
  route: RouteRow;
  jobCount: number;
  actualRevenue: number;
  estimatedRevenue: number;
  estimatedCost: number;
  margin: number | null;
};

// Real revenue per route = sum of accepted quotations linked to that route's assigned requests —
// not just the route's own customer_revenue_estimate field, which is a planning estimate set
// before any individual request is priced. Falls back to the estimate when nothing's been
// invoiced yet so a brand-new route isn't just blank.
export async function listRouteProfitability(): Promise<RouteProfitability[]> {
  const supabase = getSupabaseBrowserClient();
  const [routesResult, requestsResult, quotationsResult] = await Promise.all([
    supabase.from("routes").select("*"),
    supabase
      .from("transport_requests")
      .select("id, assigned_route_id")
      .not("assigned_route_id", "is", null),
    supabase
      .from("quotations")
      .select("transport_request_id, total_price, status")
      .eq("status", "accepted"),
  ]);
  if (routesResult.error) throw routesResult.error;
  if (requestsResult.error) throw requestsResult.error;
  if (quotationsResult.error) throw quotationsResult.error;

  const acceptedByRequest = new Map<string, number>();
  for (const q of quotationsResult.data ?? []) {
    if (q.total_price != null) acceptedByRequest.set(q.transport_request_id, q.total_price);
  }
  const requestsByRoute = new Map<string, string[]>();
  for (const r of requestsResult.data ?? []) {
    if (!r.assigned_route_id) continue;
    requestsByRoute.set(r.assigned_route_id, [
      ...(requestsByRoute.get(r.assigned_route_id) ?? []),
      r.id,
    ]);
  }

  return ((routesResult.data ?? []) as RouteRow[]).map((route) => {
    const requestIds = requestsByRoute.get(route.id) ?? [];
    const actualRevenue = requestIds.reduce((sum, id) => sum + (acceptedByRequest.get(id) ?? 0), 0);
    const estimatedRevenue = route.customer_revenue_estimate ?? 0;
    const estimatedCost = route.internal_cost_estimate ?? 0;
    const revenue = actualRevenue > 0 ? actualRevenue : estimatedRevenue;
    return {
      route,
      jobCount: requestIds.length,
      actualRevenue,
      estimatedRevenue,
      estimatedCost,
      margin: route.internal_cost_estimate != null ? revenue - estimatedCost : null,
    };
  });
}
