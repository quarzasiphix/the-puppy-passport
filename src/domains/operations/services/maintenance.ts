import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";

// Stage BZ: maintenance mode. app_maintenance_mode (20260101011000_maintenance_mode.sql) is a
// single always-exactly-one-row settings table; src/server.ts's Worker fetch handler reads it
// directly (cached briefly) to decide whether to serve the real app or a maintenance page. This
// file is the admin-facing read/write side, matching the existing markets.ts pattern.

export type MaintenanceModeRow = Database["public"]["Tables"]["app_maintenance_mode"]["Row"];

export async function getMaintenanceMode() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("app_maintenance_mode")
    .select("*")
    .eq("id", true)
    .single();
  if (error) throw error;
  return data as MaintenanceModeRow;
}

export async function setMaintenanceMode(enabled: boolean, message?: string) {
  const supabase = getSupabaseBrowserClient();
  const update: { enabled: boolean; message?: string } = { enabled };
  if (message !== undefined) update.message = message;
  const { error } = await supabase.from("app_maintenance_mode").update(update).eq("id", true);
  if (error) throw error;
}
