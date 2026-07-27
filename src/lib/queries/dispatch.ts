import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// Statuses that count as "actively on a job" for workload purposes — matches driverStatusSteps in
// driver.ts minus the terminal handover_confirmed state.
const activeJobStatuses = [
  "driver_assigned",
  "pickup_confirmed",
  "animal_collected",
  "in_transport",
  "rest_or_care_stop",
  "approaching_destination",
  "delivered",
] as const;

export type DriverWorkload = {
  id: string;
  name: string;
  availability_status: string | null;
  internal_verification_status: string | null;
  document_expiry_date: string | null;
  activeJobCount: number;
};

// Stage YR-9 (driver and vehicle eligibility consistency): assign_driver_to_job() only ever
// checked that a drivers row with this id exists, deliberately -- ops staff, not the system, make
// the final assignment call (CLAUDE.md: "AI may only produce recommendations... final transport
// approval stays human"). But that human judgment needs the relevant facts in front of it, and
// this query previously never selected internal_verification_status/document_expiry_date at all
// -- ops had literally no way to see a driver was unverified or document-expired while assigning
// them, not because they made an informed call, but because the data was never surfaced. Fixed by
// exposing both columns; dashboard.operations.dispatch.tsx now shows a warning badge derived from
// them, matching the same documentExpiryWarning() pattern already used for quotations/vehicles.
export async function listDriverWorkloads(): Promise<DriverWorkload[]> {
  const supabase = getSupabaseBrowserClient();
  const [driversResult, jobsResult] = await Promise.all([
    supabase
      .from("drivers")
      .select("id, name, availability_status, internal_verification_status, document_expiry_date")
      .order("name"),
    supabase
      .from("transport_requests")
      .select("assigned_driver_id")
      .in("status", activeJobStatuses)
      .not("assigned_driver_id", "is", null),
  ]);
  if (driversResult.error) throw driversResult.error;
  if (jobsResult.error) throw jobsResult.error;

  const counts = new Map<string, number>();
  for (const j of jobsResult.data ?? []) {
    if (!j.assigned_driver_id) continue;
    counts.set(j.assigned_driver_id, (counts.get(j.assigned_driver_id) ?? 0) + 1);
  }

  return ((driversResult.data ?? []) as Omit<DriverWorkload, "activeJobCount">[])
    .map((d) => ({ ...d, activeJobCount: counts.get(d.id) ?? 0 }))
    .sort((a, b) => a.activeJobCount - b.activeJobCount);
}

export type UnassignedJob = {
  id: string;
  request_number: string;
  animal_name: string | null;
  pickup_city: string | null;
  destination_city: string | null;
  earliest_date: string | null;
};

// Ready to go but nobody's actually driving it yet — the queue a dispatcher works through.
export async function listUnassignedReadyJobs(): Promise<UnassignedJob[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_requests")
    .select("id, request_number, animal_name, pickup_city, destination_city, earliest_date")
    .eq("status", "ready_for_scheduling")
    .is("assigned_driver_id", null)
    .order("earliest_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as UnassignedJob[];
}

export async function assignDriverToJob(input: { transportRequestId: string; driverId: string }) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("assign_driver_to_job", {
    p_transport_request_id: input.transportRequestId,
    p_driver_id: input.driverId,
  });
  if (error) throw error;
}
