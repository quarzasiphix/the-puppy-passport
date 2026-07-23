import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Puppy, Litter, Breeder, PuppyStatus } from "@/lib/mock-data";
import type { AnimalAvailabilityStatus, LitterStatus } from "@/lib/supabase/enums";
import placeholderImg from "@/assets/puppy-1.jpg";

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

// Stage IR-2: the search filters below are applied server-side (SQL WHERE, not a post-fetch JS
// .filter() over every published row) so they scale independently of how many puppies are
// published — the pre-IR-2 version fetched every published row unconditionally and filtered
// breed/country in memory (Stage BP's own audit finding, deliberately deferred to this dedicated
// stage rather than fixed speculatively ahead of it). `page`/`pageSize` are optional and additive:
// every existing call site (`_public.index.tsx`, `_public.find-your-dog.tsx`,
// `_public.find-a-dog.tsx`) calls this with no arguments at all and keeps returning a plain array
// exactly as before -- nothing about this change requires a frontend update. `countPublishedPuppies`
// is the paired total-count query a future paginated search UI would need alongside a page of
// results (kept as a separate lightweight query rather than changing this function's return shape,
// matching the existing `countAnimalsByStatus`/`mapLitterRows` split above).
export type PuppySearchFilters = {
  breed?: string;
  country?: string;
  sex?: "male" | "female";
  priceMin?: number;
  priceMax?: number;
  page?: number;
  pageSize?: number;
};

// Both breeds and organisations are nullable FKs on animals (a listing can genuinely have no
// breed set, or -- in principle -- no organisation). PostgREST only excludes a parent row whose
// embedded resource fails an embedded-column filter when that relation is marked `!inner` in the
// select string; without it, a non-matching row is still returned with the embedded object simply
// null instead of being filtered out (confirmed empirically against this local instance before
// relying on it -- a `breeds(name)` select with `.eq("breeds.name", "X")` returned every row,
// each with `breeds: null`, not just the matching ones). So `!inner` is only ever added to the
// specific relation actually being filtered on, never unconditionally -- otherwise a listing with
// no breed set would silently vanish from an unfiltered "all puppies" query.
function animalSelectFor(filters?: PuppySearchFilters): string {
  const breedsPart = filters?.breed ? "breeds!inner(name)" : "breeds(name)";
  const orgsPart = filters?.country
    ? "organisations!animals_organization_id_fkey!inner(id, name, slug, city, country, verification_status, response_time)"
    : "organisations!animals_organization_id_fkey(id, name, slug, city, country, verification_status, response_time)";
  return `id, name, sex, color, date_of_birth, price, currency, availability_status, transport_available, description, temperament, ideal_home, litter_id, organization_id, ${breedsPart}, animal_images(image_url, is_cover), litters(ready_date), ${orgsPart}`;
}

// breed/country join through related tables (breeds.name, organisations.country) -- PostgREST
// filters a joined column with `related.column=eq.value` dot notation, not a plain .eq() (which
// only applies to columns on animals itself); everything else genuinely is a direct column. Not
// factored into a shared generic helper: supabase-js's query builder type narrows on each chained
// call in a way a generic wrapper can't cleanly express, and the two real call sites are short
// enough that duplicating these five lines is clearer than fighting the type checker for it.
// Bot 1 finding Q-1: pagination was fully built (page/pageSize below) but every real call site
// left both undefined, so the query ran with no .range() at all -- a genuinely unbounded fetch of
// every published puppy in the marketplace, safe today only because the seeded/demo dataset is
// small. DEFAULT_PAGE_SIZE closes that regardless of whether a future caller remembers to pass
// one -- generous enough to be invisible against the current dataset (none of the 3 real call
// sites, all unpaginated marketplace browse pages, currently return anywhere near this many rows),
// but a real, finite cap rather than "however many rows exist."
const DEFAULT_PAGE_SIZE = 200;

