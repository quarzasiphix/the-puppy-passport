import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";

export type LitterRow = Database["public"]["Tables"]["litters"]["Row"];
export type AnimalRow = Database["public"]["Tables"]["animals"]["Row"];
export type ParentDogRow = Database["public"]["Tables"]["parent_dogs"]["Row"];

export async function getMyKennel(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("organisations")
    .select("id, name, slug, plan")
    .eq("owner_user_id", userId)
    .eq("org_type", "kennel")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyKennelProfile(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("organisations")
    .select(
      "id, name, slug, description, cover_image_url, logo_url, city, country, association_name, membership_number, years_experience, response_time, transport_available, international_transport_available, verification_status, is_public",
    )
    .eq("owner_user_id", userId)
    .eq("org_type", "kennel")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateKennel(
  orgId: string,
  patch: Partial<
    Pick<
      Database["public"]["Tables"]["organisations"]["Row"],
      | "description"
      | "cover_image_url"
      | "logo_url"
      | "city"
      | "country"
      | "association_name"
      | "membership_number"
      | "years_experience"
      | "response_time"
      | "transport_available"
      | "international_transport_available"
    >
  >,
) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("organisations").update(patch).eq("id", orgId);
  if (error) throw error;
}

export async function listKennelParentDogs(kennelId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("parent_dogs")
    .select(
      "id, registered_name, call_name, sex, breed_id, is_active, date_of_birth, color, pedigree_number, titles, description",
    )
    .eq("kennel_id", kennelId)
    .order("registered_name");
  if (error) throw error;
  return (data ?? []) as Pick<
    ParentDogRow,
    | "id"
    | "registered_name"
    | "call_name"
    | "sex"
    | "breed_id"
    | "is_active"
    | "date_of_birth"
    | "color"
    | "pedigree_number"
    | "titles"
    | "description"
  >[];
}

const litterListSelect =
  "id, code, breed_id, mother_id, father_id, birth_date, expected_birth_date, ready_date, puppy_count, status, is_published, registration_number, association, breeds(name), mother:parent_dogs!litters_mother_id_fkey(registered_name), father:parent_dogs!litters_father_id_fkey(registered_name)";

type KennelLitterRow = LitterRow & {
  breeds: { name: string } | null;
  mother: { registered_name: string } | null;
  father: { registered_name: string } | null;
};

export type KennelLitterSummary = KennelLitterRow & {
  totalPuppies: number;
  availablePuppies: number;
  reservedPuppies: number;
  soldPuppies: number;
};

export async function listKennelLitters(kennelId: string): Promise<KennelLitterSummary[]> {
  const supabase = getSupabaseBrowserClient();
  const [littersResult, animalsResult] = await Promise.all([
    supabase
      .from("litters")
      .select(litterListSelect)
      .eq("kennel_id", kennelId)
      .order("created_at", { ascending: false }),
    supabase
      .from("animals")
      .select("litter_id, availability_status")
      .eq("organization_id", kennelId),
  ]);
  if (littersResult.error) throw littersResult.error;
  if (animalsResult.error) throw animalsResult.error;

  const counts = new Map<
    string,
    { total: number; available: number; reserved: number; sold: number }
  >();
  for (const a of animalsResult.data ?? []) {
    if (!a.litter_id) continue;
    const c = counts.get(a.litter_id) ?? { total: 0, available: 0, reserved: 0, sold: 0 };
    c.total += 1;
    if (a.availability_status === "available" || a.availability_status === "applications_open")
      c.available += 1;
    if (a.availability_status === "reserved") c.reserved += 1;
    if (a.availability_status === "sold") c.sold += 1;
    counts.set(a.litter_id, c);
  }

  return ((littersResult.data ?? []) as unknown as KennelLitterRow[]).map((l) => {
    const c = counts.get(l.id) ?? { total: 0, available: 0, reserved: 0, sold: 0 };
    return {
      ...l,
      totalPuppies: c.total,
      availablePuppies: c.available,
      reservedPuppies: c.reserved,
      soldPuppies: c.sold,
    };
  });
}

export async function getKennelLitter(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("litters")
    .select(
      "id, code, breed_id, mother_id, father_id, birth_date, expected_birth_date, ready_date, puppy_count, status, is_published, registration_number, association, description, kennel_id, breeds(name), mother:parent_dogs!litters_mother_id_fkey(registered_name, pedigree_number), father:parent_dogs!litters_father_id_fkey(registered_name, pedigree_number)",
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as LitterRow & {
    breeds: { name: string } | null;
    mother: { registered_name: string; pedigree_number: string | null } | null;
    father: { registered_name: string; pedigree_number: string | null } | null;
  };
}

export async function createLitter(payload: Database["public"]["Tables"]["litters"]["Insert"]) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("litters").insert(payload).select("id").single();
  if (error) throw error;
  return data;
}

export async function updateLitter(
  id: string,
  payload: Database["public"]["Tables"]["litters"]["Update"],
) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("litters").update(payload).eq("id", id);
  if (error) throw error;
}

const kennelAnimalSelect =
  "id, listing_category, litter_id, organization_id, name, breed_id, sex, color, date_of_birth, price, currency, description, availability_status, is_published, transport_available, breeds(name), litters(code)";

type KennelAnimalRow = AnimalRow & {
  breeds: { name: string } | null;
  litters: { code: string } | null;
};

export async function listKennelPuppies(kennelId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("animals")
    .select(kennelAnimalSelect)
    .eq("organization_id", kennelId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as KennelAnimalRow[];
}

export async function listLitterPuppies(litterId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("animals")
    .select(kennelAnimalSelect)
    .eq("litter_id", litterId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as KennelAnimalRow[];
}

export async function createPuppy(payload: Database["public"]["Tables"]["animals"]["Insert"]) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("animals").insert(payload).select("id").single();
  if (error) throw error;
  return data;
}

export async function updatePuppy(
  id: string,
  payload: Database["public"]["Tables"]["animals"]["Update"],
) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("animals").update(payload).eq("id", id);
  if (error) throw error;
}

export async function listBreeds() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("breeds").select("id, name").order("name");
  if (error) throw error;
  return data ?? [];
}

export type AchievementRow = Database["public"]["Tables"]["achievements"]["Row"] & {
  parent_dogs: { registered_name: string } | null;
};

export async function listKennelAchievements(kennelId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("achievements")
    .select("*, parent_dogs(registered_name)")
    .eq("kennel_id", kennelId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AchievementRow[];
}

export async function createAchievement(
  payload: Database["public"]["Tables"]["achievements"]["Insert"],
) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("achievements").insert(payload);
  if (error) throw error;
}
