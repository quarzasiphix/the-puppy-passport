import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  animalSelect,
  mapAnimalToPuppy,
  mapOrgToBreeder,
  orgSelect,
  type AnimalRow,
  type OrgRow,
} from "@/lib/queries/marketplace";

export async function listSavedAnimalIds(buyerId: string): Promise<string[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("saved_animals")
    .select("animal_id")
    .eq("buyer_id", buyerId);
  if (error) throw error;
  return (data ?? []).map((r) => r.animal_id);
}

export async function saveAnimal(buyerId: string, animalId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("saved_animals")
    .insert({ buyer_id: buyerId, animal_id: animalId });
  if (error && !error.message.includes("duplicate")) throw error;
}

export async function unsaveAnimal(buyerId: string, animalId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("saved_animals")
    .delete()
    .eq("buyer_id", buyerId)
    .eq("animal_id", animalId);
  if (error) throw error;
}

export async function listSavedPuppies(buyerId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("saved_animals")
    .select(`saved_at, animals(${animalSelect})`)
    .eq("buyer_id", buyerId)
    .order("saved_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as { saved_at: string; animals: AnimalRow | null }[];
  return rows.filter((r) => r.animals).map((r) => mapAnimalToPuppy(r.animals!));
}

export async function listFollowedOrgIds(buyerId: string): Promise<string[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("follows")
    .select("followed_organization_id")
    .eq("follower_profile_id", buyerId)
    .not("followed_organization_id", "is", null);
  if (error) throw error;
  return (data ?? []).map((r) => r.followed_organization_id!).filter(Boolean);
}

export async function followOrg(buyerId: string, orgId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("follows")
    .insert({ follower_profile_id: buyerId, followed_organization_id: orgId });
  if (error && !error.message.includes("duplicate")) throw error;
}

export async function unfollowOrg(buyerId: string, orgId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_profile_id", buyerId)
    .eq("followed_organization_id", orgId);
  if (error) throw error;
}

export async function listFollowedBreeders(buyerId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("follows")
    .select(
      `followed_organization_id, organisations!follows_followed_organization_id_fkey(${orgSelect})`,
    )
    .eq("follower_profile_id", buyerId)
    .not("followed_organization_id", "is", null);
  if (error) throw error;
  const rows = (data ?? []) as unknown as {
    followed_organization_id: string | null;
    organisations: OrgRow | null;
  }[];
  const orgs = rows.filter((r) => r.organisations).map((r) => r.organisations!);
  return Promise.all(orgs.map(mapOrgToBreeder));
}