export async function listPublishedPuppies(filters?: PuppySearchFilters) {
  const supabase = getSupabaseBrowserClient();
  let query = supabase
    .from("animals")
    .select(animalSelectFor(filters))
    .eq("listing_category", "breeder_puppy")
    .eq("is_published", true);
  if (filters?.breed) query = query.eq("breeds.name", filters.breed);
  if (filters?.country) query = query.eq("organisations.country", filters.country);
  if (filters?.sex) query = query.eq("sex", filters.sex);
  if (filters?.priceMin !== undefined) query = query.gte("price", filters.priceMin);
  if (filters?.priceMax !== undefined) query = query.lte("price", filters.priceMax);
  // Stage XR-17 (cursor stability): `created_at` alone is not a stable sort key -- rows inserted
  // in the same statement (e.g. several puppies from one litter added at once) share the exact
  // same `now()` value, since Postgres evaluates it once per statement, not once per row. Without
  // a secondary, genuinely unique tie-breaker, `.range()`-based pagination has no guaranteed
  // ordering among tied rows, so a puppy could appear on two pages or be silently skipped
  // depending on how each separate query happens to resolve the tie. `id` is unique and stable,
  // closing the gap with no visible behaviour change for the common case (distinct timestamps).
  query = query.order("created_at", { ascending: false }).order("id", { ascending: true });
  const page = filters?.page ?? 0;
  const pageSize = filters?.pageSize ?? DEFAULT_PAGE_SIZE;
  const from = page * pageSize;
  query = query.range(from, from + pageSize - 1);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as AnimalRow[];
  return rows.map(mapAnimalToPuppy);
}

