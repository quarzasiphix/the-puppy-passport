import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { notifyUserFromTemplate } from "@/lib/queries/notifications";

export type ApplicationStatus =
  | "submitted"
  | "under_review"
  | "more_info_requested"
  | "call_requested"
  | "waiting_list"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "converted_to_reservation"
  | "draft"
  | "interview_planned"
  | "expired";

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  more_info_requested: "Breeder asked for more info",
  call_requested: "Breeder invited you to a call",
  interview_planned: "Interview planned",
  waiting_list: "On the waiting list",
  approved: "Approved",
  rejected: "Not approved",
  withdrawn: "Withdrawn",
  converted_to_reservation: "Reserved",
  expired: "Expired",
};

export const applicationStatusStyles: Record<ApplicationStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-secondary text-muted-foreground",
  under_review: "bg-accent/15 text-accent",
  more_info_requested: "bg-accent/15 text-accent",
  call_requested: "bg-accent/15 text-accent",
  interview_planned: "bg-accent/15 text-accent",
  waiting_list: "bg-secondary text-muted-foreground",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/10 text-destructive",
  withdrawn: "bg-secondary text-muted-foreground",
  converted_to_reservation: "bg-success/15 text-success",
  expired: "bg-muted text-muted-foreground",
};

export type SubmitApplicationInput = {
  animalId: string;
  litterId: string | null;
  buyerId: string;
  organizationId: string | null;
  applicationType: "purchase" | "adoption" | "rehoming_inquiry";
  buyerCity: string;
  buyerCountry: string;
  phone: string;
  housingType: "house" | "apartment";
  hasGarden: boolean;
  hasChildren: boolean;
  childrenAges: string | null;
  otherAnimals: string | null;
  previousExperience: string | null;
  breedKnowledge: string | null;
  workingSchedule: string | null;
  aloneTime: string | null;
  intendedPurpose: string;
  collectionMethod: "pickup" | "domestic_transport" | "international_transport";
  transportRequired: boolean;
  preferredCollectionDate: string | null;
  message: string;
  landlordPermission?: boolean | null;
  veterinaryPlan?: string | null;
  consentVersion?: string | null;
};

export async function submitApplication(input: SubmitApplicationInput) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("buyer_applications").insert({
    animal_id: input.animalId,
    litter_id: input.litterId,
    buyer_id: input.buyerId,
    organization_id: input.organizationId,
    application_type: input.applicationType,
    buyer_city: input.buyerCity,
    buyer_country: input.buyerCountry,
    phone: input.phone,
    housing_type: input.housingType,
    has_garden: input.hasGarden,
    has_children: input.hasChildren,
    children_ages: input.childrenAges,
    other_animals: input.otherAnimals,
    previous_experience: input.previousExperience,
    breed_knowledge: input.breedKnowledge,
    working_schedule: input.workingSchedule,
    alone_time: input.aloneTime,
    intended_purpose: input.intendedPurpose,
    collection_method: input.collectionMethod,
    transport_required: input.transportRequired,
    preferred_collection_date: input.preferredCollectionDate,
    message: input.message,
    landlord_permission: input.landlordPermission ?? null,
    veterinary_plan: input.veterinaryPlan ?? null,
    consent_version: input.consentVersion ?? null,
    consent_given_at: input.consentVersion ? new Date().toISOString() : null,
  });
  if (error) throw error;
}

export type MyApplicationRow = {
  id: string;
  animal_id: string;
  application_type: "purchase" | "adoption" | "rehoming_inquiry";
  status: ApplicationStatus;
  breeder_response: string | null;
  submitted_at: string;
  animals: {
    name: string;
    availability_status: string;
    organisations: { name: string; slug: string } | null;
  } | null;
};

export async function listMyApplications(buyerId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("buyer_applications")
    .select(
      "id, animal_id, application_type, status, breeder_response, submitted_at, animals(name, availability_status, organisations!animals_organization_id_fkey(name, slug))",
    )
    .eq("buyer_id", buyerId)
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as MyApplicationRow[];
}

export async function withdrawApplication(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("buyer_applications")
    .update({ status: "withdrawn" })
    .eq("id", id);
  if (error) throw error;
}

export type OrgApplicationRow = {
  id: string;
  animal_id: string;
  buyer_id: string;
  application_type: "purchase" | "adoption" | "rehoming_inquiry";
  buyer_city: string | null;
  buyer_country: string | null;
  phone: string | null;
  housing_type: "house" | "apartment" | null;
  has_garden: boolean | null;
  has_children: boolean | null;
  children_ages: string | null;
  other_animals: string | null;
  previous_experience: string | null;
  breed_knowledge: string | null;
  working_schedule: string | null;
  alone_time: string | null;
  intended_purpose: string | null;
  collection_method: "pickup" | "domestic_transport" | "international_transport" | null;
  transport_required: boolean;
  preferred_collection_date: string | null;
  message: string | null;
  landlord_permission: boolean | null;
  veterinary_plan: string | null;
  internal_notes: string | null;
  status: ApplicationStatus;
  breeder_response: string | null;
  submitted_at: string;
  animals: { name: string } | null;
  profiles: { display_name: string | null } | null;
};

export async function listApplicationsForOrg(orgId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("buyer_applications")
    .select(
      "id, animal_id, buyer_id, application_type, buyer_city, buyer_country, phone, housing_type, has_garden, has_children, children_ages, other_animals, previous_experience, breed_knowledge, working_schedule, alone_time, intended_purpose, collection_method, transport_required, preferred_collection_date, message, landlord_permission, veterinary_plan, internal_notes, status, breeder_response, submitted_at, animals(name), profiles!buyer_applications_buyer_id_fkey(display_name)",
    )
    .eq("organization_id", orgId)
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OrgApplicationRow[];
}

// internal_notes is org/staff-only — never returned by listMyApplications() for the applicant's
// own view, and the buyer-write-lock trigger (20260101007800) rejects any attempt by the buyer to
// set it directly, so this function is only ever meaningful when called by the org itself.
export async function respondToApplication(params: {
  id: string;
  status: ApplicationStatus;
  breederResponse: string | null;
  internalNotes?: string | null;
  buyerId: string;
  animalName: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("buyer_applications")
    .update({
      status: params.status,
      breeder_response: params.breederResponse,
      ...(params.internalNotes !== undefined ? { internal_notes: params.internalNotes } : {}),
    })
    .eq("id", params.id);
  if (error) throw error;
  await notifyUserFromTemplate({
    profileId: params.buyerId,
    templateId: "application_status_change",
    category: "applications",
    // Keyed on the specific status reached, not just the application -- a retry of *this*
    // transition dedupes, but a genuinely later, different status change still notifies.
    dedupKey: `application:${params.id}:${params.status}`,
    payload: { animalName: params.animalName, statusLabel: applicationStatusLabels[params.status] },
  });
}
