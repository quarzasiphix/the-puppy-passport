import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { OpsRequestListRow } from "@/lib/queries/operations";
import type { RouteRow } from "@/lib/queries/routes";

// Deterministic, explainable matching v1. No generative AI, no automatic assignment — this only
// ever produces a suggestion for an operations employee to accept or dismiss. Same inputs always
// produce the same score (see MATCH_RULE_VERSION below — bump it if the rule weights change, so
// past suggestions stay attributable to the rule version that generated them).
export const MATCH_RULE_VERSION = "v1";

export type MatchOutcome = "strong_match" | "possible_match" | "manual_review" | "blocked";

export type MatchResult = {
  routeId: string;
  score: number;
  outcome: MatchOutcome;
  blockingReasons: string[];
  warnings: string[];
  explanation: string[];
};

const unassignedStatuses = [
  "submitted",
  "initial_review",
  "documents_under_review",
  "ready_for_scheduling",
  "quotation_sent",
  "accepted_by_customer",
] as const;

export async function listUnmatchedRequests() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_requests")
    .select(
      "id, request_number, animal_name, size_category, requester_profile_id, pickup_country, pickup_city, destination_country, destination_city, earliest_date, latest_date, flexible_dates, requested_service_type, status, compliance_review_result, assigned_route_id, assigned_driver_id, created_at",
    )
    .in("status", unassignedStatuses)
    .is("assigned_route_id", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as OpsRequestListRow[];
}

export async function listCandidateRoutes() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("routes")
    .select("*")
    .in("status", ["planning", "confirmed"]);
  if (error) throw error;
  return data as RouteRow[];
}

// One query for every candidate route's active-assignment count, instead of computeMatch()
// querying route_assignments once per route -- selecting a request against N candidate routes
// used to fire N separate count round-trips (parallelised via Promise.all, but still N queries
// against the same table for the same request), a real N+1 that scales linearly with how many
// routes are in planning/confirmed. Grouping client-side is necessary here: PostgREST's query
// builder has no GROUP BY, only a plain row select.
async function fetchActiveAssignmentCounts(routeIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (routeIds.length === 0) return counts;
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("route_assignments")
    .select("route_id")
    .in("route_id", routeIds)
    .not("reservation_status", "in", "(released,cancelled,expired)");
  if (error) throw error;
  for (const row of data ?? []) {
    counts.set(row.route_id, (counts.get(row.route_id) ?? 0) + 1);
  }
  return counts;
}

export async function computeMatch(
  request: OpsRequestListRow,
  route: RouteRow,
  activeAssignmentCount: number,
): Promise<MatchResult> {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  const explanation: string[] = [];
  let score = 100;

  // Destination compatibility
  if (request.destination_country && route.destination_countries.length > 0) {
    if (route.destination_countries.includes(request.destination_country)) {
      explanation.push(`Route already serves ${request.destination_country}.`);
    } else {
      blockingReasons.push(`Route does not serve ${request.destination_country}.`);
    }
  }

  // Origin compatibility
  if (
    request.pickup_country &&
    route.origin_country &&
    request.pickup_country !== route.origin_country
  ) {
    warnings.push(
      `Pickup country (${request.pickup_country}) differs from route origin (${route.origin_country}) — may mean an additional stop.`,
    );
    score -= 20;
  }

  // Date compatibility
  if (
    route.departure_date &&
    request.earliest_date &&
    route.departure_date < request.earliest_date
  ) {
    if (request.flexible_dates) {
      warnings.push(
        "Route departs before the customer's earliest date — customer flexibility may accommodate this.",
      );
      score -= 10;
    } else {
      blockingReasons.push(
        "Route departs before the customer's earliest acceptable date, and dates are not flexible.",
      );
    }
  }
  if (route.departure_date && request.latest_date && route.departure_date > request.latest_date) {
    if (request.flexible_dates) {
      warnings.push(
        "Route departs after the customer's latest date — customer flexibility may accommodate this.",
      );
      score -= 10;
    } else {
      blockingReasons.push(
        "Route departs after the customer's latest acceptable date, and dates are not flexible.",
      );
    }
  }
  if (
    route.departure_date &&
    request.earliest_date &&
    request.latest_date &&
    route.departure_date >= request.earliest_date &&
    route.departure_date <= request.latest_date
  ) {
    explanation.push("Route departure date falls within the customer's requested window.");
  }

  // Capacity
  const available = Math.max(0, route.max_capacity - activeAssignmentCount);
  if (available <= 0) {
    blockingReasons.push("Route has no remaining capacity.");
  } else if (available === 1) {
    warnings.push("Route is nearly full — only one place remaining.");
    score -= 10;
  } else {
    explanation.push(`${available} places currently available on this route.`);
  }

  // Document / compliance readiness
  if (request.compliance_review_result !== "eligible_for_quotation") {
    warnings.push(
      `Document/compliance review incomplete (${request.compliance_review_result.replace(/_/g, " ")}).`,
    );
    score -= 15;
  } else {
    explanation.push("Documents and compliance review are ready.");
  }

  // Service type — a shared route only really suits a shared/recommend_best request
  if (
    request.requested_service_type !== "shared" &&
    request.requested_service_type !== "recommend_best"
  ) {
    warnings.push(
      `Customer requested ${request.requested_service_type.replace("_", " ")} service, not shared — a shared route may not match their preference.`,
    );
    score -= 25;
  }

  score = Math.max(0, Math.min(100, score));

  let outcome: MatchOutcome;
  if (blockingReasons.length > 0) outcome = "blocked";
  else if (score >= 80) outcome = "strong_match";
  else if (score >= 50) outcome = "possible_match";
  else outcome = "manual_review";

  return { routeId: route.id, score, outcome, blockingReasons, warnings, explanation };
}

export async function suggestRoutesForRequest(request: OpsRequestListRow, routes: RouteRow[]) {
  const counts = await fetchActiveAssignmentCounts(routes.map((route) => route.id));
  const results = await Promise.all(
    routes.map((route) => computeMatch(request, route, counts.get(route.id) ?? 0)),
  );
  return results.sort((a, b) => b.score - a.score);
}

// Demand clustering for unmatched requests — a suggestion surface for ops, never an automatic
// route creation.
export function clusterByDemand(requests: OpsRequestListRow[]) {
  const groups = new Map<
    string,
    { pickupCountry: string; destinationCountry: string; count: number; animalSizes: Set<string> }
  >();
  for (const r of requests) {
    const key = `${r.pickup_country ?? "?"}→${r.destination_country ?? "?"}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (r.size_category) existing.animalSizes.add(r.size_category);
    } else {
      groups.set(key, {
        pickupCountry: r.pickup_country ?? "Unknown",
        destinationCountry: r.destination_country ?? "Unknown",
        count: 1,
        animalSizes: new Set(r.size_category ? [r.size_category] : []),
      });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.count - a.count);
}

export async function logMatchDecision(input: {
  actorId: string;
  requestId: string;
  routeId: string;
  action: "proposed" | "dismissed" | "marked_for_review";
  score: number;
  outcome: MatchOutcome;
}) {
  const supabase = getSupabaseBrowserClient();
  await supabase.from("audit_logs").insert({
    actor_profile_id: input.actorId,
    action: `matching.${input.action}`,
    target_type: "transport_requests",
    target_id: input.requestId,
    after: {
      route_id: input.routeId,
      score: input.score,
      outcome: input.outcome,
      rule_version: MATCH_RULE_VERSION,
    },
  });
}
