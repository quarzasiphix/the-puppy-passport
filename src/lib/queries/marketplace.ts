import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Puppy, Litter, Breeder, PuppyStatus } from "@/lib/mock-data";
import placeholderImg from "@/assets/puppy-1.jpg";
import {
  FOUNDATION_ORG_TYPES,
  toFoundationOrgType,
  type FoundationOrgType,
} from "@/lib/org-routing";

// Maps real Supabase rows onto the existing mock-data.ts shapes so the already-built
// PuppyCard/LitterCard/BreederCard components and page JSX don't need to change — only the data
// source does. New code should treat these mapper functions, not the mock shapes, as the source
// of truth; the mock shapes are a transitional target being phased out page by page.

const PLN_PER_EUR = 4.3;

function toPuppyStatus(status: string): PuppyStatus {
  switch (status) {
    case "available":
      return "available";
    case "applications_open":
      return "applications-open";
    case "reserved":
      return "reserved";
    case "sold":
    case "adopted":
      return "sold";
    default:
      return "draft";
  }
}

function ageWeeksFrom(dob: string | null): number {
  if (!dob) return 0;
  const days = (Date.now() - new Date(dob).getTime()) / 86_400_000;
  return Math.max(0, Math.round(days / 7));
}

export type AnimalRow = {
  id: string;
  name: string;
  sex: string | null;
  color: string | null;
  date_of_birth: string | null;
  price: number | null;
  currency: string | null;
  availability_status: string;
  transport_available: boolean;
  description: string | null;
  temperament: string | null;
  ideal_home: string | null;
  litter_id: string | null;
  organization_id: string | null;
  breeds: { name: string } | null;
  animal_images: { image_url: string; is_cover: boolean }[];
  litters: { ready_date: string | null } | null;
  organisations: {
    id: string;
    name: string;
    slug: string;
    city: string | null;
    country: string | null;
    verification_status: string;
    response_time: string | null;
    org_type: string;
  } | null;
};

export type PuppyWithExtras = Puppy & { temperament: string | null; idealHome: string | null };

export function mapAnimalToPuppy(a: AnimalRow): PuppyWithExtras {
  const images = a.animal_images?.length
    ? a.animal_images
        .slice()
        .sort((x, y) => Number(y.is_cover) - Number(x.is_cover))
        .map((i) => i.image_url)
    : [placeholderImg];
  const priceEUR = a.currency === "EUR" ? (a.price ?? 0) : Math.round((a.price ?? 0) / PLN_PER_EUR);
  const pricePLN = a.currency === "PLN" ? (a.price ?? 0) : Math.round((a.price ?? 0) * PLN_PER_EUR);
  return {
    id: a.id,
    name: a.name,
    breed: a.breeds?.name ?? "Mixed breed",
    sex: a.sex === "female" ? "Female" : "Male",
    color: a.color ?? "",
    ageWeeks: ageWeeksFrom(a.date_of_birth),
    dob: a.date_of_birth ?? "",
    readyDate: a.litters?.ready_date ?? a.date_of_birth ?? "",
    pricePLN,
    priceEUR,
    city: a.organisations?.city ?? "",
    country: a.organisations?.country ?? "",
    breederId: a.organisations?.id ?? "",
    breederName: a.organisations?.name ?? "",
    kennel: a.organisations?.name ?? "",
    verified: a.organisations?.verification_status === "approved",
    transportAvailable: a.transport_available,
    status: toPuppyStatus(a.availability_status),
    image: images[0],
    gallery: images,
    litterId: a.litter_id ?? "",
    about: a.description ?? "",
    temperament: a.temperament,
    idealHome: a.ideal_home,
  };
}

export const animalSelect =
  "id, name, sex, color, date_of_birth, price, currency, availability_status, transport_available, description, temperament, ideal_home, litter_id, organization_id, breeds(name), animal_images(image_url, is_cover), litters(ready_date), organisations!animals_organization_id_fkey(id, name, slug, city, country, verification_status, response_time, org_type)";

