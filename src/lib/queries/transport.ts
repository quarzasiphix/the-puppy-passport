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

// Same lookup as findActiveTransportRequestForAnimal, batched for a list of animals — used by the
// reservations page so a buyer who already submitted a transport request sees its real status
// instead of the "Request transport" button appearing to have done nothing.
export async function findActiveTransportRequestsForAnimals(
  userId: string,
  animalIds: string[],
): Promise<Map<string, { id: string; request_number: string | null; status: string }>> {
  if (!animalIds.length) return new Map();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_requests")
    .select("id, request_number, status, animal_id")
    .eq("requester_profile_id", userId)
    .in("animal_id", animalIds)
    .not("status", "in", "(rejected,cancelled_by_customer,cancelled_by_operations,draft)");
  if (error) throw error;
  const byAnimal = new Map<string, { id: string; request_number: string | null; status: string }>();
  for (const row of data ?? []) {
    if (row.animal_id) byAnimal.set(row.animal_id, row);
  }
  return byAnimal;
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

// docs/adr/TRANSPORT_DATA_MODEL.md Phase 9: transport_documents.file_url historically held whatever
// URL a user typed into a text box — no real Storage upload despite the `transport-documents`
// bucket (20260101002200_storage.sql) already being private and RLS-correct, confirmed by
// `grep -rln "storage.*upload" src/` finding zero real upload call sites anywhere in the app. This
// uploads the real file and stores its private object path (never a public URL — the bucket has no
// public-read policy, only requester/ops/assigned-driver, so the stored value is only ever useful
// through getSignedDocumentUrl() below, which is exactly the point).
const TRANSPORT_DOCUMENTS_BUCKET = "transport-documents";

function sanitizeFilenameForStoragePath(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function submitDocument(input: {
  transportRequestId: string;
  category: string;
  file: File;
  expiryDate: string | null;
  uploadedBy: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const objectPath = `${input.transportRequestId}/${input.category}-${Date.now()}-${sanitizeFilenameForStoragePath(input.file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(TRANSPORT_DOCUMENTS_BUCKET)
    .upload(objectPath, input.file, { contentType: input.file.type || undefined });
  if (uploadError) throw uploadError;

  const { error } = await supabase.from("transport_documents").insert({
    transport_request_id: input.transportRequestId,
    category: input.category,
    file_url: objectPath,
    expiry_date: input.expiryDate,
    uploaded_by: input.uploadedBy,
    status: "uploaded",
  });
  if (error) {
    // Best-effort cleanup so a failed row insert doesn't leave an orphan Storage object behind —
    // not wrapped in a transaction (Storage and Postgres are separate systems here), but this is
    // the same "clean up on the way out" pattern used elsewhere in this codebase.
    await supabase.storage.from(TRANSPORT_DOCUMENTS_BUCKET).remove([objectPath]);
    throw error;
  }
}

// The bucket is private (no public-read policy) — a stored object path is only ever useful through
// a short-lived signed URL, generated on demand right before the user views/downloads it, never
// persisted or shown as a bare link. 5 minutes is enough for a click-through view without leaving a
// long-lived credential sitting in browser history/devtools.
export async function getSignedDocumentUrl(objectPath: string): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.storage
    .from(TRANSPORT_DOCUMENTS_BUCKET)
    .createSignedUrl(objectPath, 300);
  if (error) throw error;
  return data.signedUrl;
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

// --- Multi-animal / multi-party transport draft layer ---------------------------------------
// docs/adr/TRANSPORT_DATA_MODEL.md: create_transport_draft() is the single atomic entry point for
// every way a transport draft can be created (standalone form, marketplace purchase, foundation
// adoption, private rehoming) — replaces separately inserting into transport_requests, then
// transport_request_animals, then transport_parties across three round trips with no atomicity.
// The RPC always creates in 'draft' status; submitting, cancelling, or amending happen afterwards
// through the functions below.

export type TransportRequestAnimalRow =
  Database["public"]["Tables"]["transport_request_animals"]["Row"];
export type TransportPartyRow = Database["public"]["Tables"]["transport_parties"]["Row"];
export type TransportPartyRole = TransportPartyRow["party_role"];

export type TransportDraftAnimalInput = {
  animal_id?: string | null;
  name?: string;
  breed_free_text?: string;
  sex?: "male" | "female";
  approximate_age?: string;
  weight_kg?: number;
  size_category?: "small" | "medium" | "large" | "giant";
  microchip_number?: string;
  microchip_known?: boolean;
  passport_available?: boolean;
  vaccination_status?: string;
  rabies_vaccination_date?: string;
  health_condition?: string;
  medication?: string;
  behavioural_notes?: string;
  anxiety_or_aggression_notes?: string;
  can_travel_with_others?: boolean;
  crate_requirements?: string;
};

// legal_owner/sender/payer here may only carry a profile_id equal to the caller's own id (enforced
// server-side by the RPC) — naming another Havenpaw user as already having agreed to own/send/pay
// is not something a requester can claim unilaterally. recipient and organisation-based parties of
// any role are unrestricted, since naming who an animal is going *to* is inherent to the request.
export type TransportDraftPartyInput = {
  party_role: Exclude<TransportPartyRole, "requester">;
  profile_id?: string | null;
  organisation_id?: string | null;
  external_name?: string | null;
  external_phone?: string | null;
  external_email?: string | null;
};

// p_request accepts a curated subset of transport_requests columns (route/compliance/service/
// declaration fields) — requester_profile_id and status are always server-controlled and never
// read from it. Element 0 of `animals` is mirrored by the RPC into transport_requests' own legacy
// inline animal_* columns, so every existing page reading r.animal_name keeps working unchanged.
export async function createTransportDraft(input: {
  request?: Record<string, unknown>;
  animals?: TransportDraftAnimalInput[];
  parties?: TransportDraftPartyInput[];
}): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("create_transport_draft", {
    p_request: (input.request ?? {}) as never,
    p_animals: (input.animals ?? []) as never,
    p_parties: (input.parties ?? []) as never,
  });
  if (error) throw error;
  return data as string;
}

// Draft-stage animal/party editing — thin wrappers around direct table access. The database (RLS +
// the prevent_animal_and_party_changes_after_draft trigger) is what actually enforces "requester,
// own request, still draft"; these helpers add no business logic of their own beyond that.
export async function listDraftAnimals(transportRequestId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_request_animals")
    .select("*")
    .eq("transport_request_id", transportRequestId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TransportRequestAnimalRow[];
}

export async function addDraftAnimal(
  transportRequestId: string,
  position: number,
  animal: TransportDraftAnimalInput,
) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_request_animals")
    .insert({ transport_request_id: transportRequestId, position, ...animal })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function removeDraftAnimal(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("transport_request_animals").delete().eq("id", id);
  if (error) throw error;
}

export async function listTransportParties(transportRequestId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_parties")
    .select("*")
    .eq("transport_request_id", transportRequestId);
  if (error) throw error;
  return (data ?? []) as TransportPartyRow[];
}

export async function addDraftParty(transportRequestId: string, party: TransportDraftPartyInput) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_parties")
    .insert({ transport_request_id: transportRequestId, ...party })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function removeDraftParty(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("transport_parties").delete().eq("id", id);
  if (error) throw error;
}

// Submitting is just the one legitimate customer-initiated status transition the operational-field
// lock trigger (20260101006000) already allows outside ops/driver — draft -> submitted.
export async function submitTransportDraft(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("transport_requests")
    .update({ status: "submitted" })
    .eq("id", id);
  if (error) throw error;
}

// The other legitimate customer-initiated transition the same trigger allows: self-cancel, from
// any non-final status.
export async function cancelMyTransportRequest(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("transport_requests")
    .update({ status: "cancelled_by_customer" })
    .eq("id", id);
  if (error) throw error;
}

// --- Post-submission amendments -------------------------------------------------------------
// docs/adr/TRANSPORT_DATA_MODEL.md: once a request leaves 'draft', its booking-time snapshot
// columns are locked against direct customer edits (20260101006900). A legitimate post-submission
// change to one of a fixed set of contact/address/date fields goes through this workflow instead —
// filed by the requester, applied or rejected by operations.
export const amendableTransportFields = [
  "pickup_city",
  "pickup_area_approx",
  "pickup_address_exact",
  "destination_city",
  "destination_area_approx",
  "destination_address_exact",
  "earliest_date",
  "latest_date",
  "release_authorized_by",
  "receive_authorized_by",
] as const;
export type AmendableTransportField = (typeof amendableTransportFields)[number];

export type TransportRequestAmendmentRow =
  Database["public"]["Tables"]["transport_request_amendments"]["Row"];

export async function requestTransportAmendment(input: {
  transportRequestId: string;
  fieldName: AmendableTransportField;
  newValue: string;
}): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("request_transport_amendment", {
    p_transport_request_id: input.transportRequestId,
    p_field_name: input.fieldName,
    p_new_value: input.newValue,
  });
  if (error) throw error;
  return data as string;
}

export async function reviewTransportAmendment(input: {
  amendmentId: string;
  approve: boolean;
  reviewNote?: string | null;
}) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("review_transport_amendment", {
    p_amendment_id: input.amendmentId,
    p_approve: input.approve,
    p_review_note: input.reviewNote ?? null,
  });
  if (error) throw error;
}

export async function listTransportAmendments(transportRequestId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transport_request_amendments")
    .select("*")
    .eq("transport_request_id", transportRequestId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TransportRequestAmendmentRow[];
}

// A plain-language label for each amendable field — never show a raw column name to a customer
// (same rule as transport status/document category).
export const amendableFieldLabels: Record<AmendableTransportField, string> = {
  pickup_city: "Pickup city",
  pickup_area_approx: "Pickup area",
  pickup_address_exact: "Exact pickup address",
  destination_city: "Destination city",
  destination_area_approx: "Destination area",
  destination_address_exact: "Exact destination address",
  earliest_date: "Earliest date",
  latest_date: "Latest date",
  release_authorized_by: "Person authorised to release the animal",
  receive_authorized_by: "Person authorised to receive the animal",
};

// --- Timeline (Stage C, docs/AUTONOMOUS_BACKEND_PROGRESS.md) -------------------------------
// A real event timeline built from transport_status_history (already written on every status
// change, see changeOpsRequestStatus()/advanceJobStatus()) and transport_request_amendments
// (already timestamped by request_transport_amendment()/review_transport_amendment()) — never
// guessed from the current row's own timestamps. Past-tense labels distinct from
// nextActionForStatus() (which phrases the *current* step as an instruction, "Review and accept
// your quotation") since a timeline entry describes something that already happened.
const statusEventLabels: Record<string, string> = {
  draft: "Draft saved",
  submitted: "Request submitted",
  initial_review: "Review started",
  missing_information: "Additional information requested",
  documents_under_review: "Documents under review",
  quotation_prepared: "Quotation being prepared",
  quotation_sent: "Quotation sent",
  accepted_by_customer: "Quotation accepted",
  awaiting_documents: "Awaiting remaining documents",
  ready_for_scheduling: "Ready for scheduling",
  scheduled: "Transport scheduled",
  driver_assigned: "Driver assigned",
  pickup_confirmed: "Pickup confirmed",
  animal_collected: "Animal collected",
  in_transport: "In transport",
  rest_or_care_stop: "On a rest/care stop",
  approaching_destination: "Approaching destination",
  delivered: "Delivered",
  handover_confirmed: "Handover confirmed",
  completed: "Completed",
  rejected: "Request not accepted",
  cancelled_by_customer: "Cancelled by you",
  cancelled_by_operations: "Cancelled by Havenpaw",
  veterinary_hold: "Placed on veterinary hold",
  compliance_hold: "Placed on compliance hold",
  route_postponed: "Route postponed",
};

export function statusEventLabel(status: string): string {
  return statusEventLabels[status] ?? status.replace(/_/g, " ");
}

export type TransportTimelineEvent = {
  id: string;
  timestamp: string;
  label: string;
  detail: string | null;
};

// Customer-safe: only customer_note ever leaves the database for this role (never internal_note —
// selected explicitly, not filtered client-side, so a future careless select("*") elsewhere can't
// leak it through this function), and only a resolved (not pending) amendment's outcome, never the
// ops-only review_note.
export async function getCustomerTimeline(
  transportRequestId: string,
): Promise<TransportTimelineEvent[]> {
  const supabase = getSupabaseBrowserClient();
  const [historyResult, amendmentsResult] = await Promise.all([
    supabase
      .from("transport_status_history")
      .select("id, status, changed_at, customer_note")
      .eq("transport_request_id", transportRequestId),
    supabase
      .from("transport_request_amendments")
      .select("id, field_name, status, reviewed_at")
      .eq("transport_request_id", transportRequestId)
      .neq("status", "pending"),
  ]);
  if (historyResult.error) throw historyResult.error;
  if (amendmentsResult.error) throw amendmentsResult.error;

  const events: TransportTimelineEvent[] = [];
  for (const h of historyResult.data ?? []) {
    events.push({
      id: `status-${h.id}`,
      timestamp: h.changed_at,
      label: statusEventLabel(h.status),
      detail: h.customer_note,
    });
  }
  for (const a of amendmentsResult.data ?? []) {
    if (!a.reviewed_at) continue;
    const field = amendableFieldLabels[a.field_name as AmendableTransportField] ?? a.field_name;
    events.push({
      id: `amendment-${a.id}`,
      timestamp: a.reviewed_at,
      label:
        a.status === "approved" ? `Change approved: ${field}` : `Change request declined: ${field}`,
      detail: null,
    });
  }
  return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// --- Driver job view (column-minimized, docs/adr/TRANSPORT_DATA_MODEL.md) --------------------
export type DriverTransportJobRow = Database["public"]["Views"]["driver_transport_job_view"]["Row"];

export async function getDriverJobView(transportRequestId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("driver_transport_job_view")
    .select("*")
    .eq("id", transportRequestId)
    .maybeSingle();
  if (error) throw error;
  return data as DriverTransportJobRow | null;
}

// --- Phase 5 integration entry points ---------------------------------------------------------
// docs/adr/TRANSPORT_DATA_MODEL.md, "Explicit backend entry points": each of these assembles a
// createTransportDraft() payload from context the calling flow already has on file (a purchase, an
// adoption, a private rehoming), instead of the customer re-typing everything a second time on the
// standalone form. None of these submits, schedules, or confirms anything — every one creates a
// 'draft' only (create_transport_draft() always forces this server-side), exactly like the
// standalone form's own first save. No UI calls these yet; they exist so a future UI can, without
// duplicating the atomic-creation logic three more times.
//
// Every entry point below is called BY the requester (auth.uid(), same as create_transport_draft()
// itself) — the specific choice of who that is differs per flow, matching how each real workflow
// already operates elsewhere in this codebase (e.g. the seeded 'foundation_rescue' transport
// request is requested by the foundation, not the animal). Any other party who ISN'T the requester
// is represented as an organisation (no profile-forgery restriction applies to organisation_id) or
// as 'recipient' (also unrestricted) — never as a bare 'legal_owner'/'sender'/'payer' profile_id
// naming someone other than the caller, since create_transport_draft() itself rejects that.

async function fetchAnimalForDraft(animalId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("animals")
    .select("id, name, sex, weight_kg, size_category, organization_id")
    .eq("id", animalId)
    .single();
  if (error) throw error;
  return data;
}

// Marketplace purchase: called by the buyer once their application/reservation for a breeder's
// puppy is approved. The animal's own kennel becomes the 'sender' party automatically — the buyer
// never has to re-enter who the breeder is.
export async function createTransportDraftForMarketplacePurchase(input: {
  animalId: string;
}): Promise<string> {
  const animal = await fetchAnimalForDraft(input.animalId);
  const parties: TransportDraftPartyInput[] = animal.organization_id
    ? [{ party_role: "sender", organisation_id: animal.organization_id }]
    : [];
  return createTransportDraft({
    request: { request_purpose: "purchased_puppy", ownership_changing: true },
    animals: [
      {
        animal_id: animal.id,
        name: animal.name,
        sex: animal.sex ?? undefined,
        weight_kg: animal.weight_kg ?? undefined,
        size_category: animal.size_category ?? undefined,
      },
    ],
    parties,
  });
}

// Foundation adoption: the foundation legally owns and is sending the animal (both roles, since an
// adoption transfers legal ownership away from the foundation) — the approved adopter is named as
// the recipient, regardless of whether the foundation or the adopter is the one actually calling
// this (both are valid real-world arrangements; 'recipient' carries no forgery restriction either
// way, unlike 'legal_owner'/'sender').
export async function createTransportDraftForFoundationAdoption(input: {
  animalId: string;
  adopterProfileId: string;
}): Promise<string> {
  const animal = await fetchAnimalForDraft(input.animalId);
  const parties: TransportDraftPartyInput[] = [
    { party_role: "recipient", profile_id: input.adopterProfileId },
  ];
  if (animal.organization_id) {
    parties.push(
      { party_role: "sender", organisation_id: animal.organization_id },
      { party_role: "legal_owner", organisation_id: animal.organization_id },
    );
  }
  return createTransportDraft({
    request: { request_purpose: "adoption", ownership_changing: true },
    animals: [
      {
        animal_id: animal.id,
        name: animal.name,
        sex: animal.sex ?? undefined,
        weight_kg: animal.weight_kg ?? undefined,
        size_category: animal.size_category ?? undefined,
      },
    ],
    parties,
  });
}

// Private rehoming: the current owner is the one giving up the animal, so they're assumed to be
// the requester arranging its transport away (matches create_transport_draft()'s own rule that a
// bare 'legal_owner' profile_id must equal the caller — there is no way to name a *different*
// person's profile as legal_owner without their own action). The new owner is named as the
// recipient, which carries no such restriction.
export async function createTransportDraftForPrivateRehoming(input: {
  animalId: string;
  recipientProfileId: string;
}): Promise<string> {
  const animal = await fetchAnimalForDraft(input.animalId);
  return createTransportDraft({
    request: { request_purpose: "other", ownership_changing: true },
    animals: [
      {
        animal_id: animal.id,
        name: animal.name,
        sex: animal.sex ?? undefined,
        weight_kg: animal.weight_kg ?? undefined,
        size_category: animal.size_category ?? undefined,
      },
    ],
    parties: [{ party_role: "recipient", profile_id: input.recipientProfileId }],
  });
}
