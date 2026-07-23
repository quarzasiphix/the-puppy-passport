import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  mapAnimalToAdoption,
  mapAnimalToPuppy,
  mapOrgToBreeder,
  mapOrgToFoundation,
  orgSelect,
  type AnimalRow,
  type OrgRow,
} from "@/lib/queries/marketplace";

// Superset of animalSelect (adds listing_category, approximate_age and the owner-profile join) so a
// single query can tell a saved breeder puppy apart from a saved adoption/rehoming animal and map
// each through its correct shape — see listSavedAnimals.
const savedAnimalSelect =
  "id, listing_category, name, sex, color, date_of_birth, approximate_age, price, currency, availability_status, transport_available, description, temperament, ideal_home, litter_id, organization_id, breeds(name), animal_images(image_url, is_cover), litters(ready_date), organisations!animals_organization_id_fkey(id, name, slug, city, country, verification_status, response_time), profiles!animals_owner_profile_id_fkey(display_name, city, country)";

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

type SavedAnimalRow = AnimalRow & {
  listing_category: "breeder_puppy" | "adoption" | "private_rehoming";
  approximate_age: string | null;
  profiles: { display_name: string | null; city: string | null; country: string | null } | null;
};

export type SavedAnimal =
  | { kind: "puppy"; puppy: ReturnType<typeof mapAnimalToPuppy> }
  | { kind: "adoption"; adoption: ReturnType<typeof mapAnimalToAdoption> };

// A saved animal can be a breeder puppy OR an adoption/private-rehoming listing (the heart button
// on AdoptionCard and the puppy detail page both write to the same saved_animals table) — each
// needs its own shape/framing/detail route, not "puppy" for everything saved.
export async function listSavedAnimals(buyerId: string): Promise<SavedAnimal[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("saved_animals")
    .select(`saved_at, animals(${savedAnimalSelect})`)
    .eq("buyer_id", buyerId)
    .order("saved_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as { saved_at: string; animals: SavedAnimalRow | null }[];
  const animals = rows.map((r) => r.animals).filter((a): a is SavedAnimalRow => !!a);
  return animals.map((a) =>
    a.listing_category === "breeder_puppy"
      ? { kind: "puppy" as const, puppy: mapAnimalToPuppy(a) }
      : {
          kind: "adoption" as const,
          adoption: mapAnimalToAdoption({
            ...a,
            listing_category: a.listing_category as "adoption" | "private_rehoming",
          }),
        },
  );
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

const FOUNDATION_ORG_TYPES = ["foundation", "shelter", "rescue"] as const;

async function listFollowedOrgRows(buyerId: string): Promise<OrgRow[]> {
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
  return rows.filter((r) => r.organisations).map((r) => r.organisations!);
}

// Followed organisations can be kennels or foundations/shelters/rescues — each is mapped through
// its own shape so a followed foundation doesn't render mislabelled as a "breeder" (see
// dashboard.buyer.followed.tsx, which previously ran every followed org through mapOrgToBreeder
// regardless of org_type).
export async function listFollowedBreeders(buyerId: string) {
  const orgs = await listFollowedOrgRows(buyerId);
  return Promise.all(orgs.filter((o) => o.org_type === "kennel").map(mapOrgToBreeder));
}

export async function listFollowedFoundations(buyerId: string) {
  const orgs = await listFollowedOrgRows(buyerId);
  return Promise.all(
    orgs
      .filter((o) => (FOUNDATION_ORG_TYPES as readonly string[]).includes(o.org_type))
      .map(mapOrgToFoundation),
  );
}
