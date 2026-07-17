import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// Ops/admin-only queries — protected by RLS (public.is_ops_staff()) on every table touched here,
// not by anything in this file. A customer or breeder calling these gets an empty/error result
// from Postgres regardless of what the UI does.

const listColumns =
  "id, request_number, animal_name, size_category, requester_profile_id, pickup_country, pickup_city, destination_country, destination_city, earliest_date, latest_date, flexible_dates, requested_service_type, status, compliance_review_result, assigned_route_id, assigned_driver_id, created_at";

export type OpsRequestListRow = {
  id: string;
  request_number: string;
  animal_name: string | null;
  size_category: string | null;
  requester_profile_id: string;
  pickup_country: string | null;
  pickup_city: string | null;
  destination_country: string | null;
  destination_city: string | null;
  earliest_date: string | null;
  latest_date: string | null;
  flexible_dates: boolean;
  requested_service_type: string;
  status: string;
  compliance_review_result: string;
  assigned_route_id: string | null;
  assigned_driver_id: string | null;
  created_at: string;
};

export async function listOpsTransportRequests(filter?: { status?: string; serviceType?: string }) {
  const supabase = getSupabaseBrowserClient();
  let query = supabase
    .from("transport_requests")
    .select(listColumns)
    .order("created_at", { ascending: false });
  if (filter?.status) query = query.eq("status", filter.status);
  if (filter?.serviceType) {
    query = query.eq(
      "requested_service_type",
      filter.serviceType as "shared" | "individual" | "express" | "vip" | "recommend_best",
    );
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as OpsRequestListRow[];
}

export async function getOpsKpiCounts() {
  const supabase = getSupabaseBrowserClient();
  const countFor = (statuses: string[]) =>
    supabase
      .from("transport_requests")
      .select("*", { count: "exact", head: true })
      .in("status", statuses);

  const [
    newReq,
    awaitingReview,
    missingInfo,
    docsReview,
    quoteToPrepare,
    quoteAwaiting,
    readyScheduling,
    scheduled,
    active,
    complianceHold,
  ] = await Promise.all([
    countFor(["submitted"]),
    countFor(["initial_review"]),
    countFor(["missing_information"]),
    countFor(["documents_under_review"]),
    countFor(["quotation_prepared"]),
    countFor(["quotation_sent"]),
    countFor(["ready_for_scheduling"]),
    countFor(["scheduled", "driver_assigned", "pickup_confirmed"]),
    countFor(["animal_collected", "in_transport", "rest_or_care_stop", "approaching_destination"]),
    countFor(["compliance_hold", "veterinary_hold"]),
  ]);

  return {
    newRequests: newReq.count ?? 0,
    awaitingReview: awaitingReview.count ?? 0,
    missingInformation: missingInfo.count ?? 0,
    documentsUnderReview: docsReview.count ?? 0,
    quotationsToPrepare: quoteToPrepare.count ?? 0,
    quotationsAwaitingResponse: quoteAwaiting.count ?? 0,
    readyForScheduling: readyScheduling.count ?? 0,
    scheduled: scheduled.count ?? 0,
    active: active.count ?? 0,
    complianceHolds: complianceHold.count ?? 0,
  };
}

export async function getOpsRequestDetail(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_requests")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function listOpsStatusHistory(transportRequestId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_status_history")
    .select("id, status, changed_at, changed_by, internal_note, customer_note")
    .eq("transport_request_id", transportRequestId)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listOpsDocuments(transportRequestId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_documents")
    .select("id, category, status, file_url, notes, created_at")
    .eq("transport_request_id", transportRequestId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Every status change goes through here: updates the request, writes a status_history row, and
// an audit_logs row — "every important status change needs an audit history."
export async function changeOpsRequestStatus(input: {
  id: string;
  newStatus: string;
  actorId: string;
  customerNote?: string;
  internalNote?: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const { data: before } = await supabase
    .from("transport_requests")
    .select("status")
    .eq("id", input.id)
    .single();

  const { error: updateError } = await supabase
    .from("transport_requests")
    .update({ status: input.newStatus })
    .eq("id", input.id);
  if (updateError) throw updateError;

  const { error: historyError } = await supabase.from("transport_status_history").insert({
    transport_request_id: input.id,
    status: input.newStatus,
    changed_by: input.actorId,
    customer_note: input.customerNote || null,
    internal_note: input.internalNote || null,
  });
  if (historyError) throw historyError;

  await supabase.from("audit_logs").insert({
    actor_profile_id: input.actorId,
    action: "transport_request.status_changed",
    target_type: "transport_requests",
    target_id: input.id,
    before: before ?? null,
    after: { status: input.newStatus },
  });
}

export type OpsQuotationRow = {
  id: string;
  transport_request_id: string;
  service_type: string;
  base_price: number | null;
  total_price: number | null;
  currency: string;
  expiry_date: string | null;
  status: string;
  created_at: string;
  transport_requests: { request_number: string; animal_name: string | null } | null;
};

export async function listOpsQuotations() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("quotations")
    .select(
      "id, transport_request_id, service_type, base_price, total_price, currency, expiry_date, status, created_at, transport_requests(request_number, animal_name)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OpsQuotationRow[];
}

// Requests that don't already have a live (non-closed) quotation — the pool an ops staffer picks
// from when preparing a new one.
export async function listRequestsNeedingQuotation() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_requests")
    .select(
      "id, request_number, animal_name, requested_service_type, pickup_city, destination_city",
    )
    .in("status", ["quotation_prepared", "ready_for_scheduling", "initial_review", "submitted"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createQuotation(input: {
  transportRequestId: string;
  serviceType: string;
  basePrice: number;
  totalPrice: number;
  currency: string;
  expiryDate: string | null;
  createdBy: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("quotations").insert({
    transport_request_id: input.transportRequestId,
    service_type: input.serviceType,
    base_price: input.basePrice,
    total_price: input.totalPrice,
    currency: input.currency,
    expiry_date: input.expiryDate,
    status: "draft",
    created_by: input.createdBy,
  });
  if (error) throw error;
}

export async function sendQuotation(id: string, transportRequestId: string, actorId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("quotations").update({ status: "sent" }).eq("id", id);
  if (error) throw error;
  await supabase
    .from("transport_requests")
    .update({ status: "quotation_sent" })
    .eq("id", transportRequestId);
  await supabase.from("transport_status_history").insert({
    transport_request_id: transportRequestId,
    status: "quotation_sent",
    changed_by: actorId,
    customer_note: "A quotation is ready for you to review.",
  });
}