export async function listPublishedPuppies(filters?: { breed?: string; country?: string }) {
  const supabase = getSupabaseBrowserClient();
  const query = supabase
    .from("animals")
    .select(animalSelect)
    .eq("listing_category", "breeder_puppy")
    .eq("is_published", true)
    .order("created_at", { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  let rows = (data ?? []) as unknown as AnimalRow[];
  if (filters?.breed) rows = rows.filter((r) => r.breeds?.name === filters.breed);
  if (filters?.country) rows = rows.filter((r) => r.organisations?.country === filters.country);
  return rows.map(mapAnimalToPuppy);
}

export async function getPuppyById(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("animals")
    .select(animalSelect)
    .eq("id", id)
    .eq("listing_category", "breeder_puppy")
    .eq("is_published", true)
    .single();
  if (error) throw error;
  return mapAnimalToPuppy(data as unknown as AnimalRow);
}

type LitterRow = {
  id: string;
  code: string;
  birth_date: string | null;
  expected_birth_date: string | null;
  ready_date: string | null;
  puppy_count: number | null;
  status: string;
  registration_number: string | null;
  association: string | null;
  breeds: { name: string } | null;
  mother: { registered_name: string; profile_image_url: string | null } | null;
  father: { registered_name: string } | null;
  organisations: { id: string; name: string; slug: string } | null;
};

function toLitterStatus(status: string): Litter["status"] {
  if (status === "planned") return "planned";
  if (status === "born") return "born";
  return "ready";
}

type LitterCounts = { available: number; reserved: number };

// One query for however many litters are being mapped, instead of two count queries per litter —
// same batching approach as Phase 1's foundation adoption counts and this phase's breeder counts.
async function litterCountsBatch(litterIds: string[]): Promise<Map<string, LitterCounts>> {
  const result = new Map<string, LitterCounts>();
  if (litterIds.length === 0) return result;
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("animals")
    .select("litter_id, availability_status")
    .in("litter_id", litterIds)
    .in("availability_status", ["available", "applications_open", "reserved"]);
  if (error) throw error;
  for (const row of (data ?? []) as { litter_id: string | null; availability_status: string }[]) {
    if (!row.litter_id) continue;
    const counts = result.get(row.litter_id) ?? { available: 0, reserved: 0 };
    if (row.availability_status === "reserved") counts.reserved++;
    else counts.available++;
    result.set(row.litter_id, counts);
  }
  return result;
}

function mapLitterRow(l: LitterRow, counts: LitterCounts): Litter {
  return {
    id: l.id,
    code: l.code,
    breed: l.breeds?.name ?? "Mixed breed",
    birthDate: l.birth_date ?? l.expected_birth_date ?? "",
    readyDate: l.ready_date ?? "",
    mother: l.mother?.registered_name ?? "Not on file",
    father: l.father?.registered_name ?? "Not on file",
    breederId: l.organisations?.id ?? "",
    breederName: l.organisations?.name ?? "",
    breederSlug: l.organisations?.slug ?? "",
    kennel: l.organisations?.name ?? "",
    puppyCount: l.puppy_count ?? 0,
    available: counts.available,
    reserved: counts.reserved,
    waitingList: 0,
    status: toLitterStatus(l.status),
    image: l.mother?.profile_image_url ?? placeholderImg,
    registration:
      [l.association, l.registration_number].filter(Boolean).join(" ") || "Not registered yet",
  };
}

async function mapLitterRows(rows: LitterRow[]): Promise<Litter[]> {
  const counts = await litterCountsBatch(rows.map((l) => l.id));
  return rows.map((l) => mapLitterRow(l, counts.get(l.id) ?? { available: 0, reserved: 0 }));
}

const litterSelect =
  "id, code, birth_date, expected_birth_date, ready_date, puppy_count, status, registration_number, association, breeds(name), mother:parent_dogs!litters_mother_id_fkey(registered_name, profile_image_url), father:parent_dogs!litters_father_id_fkey(registered_name), organisations!litters_kennel_id_fkey(id, name, slug)";

export async function listPublishedLitters(status?: string) {
  const supabase = getSupabaseBrowserClient();
  let query = supabase.from("litters").select(litterSelect).eq("is_published", true);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return mapLitterRows((data ?? []) as unknown as LitterRow[]);
}

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  org_type: string;
  description: string | null;
  city: string | null;
  country: string | null;
  years_experience: number | null;
  association_name: string | null;
  verification_status: string;
  response_time: string | null;
  cover_image_url: string | null;
  logo_url: string | null;
  transport_available: boolean;
  owner_user_id: string;
  profiles: { display_name: string | null } | null;
};

// Batched breed lists and available-puppy counts for one or many kennels in two queries total —
// avoids the N+1 pattern of firing 2 queries per kennel when mapping a whole directory page (the
// exact same fix Phase 1 applied to foundations' adoption counts).
async function orgBreedsBatch(orgIds: string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (orgIds.length === 0) return result;
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("parent_dogs")
    .select("kennel_id, breeds(name)")
    .in("kennel_id", orgIds);
  if (error) throw error;
  const sets = new Map<string, Set<string>>();
  for (const row of (data ?? []) as unknown as {
    kennel_id: string;
    breeds: { name: string } | null;
  }[]) {
    if (!row.breeds?.name) continue;
    const set = sets.get(row.kennel_id) ?? new Set<string>();
    set.add(row.breeds.name);
    sets.set(row.kennel_id, set);
  }
  for (const [orgId, set] of sets) result.set(orgId, Array.from(set));
  return result;
}

async function orgAvailablePuppyCounts(orgIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (orgIds.length === 0) return counts;
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("animals")
    .select("organization_id")
    .in("organization_id", orgIds)
    .eq("is_published", true)
    .in("availability_status", ["available", "applications_open"]);
  if (error) throw error;
  for (const row of (data ?? []) as { organization_id: string | null }[]) {
    if (!row.organization_id) continue;
    counts.set(row.organization_id, (counts.get(row.organization_id) ?? 0) + 1);
  }
  return counts;
}

export function mapOrgToBreeder(o: OrgRow, breeds: string[], availablePuppies: number): Breeder {
  return {
    id: o.id,
    name: o.profiles?.display_name ?? o.name,
    kennel: o.name,
    slug: o.slug,
    breeds,
    region: o.city ?? "",
    city: o.city ?? "",
    country: o.country ?? "",
    years: o.years_experience ?? 0,
    rating: 0,
    reviewCount: 0,
    verified: o.verification_status === "approved",
    association: o.association_name ?? "",
    availablePuppies,
    description: o.description ?? "",
    cover: o.cover_image_url ?? placeholderImg,
    logo: o.logo_url ?? placeholderImg,
    handovers: 0,
    responseTime: o.response_time ?? "",
  };
}

export async function mapOrgsToBreeders(orgs: OrgRow[]): Promise<Breeder[]> {
  const [breedsByOrg, puppyCountsByOrg] = await Promise.all([
    orgBreedsBatch(orgs.map((o) => o.id)),
    orgAvailablePuppyCounts(orgs.map((o) => o.id)),
  ]);
  return orgs.map((o) =>
    mapOrgToBreeder(o, breedsByOrg.get(o.id) ?? [], puppyCountsByOrg.get(o.id) ?? 0),
  );
}

export const orgSelect =
  "id, name, slug, org_type, description, city, country, years_experience, association_name, verification_status, response_time, cover_image_url, logo_url, transport_available, owner_user_id, profiles!organisations_owner_user_id_fkey(display_name)";
export type { OrgRow };

export async function listApprovedKennels() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("organisations")
    .select(orgSelect)
    .eq("org_type", "kennel")
    .eq("verification_status", "approved")
    .eq("is_public", true);
  if (error) throw error;
  return mapOrgsToBreeders((data ?? []) as unknown as OrgRow[]);
}

