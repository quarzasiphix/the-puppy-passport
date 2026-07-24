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
  request_number: string | null;
  animal_name: string | null;
  pickup_city: string | null;
  pickup_country: string | null;
  pickup_address_exact: string | null;
  destination_city: string | null;
  destination_country: string | null;
  destination_address_exact: string | null;
  status: string;
  crate_requirements: string | null;
  behavioural_notes: string | null;
  release_authorized_by: string | null;
  receive_authorized_by: string | null;
};

// Queries driver_transport_job_view (docs/adr/TRANSPORT_DATA_MODEL.md) instead of
// transport_requests directly — a security_invoker view scoped by the same row-level RLS
// ("assigned drivers view their own requests"), but column-minimized at the database layer as
// defense in depth against a future careless select("*") regaining access to payer/owner/
// compliance columns. It also carries the exact pickup/destination address and the
// pickup/delivery contact name a driver actually needs to do the job, which the previous
// hand-picked select list on transport_requests never included.
export async function listMyJobsForRoute(driverId: string, routeId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("driver_transport_job_view")
    .select(
      "id, request_number, animal_name, pickup_city, pickup_country, pickup_address_exact, destination_city, destination_country, destination_address_exact, status, crate_requirements, behavioural_notes, release_authorized_by, receive_authorized_by",
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

const TRANSPORT_EVIDENCE_BUCKET = "transport-evidence";

function sanitizeFilenameForStoragePath(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// The status update, history insert and (optional) evidence upload used to be separate
// client-side writes with a client-supplied driverProfileId trusted as the actor -- the same
// non-atomic + forgeable-actor shape already fixed for changeOpsRequestStatus() and
// assignRequestToRoute(). advance_transport_job_status() does the status/history write
// atomically with a server-stamped auth.uid() actor; the evidence photo (if provided) is
// uploaded first since Storage and Postgres are separate systems here, same pattern as
// submitDocument()/sendMessage()'s attachment handling.
export async function advanceJobStatus(input: {
  transportRequestId: string;
  newStatus: string;
  evidencePhoto?: File;
  customerNote?: string;
}) {
  const supabase = getSupabaseBrowserClient();

  let evidenceObjectPath: string | null = null;
  if (input.evidencePhoto) {
    const objectPath = `${input.transportRequestId}/${input.newStatus}-${Date.now()}-${sanitizeFilenameForStoragePath(input.evidencePhoto.name)}`;
    const { error: uploadError } = await supabase.storage
      .from(TRANSPORT_EVIDENCE_BUCKET)
      .upload(objectPath, input.evidencePhoto, {
        contentType: input.evidencePhoto.type || undefined,
      });
    if (uploadError) throw uploadError;
    evidenceObjectPath = objectPath;
  }

  const { error } = await supabase.rpc("advance_transport_job_status", {
    p_request_id: input.transportRequestId,
    p_new_status: input.newStatus,
    p_evidence_object_path: evidenceObjectPath,
    p_customer_note: input.customerNote || null,
  });
  if (error) {
    if (evidenceObjectPath) {
      await supabase.storage.from(TRANSPORT_EVIDENCE_BUCKET).remove([evidenceObjectPath]);
    }
    throw error;
  }
}

// The bucket is private -- a stored object path is only ever useful through a short-lived signed
// URL generated on demand, same pattern as getSignedDocumentUrl()/getSignedAttachmentUrl().
export async function getSignedEvidenceUrl(objectPath: string): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.storage
    .from(TRANSPORT_EVIDENCE_BUCKET)
    .createSignedUrl(objectPath, 300);
  if (error) throw error;
  return data.signedUrl;
}

// Driver-minimum timeline (Stage C): the same status_history rows a driver already has RLS access
// to for their assigned job ("assigned drivers view and log status on their own requests"), but
// only customer_note ever leaves the database — internal_note (compliance/ops-only commentary)
// stays out, matching the driver-minimum-data rule already applied to listMyJobsForRoute().
export type DriverTimelineEvent = {
  id: string;
  timestamp: string;
  status: string;
  note: string | null;
};

export async function getDriverTimeline(
  transportRequestId: string,
): Promise<DriverTimelineEvent[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_status_history")
    .select("id, status, changed_at, customer_note")
    .eq("transport_request_id", transportRequestId)
    .order("changed_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((h) => ({
    id: h.id,
    timestamp: h.changed_at,
    status: h.status,
    note: h.customer_note,
  }));
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
