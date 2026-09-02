import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";

export type FoundationAnimalRow = Database["public"]["Tables"]["animals"]["Row"] & {
  approximate_age: string | null;
  breeds: { name: string } | null;
};

export async function getMyFoundation(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("organisations")
    .select("id, name")
    .eq("owner_user_id", userId)
    .in("org_type", ["foundation", "shelter", "rescue"])
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyFoundationProfile(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("organisations")
    .select(
      "id, name, slug, description, cover_image_url, logo_url, city, country, association_name, membership_number, years_experience, response_time, transport_available, international_transport_available, verification_status, is_public",
    )
    .eq("owner_user_id", userId)
    .in("org_type", ["foundation", "shelter", "rescue"])
    .maybeSingle();
  if (error) throw error;
  return data;
}

const foundationAnimalSelect =
  "id, listing_category, organization_id, name, breed_id, sex, color, date_of_birth, approximate_age, price, currency, description, temperament, ideal_home, availability_status, is_published, transport_available, breeds(name)";

export async function listFoundationAnimals(orgId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("animals")
    .select(foundationAnimalSelect)
    .eq("organization_id", orgId)
    .eq("listing_category", "adoption")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as FoundationAnimalRow[];
}

export async function createAdoptionAnimal(
  payload: Database["public"]["Tables"]["animals"]["Insert"],
) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("animals").insert(payload).select("id").single();
  if (error) throw error;
  return data;
}

export async function updateAdoptionAnimal(
  id: string,
  payload: Database["public"]["Tables"]["animals"]["Update"],
) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("animals").update(payload).eq("id", id);
  if (error) throw error;
}
