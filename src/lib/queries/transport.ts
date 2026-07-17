import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";

export type TransportRequestRow = Database["public"]["Tables"]["transport_requests"]["Row"];
export type TransportRequestInsert = Database["public"]["Tables"]["transport_requests"]["Insert"];
export type TransportStatusHistoryRow =
  Database["public"]["Tables"]["transport_status_history"]["Row"];

// A simple, clearly-labelled starting classification — never a final legal/compliance decision.
// Ops staff review every request regardless of this result; it only routes initial handling.
export function classifyComplianceResult(input: {
  isDomestic: boolean | null;
  isSale: boolean;
  isOwnershipChange: boolean;
  hasMicrochip: boolean | null;
  hasPassport: boolean | null;
  medicallyFitForTransport: boolean | null;
  healthCertificateRequired: boolean;
}): TransportRequestRow["compliance_review_result"] {
  if (input.medicallyFitForTransport === false) return "veterinary_review_required";
  if (input.isDomestic === false && (!input.hasMicrochip || !input.hasPassport))
    return "documents_missing";
  if (input.isDomestic === false && (input.isSale || input.isOwnershipChange))
    return "international_commercial_review";
  if (input.healthCertificateRequired && input.isDomestic === false)
    return "veterinary_review_required";
  if (input.isDomestic === false) return "basic_review_required";
  return "eligible_for_quotation";
}

export async function createTransportRequest(payload: TransportRequestInsert) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_requests")
    .insert(payload)
    .select("id, request_number, status")
    .single();
  if (error) throw error;

  const { error: historyError } = await supabase.from("transport_status_history").insert({
    transport_request_id: data.id,
    status: data.status,
    changed_by: payload.requester_profile_id,
    customer_note: "Request submitted.",
  });
  if (historyError) throw historyError;

  return data;
}

