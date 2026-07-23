import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";

// Stage D: urgent animal welfare / rescue transport. Eligible creators are restricted at the
// database layer (RLS insert policy on welfare_cases, 20260101007600_welfare_cases.sql) to members
// of a verified foundation/shelter/rescue organisation — this file has no separate eligibility
// check of its own, since the database is the actual gate, not the UI.

export type WelfareCaseRow = Database["public"]["Tables"]["welfare_cases"]["Row"];
export type WelfareCaseStatus = WelfareCaseRow["status"];

// Plain-language labels — an org user should never see a raw status enum value unexplained
// (same rule as transport status/document category elsewhere in this codebase).
export const welfareCaseStatusLabels: Record<WelfareCaseStatus, string> = {
  draft: "Draft",
  submitted: "Submitted — awaiting acknowledgement",
  under_review: "Under review",
  information_required: "More information needed",
  accepted_for_assessment: "Accepted for assessment",
  declined: "Declined",
  converted_to_transport: "Converted to a transport request",
  closed: "Closed",
};

export async function createWelfareCase(input: {
  organisationId: string;
  createdBy: string;
  animalId?: string | null;
  animalName?: string;
  animalDescription?: string;
  reason: string;
  urgency: "routine" | "urgent" | "critical";
  locationCountry?: string;
  locationCity?: string;
  locationAreaApprox?: string;
  locationAddressExact?: string;
  destinationCountry?: string;
  destinationCity?: string;
  deadline?: string | null;
  welfareNotes?: string;
  contactName?: string;
  contactPhone?: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("welfare_cases")
    .insert({
      organisation_id: input.organisationId,
      created_by: input.createdBy,
      animal_id: input.animalId ?? null,
      animal_name: input.animalName ?? null,
      animal_description: input.animalDescription ?? null,
      reason: input.reason,
      urgency: input.urgency,
      location_country: input.locationCountry ?? null,
      location_city: input.locationCity ?? null,
      location_area_approx: input.locationAreaApprox ?? null,
      location_address_exact: input.locationAddressExact ?? null,
      destination_country: input.destinationCountry ?? null,
      destination_city: input.destinationCity ?? null,
      deadline: input.deadline ?? null,
      welfare_notes: input.welfareNotes ?? null,
      contact_name: input.contactName ?? null,
      contact_phone: input.contactPhone ?? null,
      status: "submitted",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function listMyOrgWelfareCases(organisationId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("welfare_cases")
    .select("*")
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as WelfareCaseRow[];
}

export async function getWelfareCase(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("welfare_cases").select("*").eq("id", id).single();
  if (error) throw error;
  return data as WelfareCaseRow;
}

export async function convertWelfareCaseToTransportDraft(caseId: string): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("convert_welfare_case_to_transport_draft", {
    p_case_id: caseId,
  });
  if (error) throw error;
  return data as string;
}

// --- Documents (real Storage upload, private bucket — same pattern as transport documents) ------
const WELFARE_DOCUMENTS_BUCKET = "welfare-case-documents";

function sanitizeFilenameForStoragePath(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function listWelfareCaseDocuments(welfareCaseId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("welfare_case_documents")
    .select("id, file_url, notes, created_at")
    .eq("welfare_case_id", welfareCaseId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function uploadWelfareCaseDocument(input: {
  welfareCaseId: string;
  file: File;
  uploadedBy: string;
  notes?: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const objectPath = `${input.welfareCaseId}/${Date.now()}-${sanitizeFilenameForStoragePath(input.file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(WELFARE_DOCUMENTS_BUCKET)
    .upload(objectPath, input.file, { contentType: input.file.type || undefined });
  if (uploadError) throw uploadError;

  const { error } = await supabase.from("welfare_case_documents").insert({
    welfare_case_id: input.welfareCaseId,
    file_url: objectPath,
    uploaded_by: input.uploadedBy,
    notes: input.notes ?? null,
  });
  if (error) {
    await supabase.storage.from(WELFARE_DOCUMENTS_BUCKET).remove([objectPath]);
    throw error;
  }
}

export async function getSignedWelfareDocumentUrl(objectPath: string): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.storage
    .from(WELFARE_DOCUMENTS_BUCKET)
    .createSignedUrl(objectPath, 300);
  if (error) throw error;
  return data.signedUrl;
}

// --- Operations side -------------------------------------------------------------------------
export async function listOpsWelfareCases() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("welfare_cases")
    .select("*, organisations(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as (WelfareCaseRow & { organisations: { name: string } | null })[];
}

export async function acknowledgeWelfareCase(caseId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("acknowledge_welfare_case", { p_case_id: caseId });
  if (error) throw error;
}

export async function reviewWelfareCase(input: {
  caseId: string;
  decision: "accepted_for_assessment" | "declined" | "information_required";
  reviewNotes?: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("review_welfare_case", {
    p_case_id: input.caseId,
    p_decision: input.decision,
    p_review_notes: input.reviewNotes || null,
  });
  if (error) throw error;
}
