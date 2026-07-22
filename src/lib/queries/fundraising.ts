import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";

export type FundraisingCampaignRow = Database["public"]["Tables"]["fundraising_campaigns"]["Row"];
export type FundraisingContributionRow =
  Database["public"]["Tables"]["fundraising_contributions"]["Row"];

// Plain-language labels — never show a raw status enum value to an organisation or a supporter
// (see CLAUDE.md's UX principle).
export const campaignStatusLabels: Record<FundraisingCampaignRow["status"], string> = {
  draft: "Draft — not submitted for review yet",
  organisation_review: "Submitted — awaiting your final review before admin approval",
  approved: "Approved — ready to go live",
  active: "Active — accepting support",
  target_reached: "Target reached",
  partially_funded: "Deadline passed — partially funded",
  expired: "Expired",
  transport_cancelled: "Transport cancelled",
  suspended: "Suspended",
  completed: "Completed — funds applied to transport",
  refund_review: "Under refund review",
};

export type CampaignSummary = {
  id: string;
  title: string;
  description: string | null;
  targetAmount: number;
  currency: string;
  deadline: string | null;
  status: FundraisingCampaignRow["status"];
  organisationName: string;
  animalName: string;
  pickupCountry: string | null;
  destinationCountry: string | null;
  amountCollected: number;
};

type CampaignJoinRow = FundraisingCampaignRow & {
  organisations: { name: string } | null;
  animals: { name: string } | null;
};

// Deliberately does NOT embed transport_requests directly: anon (and most authenticated callers)
// have no SELECT grant on that table at all, so a PostgREST resource embed across that FK fails
// outright with "permission denied for table transport_requests" — reproduced against the real
// local API before this fix. The route is genuinely safe to show ("approximate transport route",
// per docs/FUNDRAISING_POLICY.md) via the existing public_transport_requests view instead, fetched
// as a separate query and merged in code — that view already returns nothing (not an error) for a
// non-community-visible request, which is the correct privacy-respecting fallback.
const campaignSelect = "*, organisations(name), animals(name)";

async function withAmountCollected(rows: CampaignJoinRow[]): Promise<CampaignSummary[]> {
  const supabase = getSupabaseBrowserClient();
  const ids = rows.map((r) => r.id);
  const amounts = new Map<string, number>();
  const routeByRequestId = new Map<
    string,
    { pickup_country: string | null; destination_country: string | null }
  >();
  if (ids.length) {
    // Computed via aggregation, not a stored counter — same convention as litters' puppy count
    // (see docs/DECISIONS.md). Reads the public_fundraising_totals view (not the raw
    // fundraising_contributions table) so this works identically for anon, a supporter, an org
    // owner or an admin — anon has no grant on the raw table at all, and the view's total counts
    // anonymous (display_publicly = false) contributions too, unlike the per-row public view
    // (anonymity hides attribution, not the money, from "target reached").
    const { data, error } = await supabase
      .from("public_fundraising_totals")
      .select("campaign_id, total_collected")
      .in("campaign_id", ids);
    if (error) throw error;
    for (const row of data ?? []) {
      amounts.set(row.campaign_id, Number(row.total_collected));
    }

    const requestIds = rows.map((r) => r.transport_request_id);
    const { data: routes, error: routesError } = await supabase
      .from("public_transport_requests")
      .select("id, pickup_country, destination_country")
      .in("id", requestIds);
    if (routesError) throw routesError;
    for (const route of routes ?? []) {
      routeByRequestId.set(route.id, route);
    }
  }
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    targetAmount: Number(r.target_amount),
    currency: r.currency,
    deadline: r.deadline,
    status: r.status,
    organisationName: r.organisations?.name ?? "Havenpaw organisation",
    animalName: r.animals?.name ?? "Animal",
    pickupCountry: routeByRequestId.get(r.transport_request_id)?.pickup_country ?? null,
    destinationCountry: routeByRequestId.get(r.transport_request_id)?.destination_country ?? null,
    amountCollected: amounts.get(r.id) ?? 0,
  }));
}

