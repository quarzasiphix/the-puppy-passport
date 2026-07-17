import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";

export type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];
export type DriverRow = Database["public"]["Tables"]["drivers"]["Row"];

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

// "Warnings for expired documents / upcoming expiry / service due" — a date within this many days
// counts as "upcoming", already past counts as "expired".
const UPCOMING_WINDOW_DAYS = 30;

export type ExpiryWarning = { label: string; severity: "expired" | "upcoming" };

export function expiryWarnings(date: string | null, label: string): ExpiryWarning[] {
  if (!date) return [];
  const days = (new Date(date).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return [{ label: `${label} expired`, severity: "expired" }];
  if (days <= UPCOMING_WINDOW_DAYS) return [{ label: `${label} expires soon`, severity: "upcoming" }];
  return [];
}