export async function getKennelBySlug(slug: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("organisations")
    .select(orgSelect)
    .eq("slug", slug)
    .eq("org_type", "kennel")
    .single();
  if (error) throw error;
  const [breeders] = await mapOrgsToBreeders([data as unknown as OrgRow]);
  return breeders;
}

// Foundations/shelters/rescues share the `organisations` table with kennels (see `org_type`), but
// are presented with adoption-oriented framing (mission, "dogs available for adoption") rather than
// the breeder framing of Breeder/mapOrgToBreeder — hence a separate shape instead of overloading it.
// FOUNDATION_ORG_TYPES/FoundationOrgType/toFoundationOrgType live in org-routing.ts (imported
// above) so they're pure, unit-tested, and shared with buyer-activity.ts instead of each declaring
// an identical local copy.
export type { FoundationOrgType };

export type Foundation = {
  id: string;
  name: string;
  slug: string;
  orgType: FoundationOrgType;
  city: string;
  country: string;
  verified: boolean;
  association: string;
  description: string;
  cover: string;
  logo: string;
  transportAvailable: boolean;
  availableForAdoption: number;
  responseTime: string;
};

// Batched count for one or many orgs in a single query — avoids the N+1 pattern of firing one
// count query per organisation when mapping a whole directory page. A genuinely open adoption
// listing means published, listed as "adoption" (never a breeder puppy or private rehoming, which
// use different listing_category values), and still available/open to applications.
export async function orgAvailableAdoptionCounts(orgIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (orgIds.length === 0) return counts;
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("animals")
    .select("organization_id")
    .in("organization_id", orgIds)
    .eq("listing_category", "adoption")
    .eq("is_published", true)
    .in("availability_status", ["available", "applications_open"]);
  // Thrown, not swallowed into a 0 — a failed count query must not read as "no dogs available"
  // when the real answer is unknown.
  if (error) throw error;
  for (const row of (data ?? []) as { organization_id: string | null }[]) {
    if (!row.organization_id) continue;
    counts.set(row.organization_id, (counts.get(row.organization_id) ?? 0) + 1);
  }
  return counts;
}