export async function countPublishedPuppies(filters?: PuppySearchFilters): Promise<number> {
  const supabase = getSupabaseBrowserClient();
  let query = supabase
    .from("animals")
    .select(animalSelectFor(filters), { count: "exact", head: true })
    .eq("listing_category", "breeder_puppy")
    .eq("is_published", true);
  if (filters?.breed) query = query.eq("breeds.name", filters.breed);
  if (filters?.country) query = query.eq("organisations.country", filters.country);
  if (filters?.sex) query = query.eq("sex", filters.sex);
  if (filters?.priceMin !== undefined) query = query.gte("price", filters.priceMin);
  if (filters?.priceMax !== undefined) query = query.lte("price", filters.priceMax);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function getPuppyById(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("animals")
    .select(animalSelect)
    .eq("id", id)
    .eq("listing_category", "breeder_puppy")
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

async function countAnimalsByStatus(litterId: string, statuses: AnimalAvailabilityStatus[]) {
  const supabase = getSupabaseBrowserClient();
  const { count } = await supabase
    .from("animals")
    .select("*", { count: "exact", head: true })
    .eq("litter_id", litterId)
    .in("availability_status", statuses);
  return count ?? 0;
}

function buildLitter(l: LitterRow, available: number, reserved: number): Litter {
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
    available,
    reserved,
    waitingList: 0,
    status: toLitterStatus(l.status),
    image: l.mother?.profile_image_url ?? placeholderImg,
    registration:
      [l.association, l.registration_number].filter(Boolean).join(" ") || "Not registered yet",
  };
}

async function mapLitterRow(l: LitterRow): Promise<Litter> {
  const [available, reserved] = await Promise.all([
    countAnimalsByStatus(l.id, ["available", "applications_open"]),
    countAnimalsByStatus(l.id, ["reserved"]),
  ]);
  return buildLitter(l, available, reserved);
}

// Batched counterpart to mapLitterRow, for listing pages rendering N litters at once. The
// per-row version above issues 2 count queries per litter (2N total for a page of N) — fine for
// a single litter detail page, but a real N+1 pattern on a listing page. This does the same two
// counts in a single query total (one status-in-array select across every litter id, grouped
// client-side), independent of how many litters are on the page.
async function countAnimalsByStatusForLitters(
  litterIds: string[],
): Promise<Map<string, { available: number; reserved: number }>> {
  const counts = new Map<string, { available: number; reserved: number }>();
  if (litterIds.length === 0) return counts;

  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase
    .from("animals")
    .select("litter_id, availability_status")
    .in("litter_id", litterIds)
    .in("availability_status", ["available", "applications_open", "reserved"]);

  for (const row of (data ?? []) as { litter_id: string | null; availability_status: string }[]) {
    if (!row.litter_id) continue;
    const entry = counts.get(row.litter_id) ?? { available: 0, reserved: 0 };
    if (row.availability_status === "reserved") entry.reserved += 1;
    else entry.available += 1;
    counts.set(row.litter_id, entry);
  }
  return counts;
}

async function mapLitterRows(rows: LitterRow[]): Promise<Litter[]> {
  const counts = await countAnimalsByStatusForLitters(rows.map((l) => l.id));
  return rows.map((l) => {
    const entry = counts.get(l.id) ?? { available: 0, reserved: 0 };
    return buildLitter(l, entry.available, entry.reserved);
  });
}

const litterSelect =
  "id, code, birth_date, expected_birth_date, ready_date, puppy_count, status, registration_number, association, breeds(name), mother:parent_dogs!litters_mother_id_fkey(registered_name, profile_image_url), father:parent_dogs!litters_father_id_fkey(registered_name), organisations!litters_kennel_id_fkey(id, name, slug)";

export async function listPublishedLitters(status?: LitterStatus) {
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

async function orgBreeds(orgId: string): Promise<string[]> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.from("parent_dogs").select("breeds(name)").eq("kennel_id", orgId);
  const names = new Set<string>();
  for (const row of (data ?? []) as unknown as { breeds: { name: string } | null }[]) {
    if (row.breeds?.name) names.add(row.breeds.name);
  }
  return Array.from(names);
}

async function orgAvailablePuppyCount(orgId: string) {
  const supabase = getSupabaseBrowserClient();
  const { count } = await supabase
    .from("animals")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("is_published", true)
    .in("availability_status", ["available", "applications_open"]);
  return count ?? 0;
}

function buildBreeder(o: OrgRow, breeds: string[], availablePuppies: number): Breeder {
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

export async function mapOrgToBreeder(o: OrgRow): Promise<Breeder> {
  const [breeds, availablePuppies] = await Promise.all([
    orgBreeds(o.id),
    orgAvailablePuppyCount(o.id),
  ]);
  return buildBreeder(o, breeds, availablePuppies);
}

// Batched counterpart to mapOrgToBreeder, for listing pages rendering N organisations at once —
// same N+1 reasoning as countAnimalsByStatusForLitters above: 2 queries total instead of 2N.
async function orgBreedsAndCountsBatch(
  orgIds: string[],
): Promise<Map<string, { breeds: string[]; availablePuppies: number }>> {
  const result = new Map<string, { breeds: string[]; availablePuppies: number }>();
  if (orgIds.length === 0) return result;

  const supabase = getSupabaseBrowserClient();
  const [breedsResult, puppiesResult] = await Promise.all([
    supabase.from("parent_dogs").select("kennel_id, breeds(name)").in("kennel_id", orgIds),
    supabase
      .from("animals")
      .select("organization_id")
      .in("organization_id", orgIds)
      .eq("is_published", true)
      .in("availability_status", ["available", "applications_open"]),
  ]);

  const breedSets = new Map<string, Set<string>>();
  for (const row of (breedsResult.data ?? []) as unknown as {
    kennel_id: string | null;
    breeds: { name: string } | null;
  }[]) {
    if (!row.kennel_id) continue;
    const set = breedSets.get(row.kennel_id) ?? new Set<string>();
    if (row.breeds?.name) set.add(row.breeds.name);
    breedSets.set(row.kennel_id, set);
  }

  const puppyCounts = new Map<string, number>();
  for (const row of (puppiesResult.data ?? []) as { organization_id: string | null }[]) {
    if (!row.organization_id) continue;
    puppyCounts.set(row.organization_id, (puppyCounts.get(row.organization_id) ?? 0) + 1);
  }

  for (const orgId of orgIds) {
    result.set(orgId, {
      breeds: Array.from(breedSets.get(orgId) ?? []),
      availablePuppies: puppyCounts.get(orgId) ?? 0,
    });
  }
  return result;
}

export async function mapOrgsToBreeders(rows: OrgRow[]): Promise<Breeder[]> {
  const byOrg = await orgBreedsAndCountsBatch(rows.map((o) => o.id));
  return rows.map((o) => {
    const entry = byOrg.get(o.id) ?? { breeds: [], availablePuppies: 0 };
    return buildBreeder(o, entry.breeds, entry.availablePuppies);
  });
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
  return mapOrgToBreeder(data as unknown as OrgRow);
}

// Foundations/shelters/rescues share the `organisations` table with kennels (see `org_type`), but
// are presented with adoption-oriented framing (mission, "dogs available for adoption") rather than
// the breeder framing of Breeder/mapOrgToBreeder — hence a separate shape instead of overloading it.
const FOUNDATION_ORG_TYPES = ["foundation", "shelter", "rescue"] as const;
export type FoundationOrgType = (typeof FOUNDATION_ORG_TYPES)[number];

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

export function toFoundationOrgType(orgType: string): FoundationOrgType {
  return (FOUNDATION_ORG_TYPES as readonly string[]).includes(orgType)
    ? (orgType as FoundationOrgType)
    : "foundation";
}

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

export async function listLittersForKennel(kennelId: string, status?: LitterStatus) {
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
  return mapLitterRow(data as unknown as LitterRow);
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
  return mapOrgToBreeder(data as unknown as OrgRow);
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