// Drafts are just transport_requests rows with status='draft' — "save progress automatically,
// resume later" doesn't need a second table, only a status the row can sit in indefinitely.
export async function saveDraft(payload: TransportRequestInsert & { id?: string }) {
  const supabase = getSupabaseBrowserClient();
  const row = { ...payload, status: "draft" as const };
  if (payload.id) {
    const { data, error } = await supabase
      .from("transport_requests")
      .update(row)
      .eq("id", payload.id)
      .select("id")
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from("transport_requests")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function listMyDrafts(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_requests")
    .select("id, animal_name, pickup_city, destination_city, updated_at")
    .eq("requester_profile_id", userId)
    .eq("status", "draft")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data as Pick<
    TransportRequestRow,
    "id" | "animal_name" | "pickup_city" | "destination_city" | "updated_at"
  >[];
}

export async function deleteDraft(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("transport_requests")
    .delete()
    .eq("id", id)
    .eq("status", "draft");
  if (error) throw error;
}

// A simple, clearly-indicative price band by service type — not a real pricing engine (that's a
// later phase, see docs/IMPLEMENTATION_PLAN.md). Always shown with "estimate, subject to review"
// framing, never as a guaranteed price.
const priceBandByService: Record<string, [number, number]> = {
  shared: [180, 380],
  individual: [320, 650],
  express: [450, 900],
  vip: [600, 1200],
  recommend_best: [200, 700],
};
export function estimatePriceRange(serviceType: string): [number, number] {
  return priceBandByService[serviceType] ?? priceBandByService.recommend_best;
}

// Looks for a planned/confirmed route whose destination touches the requested country — a coarse
// heuristic, not a real match (the deterministic matching engine is a later phase). Only ever used
// to show "a route may already be heading that way", never to promise a place on it.
export async function findLikelyRouteMatch(destinationCountry: string | null) {
  if (!destinationCountry) return null;
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("routes")
    .select("id, route_name, departure_date, destination_countries, status")
    .in("status", ["planning", "confirmed"])
    .contains("destination_countries", [destinationCountry])
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Coarse duplicate-request guard: is there already an open (non-cancelled/rejected) transport
// request from this customer for this exact animal? Shown as a warning, never a hard block — the
// customer may genuinely need a second request (e.g. a previous one was withdrawn informally).
export async function findActiveTransportRequestForAnimal(userId: string, animalId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_requests")
    .select("id, request_number, status")
    .eq("requester_profile_id", userId)
    .eq("animal_id", animalId)
    .not("status", "in", "(rejected,cancelled_by_customer,cancelled_by_operations,draft)")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Transport requests linked (via animal_id) to puppies from this kennel — lets a breeder see
// scheduled pickups and missing documents for animals they've sold, regardless of who submitted
// the request (buyer or breeder).
export async function listTransportRequestsForKennel(orgId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_requests")
    .select(
      "id, request_number, animal_name, pickup_city, destination_city, requested_service_type, status, earliest_date, created_at, animals!inner(organization_id, name)",
    )
    .eq("animals.organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as (Pick<
    TransportRequestRow,
    | "id"
    | "request_number"
    | "animal_name"
    | "pickup_city"
    | "destination_city"
    | "requested_service_type"
    | "status"
    | "earliest_date"
    | "created_at"
  > & { animals: { organization_id: string; name: string } | null })[];
}

export async function listMyTransportRequests(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_requests")
    .select(
      "id, request_number, request_purpose, pickup_country, pickup_city, destination_country, destination_city, requested_service_type, status, earliest_date, created_at",
    )
    .eq("requester_profile_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Pick<
    TransportRequestRow,
    | "id"
    | "request_number"
    | "request_purpose"
    | "pickup_country"
    | "pickup_city"
    | "destination_country"
    | "destination_city"
    | "requested_service_type"
    | "status"
    | "earliest_date"
    | "created_at"
  >[];
}

export async function getTransportRequest(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_requests")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as TransportRequestRow;
}

export async function listTransportStatusHistory(transportRequestId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_status_history")
    .select("id, status, changed_at, customer_note")
    .eq("transport_request_id", transportRequestId)
    .order("changed_at", { ascending: true });
  if (error) throw error;
  return data as Pick<
    TransportStatusHistoryRow,
    "id" | "status" | "changed_at" | "customer_note"
  >[];
}

// A simplified, plain-language customer journey standing in for the ~24-state internal
// operational enum — a customer should never see a raw internal code (compliance-review value,
// route-assignment id, etc.) without this kind of translation. True exceptions (holds) are shown
// as a distinct warning banner instead of a step, since they're off the normal happy path;
// "information or documents needed" is deliberately kept as a real step, not a hold, since it's
// an expected, common part of the journey.
export const transportMilestones = [
  "Request sent",
  "We are reviewing the details",
  "Information or documents needed",
  "Price proposal ready",
  "Transport accepted",
  "Planning the route",
  "Transport scheduled",
  "Animal collected",
  "In transport",
  "Approaching destination",
  "Delivered",
  "Handover completed",
] as const;

const milestoneByStatus: Record<string, number> = {
  draft: -1,
  submitted: 0,
  initial_review: 1,
  missing_information: 2,
  documents_under_review: 1,
  awaiting_documents: 2,
  quotation_prepared: 3,
  quotation_sent: 3,
  accepted_by_customer: 4,
  ready_for_scheduling: 5,
  scheduled: 6,
  driver_assigned: 6,
  pickup_confirmed: 6,
  animal_collected: 7,
  in_transport: 8,
  rest_or_care_stop: 8,
  approaching_destination: 9,
  delivered: 10,
  handover_confirmed: 11,
  completed: 11,
};

// Exceptional, off-the-happy-path states — shown as a warning banner rather than a step in the
// linear journey above.
const holdStatuses = new Set(["veterinary_hold", "compliance_hold", "route_postponed"]);
const closedStatuses = new Set(["rejected", "cancelled_by_customer", "cancelled_by_operations"]);

export function milestoneIndexForStatus(status: string): number | null {
  if (holdStatuses.has(status) || closedStatuses.has(status)) return null;
  return milestoneByStatus[status] ?? 0;
}

export function isOnHold(status: string) {
  return holdStatuses.has(status);
}

export function isClosed(status: string) {
  return closedStatuses.has(status);
}

// "Next action" copy for the customer dashboard — mirrors the brief's example wording
// ("Upload the passport", "Confirm the quotation", ...) based on current status.
export function nextActionForStatus(status: string): string {
  switch (status) {
    case "draft":
      return "Finish and submit your request.";
    case "submitted":
    case "initial_review":
      return "We're reviewing your request — no action needed yet.";
    case "missing_information":
      return "Additional information is needed — check the notes below.";
    case "documents_under_review":
      return "Your documents are being reviewed.";
    case "quotation_prepared":
      return "A quotation is being prepared.";
    case "quotation_sent":
      return "Review and accept your quotation.";
    case "accepted_by_customer":
      return "Quotation accepted — awaiting document confirmation.";
    case "awaiting_documents":
      return "Upload the remaining required documents.";
    case "ready_for_scheduling":
      return "Your request is ready — awaiting a scheduled route.";
    case "scheduled":
      return "Transport is scheduled — watch for pickup details.";
    case "driver_assigned":
      return "A driver has been assigned.";
    case "pickup_confirmed":
      return "Pickup confirmed.";
    case "animal_collected":
      return "The animal has been collected.";
    case "in_transport":
      return "In transport — status updates will follow.";
    case "rest_or_care_stop":
      return "On a planned rest stop.";
    case "approaching_destination":
      return "Approaching the destination.";
    case "delivered":
      return "Delivered — confirm handover.";
    case "handover_confirmed":
      return "Handover confirmed.";
    case "completed":
      return "Completed.";
    case "veterinary_hold":
      return "On hold pending a veterinary document review.";
    case "compliance_hold":
      return "On hold pending a compliance review.";
    case "route_postponed":
      return "The planned route has been postponed — we'll be in touch.";
    case "rejected":
      return "This request was not accepted.";
    case "cancelled_by_customer":
    case "cancelled_by_operations":
      return "This request was cancelled.";
    default:
      return "No action needed right now.";
  }
}

export type TransportDocumentRow = Database["public"]["Tables"]["transport_documents"]["Row"];

// A plain-language label for each internal document category — never show the raw enum value to
// a customer (same rule as transport status).
export const documentCategoryLabels: Record<string, string> = {
  passport: "Pet passport",
  microchip_confirmation: "Microchip confirmation",
  vaccination_information: "Vaccination record",
  rabies_vaccination: "Rabies vaccination certificate",
  health_certificate: "Health certificate",
  veterinary_examination: "Veterinary examination report",
  traces_reference: "TRACES reference number",
  breeder_documentation: "Breeder documentation",
  foundation_documentation: "Foundation documentation",
  ownership_declaration: "Ownership declaration",
  sale_agreement: "Sale agreement",
  adoption_agreement: "Adoption agreement",
  transport_authorisation: "Transport authorisation",
  pickup_authorisation: "Pickup authorisation",
  handover_protocol: "Handover protocol",
  other: "Other document",
};

export async function listMyDocuments(transportRequestId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_documents")
    .select("id, category, file_url, status, notes, expiry_date, created_at")
    .eq("transport_request_id", transportRequestId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Pick<
    TransportDocumentRow,
    "id" | "category" | "file_url" | "status" | "notes" | "expiry_date" | "created_at"
  >[];
}

export async function submitDocument(input: {
  transportRequestId: string;
  category: string;
  fileUrl: string;
  expiryDate: string | null;
  uploadedBy: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("transport_documents").insert({
    transport_request_id: input.transportRequestId,
    category: input.category,
    file_url: input.fileUrl,
    expiry_date: input.expiryDate,
    uploaded_by: input.uploadedBy,
    status: "uploaded",
  });
  if (error) throw error;
}

// A document counts as "nearing expiry" the same way vehicle/driver documents do elsewhere in the
// ops tooling (see expiryWarnings() in src/lib/queries/fleet.ts) — within 30 days counts as
// upcoming, already past counts as expired.
const UPCOMING_WINDOW_DAYS = 30;

export function documentExpiryWarning(expiryDate: string | null): "expired" | "upcoming" | null {
  if (!expiryDate) return null;
  const days = (new Date(expiryDate).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return "expired";
  if (days <= UPCOMING_WINDOW_DAYS) return "upcoming";
  return null;
}

export async function reviewDocument(
  id: string,
  status: "accepted" | "rejected",
  reviewedBy: string,
  notes?: string,
) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("transport_documents")
    .update({ status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(), notes })
    .eq("id", id);
  if (error) throw error;
}

export type MyQuotationRow = {
  id: string;
  transport_request_id: string;
  service_type: string;
  base_price: number | null;
  total_price: number | null;
  currency: string;
  expiry_date: string | null;
  assumptions: string | null;
  status: string;
  created_at: string;
  transport_requests: { request_number: string; animal_name: string | null } | null;
};

// Only ever sees non-draft quotations, per RLS — a draft is ops-internal until sent.
export async function listMyQuotations(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("quotations")
    .select(
      "id, transport_request_id, service_type, base_price, total_price, currency, expiry_date, assumptions, status, created_at, transport_requests!inner(request_number, animal_name, requester_profile_id)",
    )
    .eq("transport_requests.requester_profile_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as MyQuotationRow[];
}

export async function respondToQuotation(
  id: string,
  transportRequestId: string,
  response: "accepted" | "rejected",
  userId: string,
) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("quotations").update({ status: response }).eq("id", id);
  if (error) throw error;

  if (response === "accepted") {
    await supabase
      .from("transport_requests")
      .update({ status: "accepted_by_customer" })
      .eq("id", transportRequestId);
    await supabase.from("transport_status_history").insert({
      transport_request_id: transportRequestId,
      status: "accepted_by_customer",
      changed_by: userId,
      customer_note: "Quotation accepted.",
    });
  }
}

// A completed transport can be reviewed once — matches transport_reviews' unique constraint on
// transport_request_id.
export const reviewableStatuses = new Set(["delivered", "handover_confirmed", "completed"]);

export async function getMyReview(transportRequestId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_reviews")
    .select("id, rating, driver_rating, would_recommend, comment")
    .eq("transport_request_id", transportRequestId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function submitReview(input: {
  transportRequestId: string;
  reviewerProfileId: string;
  rating: number;
  driverRating: number | null;
  wouldRecommend: boolean | null;
  comment: string | null;
}) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("transport_reviews").insert({
    transport_request_id: input.transportRequestId,
    reviewer_profile_id: input.reviewerProfileId,
    rating: input.rating,
    driver_rating: input.driverRating,
    would_recommend: input.wouldRecommend,
    comment: input.comment,
  });
  if (error) throw error;
}

export async function getPublicTransportRating() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("public_transport_rating").select("*").maybeSingle();
  if (error) throw error;
  return data;
}
