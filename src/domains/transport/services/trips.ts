import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";

// Trips — a transport company's own multi-stop dispatch tool for internally-organized runs (e.g.
// "trip to Netherlands, 6 dogs"), separate from the customer-facing, compliance-driven
// transport_requests model (see 20260915000000_transport_company_trips.sql's own header comment
// for why). Every write here is a plain RLS-scoped table operation, not an RPC — unlike
// assignOwnDriverToJob/assignOwnVehicleToJob above, a trip is the org's own data from the moment
// it's created, so "org members manage their own trips/trip stops" (is_org_member()-gated) is
// already the right amount of enforcement; no client-side org filter is needed on any query below.

export type TripRow = Database["public"]["Tables"]["trips"]["Row"];
export type TripInsert = Database["public"]["Tables"]["trips"]["Insert"];
export type TripUpdate = Database["public"]["Tables"]["trips"]["Update"];
export type TripStatus = TripRow["status"];

export type TripStopRow = Database["public"]["Tables"]["trip_stops"]["Row"];
export type TripStopInsert = Database["public"]["Tables"]["trip_stops"]["Insert"];
export type TripStopUpdate = Database["public"]["Tables"]["trip_stops"]["Update"];

// in_progress first (what you're doing right now), then planning (upcoming), then completed/
// cancelled (history) last — created_at desc as the tiebreaker within each group so the newest of
// each shows first.
const TRIP_STATUS_SORT_WEIGHT: Record<TripStatus, number> = {
  in_progress: 0,
  planning: 1,
  completed: 2,
  cancelled: 3,
};

export async function listMyTrips(): Promise<TripRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as TripRow[];
  return rows.sort((a, b) => TRIP_STATUS_SORT_WEIGHT[a.status] - TRIP_STATUS_SORT_WEIGHT[b.status]);
}

export async function getTrip(tripId: string): Promise<TripRow> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("trips").select("*").eq("id", tripId).single();
  if (error) throw error;
  return data as TripRow;
}

export async function createTrip(payload: TripInsert): Promise<TripRow> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("trips").insert(payload).select().single();
  if (error) throw error;
  return data as TripRow;
}

export async function updateTrip(tripId: string, patch: TripUpdate): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("trips").update(patch).eq("id", tripId);
  if (error) throw error;
}

// Status changes only — no hard delete exposed anywhere in the UI, so a trip's history (which
// stops were done, when) is never silently lost. "Cancel" is just another status, same as
// "completed"; both are reversible by editing the trip again if picked by mistake.
export async function setTripStatus(tripId: string, status: TripStatus): Promise<void> {
  await updateTrip(tripId, { status });
}

export async function listTripStops(tripId: string): Promise<TripStopRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("trip_stops")
    .select("*")
    .eq("trip_id", tripId)
    .order("stop_order", { ascending: true });
  if (error) throw error;
  return data as TripStopRow[];
}

// Appends at the end of the trip's current stop order — the common case (adding dogs to the plan
// as they're confirmed), not a general reordering tool. `stop_order` starts at 1.
export async function addTripStop(
  tripId: string,
  payload: Omit<TripStopInsert, "trip_id" | "stop_order">,
): Promise<TripStopRow> {
  const supabase = getSupabaseBrowserClient();
  const { data: existing, error: existingError } = await supabase
    .from("trip_stops")
    .select("stop_order")
    .eq("trip_id", tripId)
    .order("stop_order", { ascending: false })
    .limit(1);
  if (existingError) throw existingError;
  const nextOrder = (existing?.[0]?.stop_order ?? 0) + 1;
  const { data, error } = await supabase
    .from("trip_stops")
    .insert({ ...payload, trip_id: tripId, stop_order: nextOrder })
    .select()
    .single();
  if (error) throw error;
  return data as TripStopRow;
}

export async function updateTripStop(stopId: string, patch: TripStopUpdate): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("trip_stops").update(patch).eq("id", stopId);
  if (error) throw error;
}

export async function removeTripStop(stopId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("trip_stops").delete().eq("id", stopId);
  if (error) throw error;
}

// The two live-checklist transitions — "Mark picked up" / "Mark delivered" on a stop. Delivered
// is only ever offered by the UI once a stop is already picked_up (real-world sequence for a
// single animal within one trip), but that's a workflow nicety enforced client-side, not a DB
// constraint — matches this codebase's "RLS is the real gate, UI guides the common path"
// convention (e.g. requireRole's own doc comment).
export async function markStopPickedUp(stopId: string): Promise<void> {
  await updateTripStop(stopId, { status: "picked_up", picked_up_at: new Date().toISOString() });
}

export async function markStopDelivered(stopId: string): Promise<void> {
  await updateTripStop(stopId, { status: "delivered", delivered_at: new Date().toISOString() });
}