export async function listPublicCampaigns(): Promise<CampaignSummary[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("fundraising_campaigns")
    .select(campaignSelect)
    .in("status", ["active", "target_reached", "partially_funded", "completed"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return withAmountCollected((data ?? []) as unknown as CampaignJoinRow[]);
}

export async function getPublicCampaign(id: string): Promise<CampaignSummary | null> {
  const rows = await listPublicCampaigns();
  return rows.find((r) => r.id === id) ?? null;
}

export async function listCampaignsForOrg(orgId: string): Promise<CampaignSummary[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("fundraising_campaigns")
    .select(campaignSelect)
    .eq("organisation_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return withAmountCollected((data ?? []) as unknown as CampaignJoinRow[]);
}

export async function listCampaignsForReview(): Promise<CampaignSummary[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("fundraising_campaigns")
    .select(campaignSelect)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return withAmountCollected((data ?? []) as unknown as CampaignJoinRow[]);
}

// Only what the organisation itself needs to check before creating a campaign: an accepted
// quotation on one of their own animals' transport requests, with a real adoption/rehoming
// application and no existing non-terminal campaign already against it.
export type EligibleQuotationOption = {
  quotationId: string;
  transportRequestId: string;
  animalId: string;
  animalName: string;
  buyerApplicationId: string;
  totalPrice: number | null;
  currency: string;
};

export async function listEligibleQuotationsForOrg(
  orgId: string,
): Promise<EligibleQuotationOption[]> {
  const supabase = getSupabaseBrowserClient();
  const { data: animals, error: animalsError } = await supabase
    .from("animals")
    .select("id, name")
    .eq("organization_id", orgId);
  if (animalsError) throw animalsError;
  const animalIds = (animals ?? []).map((a) => a.id);
  if (!animalIds.length) return [];

  const { data: applications, error: applicationsError } = await supabase
    .from("buyer_applications")
    .select("id, animal_id")
    .in("animal_id", animalIds)
    .in("application_type", ["adoption", "rehoming_inquiry"]);
  if (applicationsError) throw applicationsError;
  const applicationByAnimal = new Map(applications?.map((a) => [a.animal_id, a.id]));

  const { data: requests, error: requestsError } = await supabase
    .from("transport_requests")
    .select("id, animal_id")
    .in("animal_id", animalIds);
  if (requestsError) throw requestsError;
  const requestsByAnimal = new Map<string, string[]>();
  for (const r of requests ?? []) {
    if (!r.animal_id) continue;
    requestsByAnimal.set(r.animal_id, [...(requestsByAnimal.get(r.animal_id) ?? []), r.id]);
  }

  const allRequestIds = (requests ?? []).map((r) => r.id);
  if (!allRequestIds.length) return [];

  const { data: quotations, error: quotationsError } = await supabase
    .from("quotations")
    .select("id, transport_request_id, total_price, currency")
    .in("transport_request_id", allRequestIds)
    .eq("status", "accepted");
  if (quotationsError) throw quotationsError;

  const { data: existingCampaigns, error: campaignsError } = await supabase
    .from("fundraising_campaigns")
    .select("quotation_id, status")
    .eq("organisation_id", orgId);
  if (campaignsError) throw campaignsError;
  const takenQuotationIds = new Set(
    (existingCampaigns ?? [])
      .filter(
        (c) => !["expired", "transport_cancelled", "suspended", "completed"].includes(c.status),
      )
      .map((c) => c.quotation_id),
  );

  const animalNameById = new Map(animals?.map((a) => [a.id, a.name]));
  const requestToAnimal = new Map<string, string>();
  for (const [animalId, reqIds] of requestsByAnimal) {
    for (const reqId of reqIds) requestToAnimal.set(reqId, animalId);
  }

  const options: EligibleQuotationOption[] = [];
  for (const q of quotations ?? []) {
    const animalId = requestToAnimal.get(q.transport_request_id);
    if (!animalId) continue;
    const buyerApplicationId = applicationByAnimal.get(animalId);
    if (!buyerApplicationId) continue;
    if (takenQuotationIds.has(q.id)) continue;
    options.push({
      quotationId: q.id,
      transportRequestId: q.transport_request_id,
      animalId,
      animalName: animalNameById.get(animalId) ?? "Animal",
      buyerApplicationId,
      totalPrice: q.total_price,
      currency: q.currency,
    });
  }
  return options;
}

export async function createCampaign(payload: {
  organisationId: string;
  option: EligibleQuotationOption;
  title: string;
  description?: string;
  deadline?: string | null;
}) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("fundraising_campaigns").insert({
    organisation_id: payload.organisationId,
    animal_id: payload.option.animalId,
    buyer_application_id: payload.option.buyerApplicationId,
    transport_request_id: payload.option.transportRequestId,
    quotation_id: payload.option.quotationId,
    title: payload.title,
    description: payload.description ?? null,
    target_amount: payload.option.totalPrice ?? 0,
    currency: payload.option.currency,
    deadline: payload.deadline ?? null,
    status: "draft",
  });
  if (error) throw error;
}

export async function submitCampaignForReview(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("fundraising_campaigns")
    .update({ status: "organisation_review" })
    .eq("id", id);
  if (error) throw error;
}

export async function approveCampaign(id: string, adminId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("fundraising_campaigns")
    .update({ status: "approved", reviewed_by: adminId, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function activateCampaign(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("fundraising_campaigns")
    .update({ status: "active" })
    .eq("id", id);
  if (error) throw error;
}

export async function suspendCampaign(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("fundraising_campaigns")
    .update({ status: "suspended" })
    .eq("id", id);
  if (error) throw error;
}

export type PublicContributionRow = {
  id: string;
  amount: number;
  currency: string;
  public_message: string | null;
  created_at: string;
};

export async function listPublicContributions(
  campaignId: string,
): Promise<PublicContributionRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("public_fundraising_contributions")
    .select("id, amount, currency, public_message, created_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Development-only simulated contribution — is_simulated defaults to true at the database level
// and any other value is rejected by RLS (see 20260101005600_fundraising.sql). There is no real
// payment provider integrated; this never actually moves money.
export async function contributeSimulated(payload: {
  campaignId: string;
  supporterId: string;
  amount: number;
  currency: string;
  displayPublicly: boolean;
  publicMessage?: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("fundraising_contributions").insert({
    campaign_id: payload.campaignId,
    supporter_profile_id: payload.supporterId,
    amount: payload.amount,
    currency: payload.currency,
    display_publicly: payload.displayPublicly,
    public_message: payload.publicMessage ?? null,
    payment_status: "completed",
    is_simulated: true,
  });
  if (error) throw error;
}
