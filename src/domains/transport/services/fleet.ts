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

export async function listDrivers() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("drivers").select("*").order("name");
  if (error) throw error;
  return data as DriverRow[];
}

export async function createDriver(payload: Database["public"]["Tables"]["drivers"]["Insert"]) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("drivers").insert(payload);
  if (error) throw error;
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
