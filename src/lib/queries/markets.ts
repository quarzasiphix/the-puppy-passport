import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";

// Stage I: platform settings. markets (20260101005800_markets.sql) was schema-only — real,
// RLS-correct, seeded with Poland/Germany/Netherlands/Belgium, but confirmed by
// `grep -rln '"markets"' src/lib src/routes` to have zero UI anywhere. "admins manage all markets"
// RLS already existed; only the admin page was missing.

export type MarketRow = Database["public"]["Tables"]["markets"]["Row"];

export async function listMarketsForAdmin() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("markets")
    .select("*")
    .order("display_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MarketRow[];
}

export async function setMarketEnabled(id: string, enabled: boolean) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("markets").update({ enabled }).eq("id", id);
  if (error) throw error;
}