export function mapOrgToFoundation(o: OrgRow, availableForAdoption: number): Foundation {
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    orgType: toFoundationOrgType(o.org_type),
    city: o.city ?? "",
    country: o.country ?? "",
    verified: o.verification_status === "approved",
    association: o.association_name ?? "",
    description: o.description ?? "",
    cover: o.cover_image_url ?? placeholderImg,
    logo: o.logo_url ?? placeholderImg,
    transportAvailable: o.transport_available,
    availableForAdoption,
    responseTime: o.response_time ?? "",
  };
}

export async function listApprovedFoundations() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("organisations")
    .select(orgSelect)
    .in("org_type", FOUNDATION_ORG_TYPES)
    .eq("verification_status", "approved")
    .eq("is_public", true);
  if (error) throw error;
  const orgs = (data ?? []) as unknown as OrgRow[];
  const counts = await orgAvailableAdoptionCounts(orgs.map((o) => o.id));
  return orgs.map((o) => mapOrgToFoundation(o, counts.get(o.id) ?? 0));
}

// Returns null only for a genuine "no such foundation" (or one that isn't public/approved yet —
// same rule as listApprovedFoundations, so a pending/private org can't be reached directly by
// guessing its slug). A real query failure (network, RLS denial, etc.) throws instead of being
// coerced into the same null/not-found result — see _public.foundations.$slug.tsx's loader, which
// no longer swallows every error into a 404.
export async function getFoundationBySlug(slug: string): Promise<Foundation | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("organisations")
    .select(orgSelect)
    .eq("slug", slug)
    .in("org_type", FOUNDATION_ORG_TYPES)
    .eq("verification_status", "approved")
    .eq("is_public", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const org = data as unknown as OrgRow;
  const counts = await orgAvailableAdoptionCounts([org.id]);
  return mapOrgToFoundation(org, counts.get(org.id) ?? 0);
}

export async function listPuppiesForKennel(kennelId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("animals")
    .select(animalSelect)
    .eq("organization_id", kennelId)
    .eq("listing_category", "breeder_puppy")
    .eq("is_published", true);
  if (error) throw error;
  return ((data ?? []) as unknown as AnimalRow[]).map(mapAnimalToPuppy);
}

