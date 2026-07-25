import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { notifyUser } from "@/lib/queries/notifications";

// Private rehoming is a separate moderated workflow (CLAUDE.md rule #5): a private_rehoming
// animal only becomes publicly visible once an admin approves the corresponding rehoming_reviews
// row (enforced by RLS on `animals`, not just by hiding UI — see the "public reads approved
// private rehoming listings" policy in 20260101001200_rehoming_reviews.sql). Submitting is_published
// true up front is safe: RLS keeps it hidden from everyone but the owner/admin until approved.
export async function submitRehomingRequest(payload: {
  ownerUserId: string;
  name: string;
  breedId: string | null;
  sex: "male" | "female" | null;
  approximateAge: string | null;
  color: string | null;
  description: string | null;
  temperament: string | null;
  idealHome: string | null;
  reasonForRehoming: string;
  ownershipDeclaration: boolean;
}) {
  const supabase = getSupabaseBrowserClient();
  const { data: animal, error: animalError } = await supabase
    .from("animals")
    .insert({
      owner_profile_id: payload.ownerUserId,
      listing_category: "private_rehoming",
      name: payload.name,
      breed_id: payload.breedId,
      sex: payload.sex,
      approximate_age: payload.approximateAge,
      color: payload.color,
      description: payload.description,
      temperament: payload.temperament,
      ideal_home: payload.idealHome,
      is_published: true,
      availability_status: "draft",
    })
    .select("id")
    .single();
  if (animalError) throw animalError;

  const { error: reviewError } = await supabase.from("rehoming_reviews").insert({
    animal_id: animal.id,
    owner_profile_id: payload.ownerUserId,
    reason_for_rehoming: payload.reasonForRehoming,
    ownership_declaration: payload.ownershipDeclaration,
  });
  if (reviewError) throw reviewError;

  return animal;
}

export type RehomingReviewRow = {
  id: string;
  animal_id: string;
  owner_profile_id: string;
  reason_for_rehoming: string;
  ownership_declaration: boolean;
  admin_status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  created_at: string;
  animals: { name: string; breeds: { name: string } | null } | null;
  profiles: { display_name: string | null; city: string | null; country: string | null } | null;
};

export async function listRehomingReviews() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("rehoming_reviews")
    .select(
      "id, animal_id, owner_profile_id, reason_for_rehoming, ownership_declaration, admin_status, admin_notes, created_at, animals(name, breeds(name)), profiles!rehoming_reviews_owner_profile_id_fkey(display_name, city, country)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as RehomingReviewRow[];
}

export async function approveRehomingReview(id: string, animalId: string, ownerProfileId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error: reviewError } = await supabase
    .from("rehoming_reviews")
    .update({ admin_status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (reviewError) throw reviewError;
  // Approval alone makes it publicly visible via RLS; also mark it available so it shows the
  // right status instead of sitting in "draft" forever.
  const { error: animalError } = await supabase
    .from("animals")
    .update({ availability_status: "available" })
    .eq("id", animalId);
  if (animalError) throw animalError;

  await notifyUser({
    profileId: ownerProfileId,
    type: "rehoming_approved",
    category: "adoption",
    title: "Your rehoming listing was approved",
    body: "It's now visible to people looking to adopt on Havenpaw.",
    linkUrl: `/adoptions/${animalId}`,
    dedupKey: `rehoming_review:${id}:approved`,
  });
}

export async function rejectRehomingReview(id: string, notes: string, ownerProfileId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("rehoming_reviews")
    .update({ admin_status: "rejected", admin_notes: notes, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;

  await notifyUser({
    profileId: ownerProfileId,
    type: "rehoming_rejected",
    category: "adoption",
    title: "Your rehoming submission wasn't approved",
    body: notes,
    dedupKey: `rehoming_review:${id}:rejected`,
  });
}
