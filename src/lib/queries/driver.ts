import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export async function getMyDriverRecord(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("drivers")
    .select("id, name, availability_status")
    .eq("profile_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type DriverRouteRow = {
  id: string;
  route_name: string;
  route_number: string | null;
  departure_date: string | null;
  status: string;
  origin_country: string | null;
  destination_countries: string[];
};

// "Single active route" — the nearest route (by departure date) that isn't finished yet, assigned
// to this driver. Deliberately just one, not a list: this workspace is meant to be opened on a
// phone right before or during a job, not browsed.
export async function getMyActiveRoute(driverId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("routes")
    .select(
      "id, route_name, route_number, departure_date, status, origin_country, destination_countries",
    )
    .eq("driver_id", driverId)
    .in("status", ["planning", "confirmed", "in_progress"])
    .order("departure_date", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as DriverRouteRow | null;
}

export async function listRouteStops(routeId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("route_stops")
    .select("id, stop_order, city, country, stop_type, planned_time")
    .eq("route_id", routeId)
    .order("stop_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type DriverJobRow = {
  id: string;
  request_number: string;
  animal_name: string | null;
  pickup_city: string | null;
  pickup_country: string | null;
  destination_city: string | null;
  destination_country: string | null;
  status: string;
  crate_requirements: string | null;
  behavioural_notes: string | null;
};

export async function listMyJobsForRoute(driverId: string, routeId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_requests")
    .select(
      "id, request_number, animal_name, pickup_city, pickup_country, destination_city, destination_country, status, crate_requirements, behavioural_notes",
    )
    .eq("assigned_driver_id", driverId)
    .eq("assigned_route_id", routeId);
  if (error) throw error;
  return (data ?? []) as DriverJobRow[];
}

// The subset of the full operational status enum a driver can actually move a job through — never
// hold/compliance/quotation states, those stay ops-only.
export const driverStatusSteps = [
  "driver_assigned",
  "pickup_confirmed",
  "animal_collected",
  "in_transport",
  "approaching_destination",
  "delivered",
  "handover_confirmed",
] as const;

export async function advanceJobStatus(input: {
  transportRequestId: string;
  newStatus: string;
  driverProfileId: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("transport_requests")
    .update({ status: input.newStatus })
    .eq("id", input.transportRequestId);
  if (error) throw error;

  const { error: historyError } = await supabase.from("transport_status_history").insert({
    transport_request_id: input.transportRequestId,
    status: input.newStatus,
    changed_by: input.driverProfileId,
  });
  if (historyError) throw historyError;
}

export const incidentTypeLabels: Record<string, string> = {
  delay: "Delay",
  vehicle_breakdown: "Vehicle breakdown",
  animal_welfare_concern: "Animal welfare concern",
  accident: "Accident",
  document_issue: "Document issue",
  weather: "Weather",
  other: "Other",
};

export async function reportIncident(input: {
  transportRequestId: string;
  reportedBy: string;
  incidentType:
    | "delay"
    | "vehicle_breakdown"
    | "animal_welfare_concern"
    | "accident"
    | "document_issue"
    | "weather"
    | "other";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("transport_incidents").insert({
    transport_request_id: input.transportRequestId,
    reported_by: input.reportedBy,
    incident_type: input.incidentType,
    severity: input.severity,
    description: input.description,
  });
  if (error) throw error;
}