export async function listLittersForKennel(kennelId: string, status?: string) {
  const supabase = getSupabaseBrowserClient();
  let query = supabase
    .from("litters")
    .select(litterSelect)
    .eq("kennel_id", kennelId)
    .eq("is_published", true);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return mapLitterRows((data ?? []) as unknown as LitterRow[]);
}

export async function getLitterById(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("litters").select(litterSelect).eq("id", id).single();
  if (error) throw error;
  const [litter] = await mapLitterRows([data as unknown as LitterRow]);
  return litter;
}

export type ParentDogInfo = {
  name: string;
  pedigree: string;
  image: string;
  tests: string[];
  titles: string;
  description: string;
};

function mapParentDog(
  row: {
    registered_name: string;
    pedigree_number: string | null;
    profile_image_url: string | null;
    health_tests: unknown;
    titles: string | null;
    description: string | null;
  } | null,
): ParentDogInfo | null {
  if (!row) return null;
  const tests = Array.isArray(row.health_tests)
    ? (row.health_tests as { test?: string }[]).map((t) => t.test).filter((t): t is string => !!t)
    : [];
  return {
    name: row.registered_name,
    pedigree: row.pedigree_number ?? "Not on file",
    image: row.profile_image_url ?? placeholderImg,
    tests,
    titles: row.titles ?? "",
    description: row.description ?? "",
  };
}

export async function getLitterParents(litterId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("litters")
    .select(
      "mother:parent_dogs!litters_mother_id_fkey(registered_name, pedigree_number, profile_image_url, health_tests, titles, description), father:parent_dogs!litters_father_id_fkey(registered_name, pedigree_number, profile_image_url, health_tests, titles, description)",
    )
    .eq("id", litterId)
    .single();
  if (error) throw error;
  const row = data as unknown as {
    mother: Parameters<typeof mapParentDog>[0];
    father: Parameters<typeof mapParentDog>[0];
  };
  return { mother: mapParentDog(row.mother), father: mapParentDog(row.father) };
}

type ParentDogRow = { sex: "male" | "female" } & NonNullable<Parameters<typeof mapParentDog>[0]>;

export async function listParentDogsForKennel(
  kennelId: string,
): Promise<(ParentDogInfo & { sex: "male" | "female" })[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("parent_dogs")
    .select(
      "sex, registered_name, pedigree_number, profile_image_url, health_tests, titles, description",
    )
    .eq("kennel_id", kennelId)
    .eq("is_active", true);
  if (error) throw error;
  return ((data ?? []) as unknown as ParentDogRow[]).map((row) => ({
    ...mapParentDog(row)!,
    sex: row.sex,
  }));
}

export async function getKennelById(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("organisations")
    .select(orgSelect)
    .eq("id", id)
    .single();
  if (error) throw error;
  const [breeders] = await mapOrgsToBreeders([data as unknown as OrgRow]);
  return breeders;
}

// Adoption listings are `animals` rows with listing_category='adoption' — a rescue/shelter dog,
// not a puppy, so this is a separate shape from Puppy (age is often approximate, there's no
// litter/ready-date, "price" reads as an adoption fee) rather than forcing it through
// mapAnimalToPuppy's "X wks old" / "View puppy" framing.
export type AdoptionListing = {
  id: string;
  category: "adoption" | "private_rehoming";
  name: string;
  breed: string;
  sex: "Male" | "Female" | "Unknown";
  approxAge: string;
  color: string;
  description: string;
  temperament: string | null;
  idealHome: string | null;
  adoptionFee: number | null;
  currency: string;
  city: string;
  country: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  // null for private rehoming (no organisation at all) — never assume "foundation" for a listing
  // that might actually be a shelter or rescue-type org; see foundationOrgTypeLabel.
  orgType: FoundationOrgType | null;
  verified: boolean;
  transportAvailable: boolean;
  image: string;
  gallery: string[];
};

type AdoptionAnimalRow = AnimalRow & {
  listing_category: "adoption" | "private_rehoming";
  approximate_age: string | null;
  profiles: { display_name: string | null; city: string | null; country: string | null } | null;
};

