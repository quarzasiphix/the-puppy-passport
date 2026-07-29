import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export type PricingInputs = {
  pickupCountry: string;
  destinationCountry: string;
  sizeCategory: "small" | "medium" | "large" | "giant";
  serviceType: "shared" | "individual" | "express" | "vip" | "recommend_best";
  urgent?: boolean;
};

export type PricingBreakdown = {
  baseFee: number;
  distanceBand: string;
  distanceFee: number;
  sizeAdjustmentPct: number;
  serviceAdjustmentPct: number;
  urgentFee: number;
  low: number;
  high: number;
  currency: string;
  complete: boolean;
};

// Distance is approximated from country pairs only — no real routing distance without a mapping
// provider (a later integration). Never presented as an exact figure.
function approximateDistanceBand(pickupCountry: string, destinationCountry: string): string {
  if (!pickupCountry || !destinationCountry) return "300-800";
  if (pickupCountry.toLowerCase() === destinationCountry.toLowerCase()) return "0-300";
  return "300-800";
}

export async function calculateEstimate(inputs: PricingInputs): Promise<PricingBreakdown> {
  const supabase = getSupabaseBrowserClient();
  const { data: rules, error } = await supabase
    .from("pricing_rules")
    .select("*")
    .eq("active", true);
  if (error) throw error;

  const currency = rules?.[0]?.currency ?? "EUR";
  const find = (type: string, appliesTo: string | null) =>
    rules?.find((r) => r.rule_type === type && r.applies_to === appliesTo);

  const baseFee = find("base_fee", null)?.amount ?? 100;
  const distanceBand = approximateDistanceBand(inputs.pickupCountry, inputs.destinationCountry);
  const distanceFee = find("distance_band", distanceBand)?.amount ?? 150;
  const sizeAdjustmentPct = find("size_multiplier", inputs.sizeCategory)?.amount ?? 0;
  const serviceAdjustmentPct = find("service_multiplier", inputs.serviceType)?.amount ?? 0;
  const urgentFee = inputs.urgent ? (find("urgent_planning", null)?.amount ?? 0) : 0;

  const subtotal = baseFee + distanceFee + urgentFee;
  const adjusted = subtotal * (1 + (sizeAdjustmentPct + serviceAdjustmentPct) / 100);

  return {
    baseFee,
    distanceBand,
    distanceFee,
    sizeAdjustmentPct,
    serviceAdjustmentPct,
    urgentFee,
    low: Math.round(adjusted * 0.85),
    high: Math.round(adjusted * 1.25),
    currency,
    complete: !!rules && rules.length > 0,
  };
}
