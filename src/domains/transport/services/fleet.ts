import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";

export type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];
export type DriverRow = Database["public"]["Tables"]["drivers"]["Row"];
export type FleetJobRow = Pick<
  Database["public"]["Tables"]["transport_requests"]["Row"],
  | "id"
  | "request_number"
  | "status"
  | "animal_name"
  | "pickup_city"
  | "pickup_country"
  | "destination_city"
  | "destination_country"
  | "earliest_date"
  | "latest_date"
  | "assigned_driver_id"
  | "assigned_vehicle_id"
>;

export async function listVehicles() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("vehicles").select("*").order("name");
  if (error) throw error;
  return data as VehicleRow[];
}

export async function createVehicle(payload: Database["public"]["Tables"]["vehicles"]["Insert"]) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("vehicles").insert(payload);
  if (error) throw error;
}

export async function getVehicle(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("vehicles").select("*").eq("id", id).single();
  if (error) throw error;
  return data as VehicleRow;
}

export async function updateVehicle(
  id: string,
  patch: Database["public"]["Tables"]["vehicles"]["Update"],
) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("vehicles").update(patch).eq("id", id);
  if (error) throw error;
}

export async function listDrivers() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("drivers").select("*").order("name");
  if (error) throw error;
  return data as DriverRow[];
}

export async function createDriver(payload: Database["public"]["Tables"]["drivers"]["Insert"]) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("drivers").insert(payload).select("id").single();
  if (error) throw error;
  return data.id as string;
}

// Links (or unlinks/relinks) a driver record to a real Anemalo account by email — the audited,
// notifying counterpart to a plain drivers.update(). Goes through link_driver_account()
// (20260919000000_link_driver_account_rpc.sql) rather than a client-side resolve+update because
// audit_logs INSERT is ops-staff-only under RLS, which would silently block a transport-company
// caller from ever recording the audit row; the RPC re-derives the exact same "can this caller
// manage this driver" condition as the drivers table's own RLS policies, so it can never do more
// than a direct update already allowed.
export async function linkDriverAccount(driverId: string, loginEmail: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("link_driver_account", {
    p_driver_id: driverId,
    p_login_email: loginEmail,
  });
  if (error) throw error;
}

export async function getDriver(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("drivers").select("*").eq("id", id).single();
  if (error) throw error;
  return data as DriverRow;
}

export async function updateDriver(
  id: string,
  patch: Database["public"]["Tables"]["drivers"]["Update"],
) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("drivers").update(patch).eq("id", id);
  if (error) throw error;
}

export type DriverStats = {
  completedJobs: number;
  averageRating: number | null;
  ratingCount: number;
};

// Reads transport_reviews.driver_rating (customer rating the driver, already on that table since
// 20260101004700_transport_reviews.sql, never surfaced anywhere until now) plus a completed-job
// count from transport_requests. Both queries are covered by existing RLS — ops sees every
// request/review, a company sees reviews for jobs assigned to its own fleet via the new
// "company members view reviews for their fleet's jobs" policy
// (20260920000000_transport_reviews_fleet_visibility.sql) — no new table needed.
export async function getDriverStats(driverId: string): Promise<DriverStats> {
  const supabase = getSupabaseBrowserClient();

  const [completedResult, ratingsResult] = await Promise.all([
    supabase
      .from("transport_requests")
      .select("id", { count: "exact", head: true })
      .eq("assigned_driver_id", driverId)
      .eq("status", "completed"),
    supabase
      .from("transport_reviews")
      .select("driver_rating, transport_requests!inner(assigned_driver_id)")
      .eq("transport_requests.assigned_driver_id", driverId)
      .not("driver_rating", "is", null),
  ]);

  if (completedResult.error) throw completedResult.error;
  if (ratingsResult.error) throw ratingsResult.error;

  const ratings = (ratingsResult.data ?? [])
    .map((r) => r.driver_rating)
    .filter((r): r is number => r !== null);

  return {
    completedJobs: completedResult.count ?? 0,
    averageRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    ratingCount: ratings.length,
  };
}

// A transport company's "Jobs"/"Calendar"/"Dispatch" pages all read from this: requests currently
// assigned to their own fleet. No client-side org filter needed — the "company members view jobs
// assigned to their fleet" RLS policy (20260912150000_fleet_multi_tenancy.sql) already scopes this
// to rows whose assigned driver/vehicle belongs to a company the caller is an active member of; an
// ops-staff caller instead sees everything via their own separate ALL policy.
export async function listMyFleetJobs() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_requests")
    .select(
      "id, request_number, status, animal_name, pickup_city, pickup_country, destination_city, destination_country, earliest_date, latest_date, assigned_driver_id, assigned_vehicle_id",
    )
    .order("earliest_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as FleetJobRow[];
}

// Single-row companion to listMyFleetJobs() for the job detail page — same RLS policy scopes this
// to jobs assigned to the caller's own fleet, so an unrelated job id simply returns no row rather
// than another company's data.
export async function getMyFleetJobDetail(requestId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_requests")
    .select(
      "id, request_number, status, animal_name, pickup_city, pickup_country, destination_city, destination_country, earliest_date, latest_date, assigned_driver_id, assigned_vehicle_id",
    )
    .eq("id", requestId)
    .single();
  if (error) throw error;
  return data as FleetJobRow;
}

// The one write path a transport company has onto transport_requests (added 2026-09-14, alongside
// the Dispatch page): reassigning which of ITS OWN drivers/vehicles handles a job already routed
// to its fleet. change_ops_request_status()/assign_driver_to_job() (ops-staff-only) and
// advance_transport_job_status() (the individually assigned driver only) are all untouched — this
// is a narrower, separate capability, enforced server-side by assign_own_driver_to_job()/
// assign_own_vehicle_to_job() (both SECURITY DEFINER, both re-derive "does this job already belong
// to one of my orgs" from the exact same condition as the SELECT policy above, so a company can
// never dispatch an unrelated job or plug in another company's driver/vehicle).
export async function assignOwnDriverToJob(requestId: string, driverId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("assign_own_driver_to_job", {
    p_request_id: requestId,
    p_driver_id: driverId,
  });
  if (error) throw error;
}

export async function assignOwnVehicleToJob(requestId: string, vehicleId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("assign_own_vehicle_to_job", {
    p_request_id: requestId,
    p_vehicle_id: vehicleId,
  });
  if (error) throw error;
}

// "Warnings for expired documents / upcoming expiry / service due" — a date within this many days
// counts as "upcoming", already past counts as "expired".
const UPCOMING_WINDOW_DAYS = 30;

export type ExpiryWarning = { label: string; severity: "expired" | "upcoming" };

export function expiryWarnings(date: string | null, label: string): ExpiryWarning[] {
  if (!date) return [];
  const days = (new Date(date).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return [{ label: `${label} expired`, severity: "expired" }];
  if (days <= UPCOMING_WINDOW_DAYS)
    return [{ label: `${label} expires soon`, severity: "upcoming" }];
  return [];
}