function ageLabelFrom(dob: string | null, approx: string | null): string {
  if (approx) return approx;
  if (!dob) return "Age unknown";
  const years = (Date.now() - new Date(dob).getTime()) / (365.25 * 86_400_000);
  if (years < 1) return "Under 1 year";
  return `${Math.floor(years)} year${Math.floor(years) === 1 ? "" : "s"}`;
}

export function mapAnimalToAdoption(a: AdoptionAnimalRow): AdoptionListing {
  const images = a.animal_images?.length
    ? a.animal_images
        .slice()
        .sort((x, y) => Number(y.is_cover) - Number(x.is_cover))
        .map((i) => i.image_url)
    : [placeholderImg];
  const isPrivate = a.listing_category === "private_rehoming";
  return {
    id: a.id,
    category: a.listing_category,
    name: a.name,
    breed: a.breeds?.name ?? "Mixed breed",
    sex: a.sex === "female" ? "Female" : a.sex === "male" ? "Male" : "Unknown",
    approxAge: ageLabelFrom(a.date_of_birth, a.approximate_age),
    color: a.color ?? "",
    description: a.description ?? "",
    temperament: a.temperament,
    idealHome: a.ideal_home,
    adoptionFee: a.price,
    currency: a.currency ?? "PLN",
    city: isPrivate ? (a.profiles?.city ?? "") : (a.organisations?.city ?? ""),
    country: isPrivate ? (a.profiles?.country ?? "") : (a.organisations?.country ?? ""),
    orgId: a.organisations?.id ?? "",
    orgName: isPrivate
      ? (a.profiles?.display_name ?? "Private owner")
      : (a.organisations?.name ?? ""),
    orgSlug: a.organisations?.slug ?? "",
    orgType: !isPrivate && a.organisations ? toFoundationOrgType(a.organisations.org_type) : null,
    verified: !isPrivate && a.organisations?.verification_status === "approved",
    transportAvailable: a.transport_available,
    image: images[0],
    gallery: images,
  };
}

const adoptionSelect =
  "id, listing_category, name, sex, color, date_of_birth, approximate_age, price, currency, availability_status, transport_available, description, temperament, ideal_home, litter_id, organization_id, breeds(name), animal_images(image_url, is_cover), litters(ready_date), organisations!animals_organization_id_fkey(id, name, slug, city, country, verification_status, response_time, org_type), profiles!animals_owner_profile_id_fkey(display_name, city, country)";

export async function listPublishedAdoptions() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("animals")
    .select(adoptionSelect)
    .in("listing_category", ["adoption", "private_rehoming"])
    .eq("is_published", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as AdoptionAnimalRow[]).map(mapAnimalToAdoption);
}

export async function listPublishedAdoptionsForOrg(orgId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("animals")
    .select(adoptionSelect)
    .eq("organization_id", orgId)
    .eq("listing_category", "adoption")
    .eq("is_published", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as AdoptionAnimalRow[]).map(mapAnimalToAdoption);
}

export async function getAdoptionById(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("animals")
    .select(adoptionSelect)
    .eq("id", id)
    .in("listing_category", ["adoption", "private_rehoming"])
    .eq("is_published", true)
    .single();
  if (error) throw error;
  return mapAnimalToAdoption(data as unknown as AdoptionAnimalRow);
}

export type ChampionEntry = { dogName: string; titles: string[] };

export async function listVerifiedChampionsForKennel(kennelId: string): Promise<ChampionEntry[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("achievements")
    .select("title, parent_dogs(registered_name)")
    .eq("kennel_id", kennelId)
    .eq("verification_status", "approved");
  if (error) throw error;
  const byDog = new Map<string, ChampionEntry>();
  for (const row of (data ?? []) as unknown as {
    title: string;
    parent_dogs: { registered_name: string } | null;
  }[]) {
    const name = row.parent_dogs?.registered_name ?? "Unknown dog";
    const entry = byDog.get(name) ?? { dogName: name, titles: [] };
    entry.titles.push(row.title);
    byDog.set(name, entry);
  }
  return Array.from(byDog.values());
}
