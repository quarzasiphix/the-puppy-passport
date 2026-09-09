import type {
  DogEvidenceSummary,
  DogIdentity,
  DogSearchResult,
  PedigreeVerificationLevel,
} from "../types";
import { getPedigreeClient } from "./client";

// Columns of the `public.public_dogs` view (the curated anon-safe projection). The base `dogs`
// table is never read from the browser for public pages. Breed name and kennel slug are resolved
// with a separate batched lookup rather than a PostgREST embed — embedding *from a view* is not
// reliably auto-detected, and this keeps the view query a plain column select.
const DOG_VIEW_COLUMNS =
  "id, registered_name, call_name, sex, breed_id, date_of_birth, date_of_death, life_status, " +
  "color, pedigree_number, microchip_number, country_of_origin, kennel_name, kennel_id, " +
  "description, profile_image_url, titles, health_tests, slug, created_at, updated_at";

type RawDogView = {
  id: string;
  registered_name: string;
  call_name: string | null;
  sex: DogIdentity["sex"];
  breed_id: string | null;
  date_of_birth: string | null;
  date_of_death: string | null;
  life_status: DogIdentity["lifeStatus"];
  color: string | null;
  pedigree_number: string | null;
  microchip_number: string | null;
  country_of_origin: string | null;
  kennel_name: string | null;
  kennel_id: string | null;
  description: string | null;
  profile_image_url: string | null;
  titles: string | null;
  health_tests: unknown[] | null;
  slug: string | null;
  created_at: string;
  updated_at: string;
};

function mapDogIdentityBase(r: RawDogView): DogIdentity {
  return {
    id: r.id,
    registeredName: r.registered_name,
    callName: r.call_name,
    sex: r.sex,
    breedId: r.breed_id,
    breedName: null,
    dateOfBirth: r.date_of_birth,
    dateOfDeath: r.date_of_death,
    lifeStatus: r.life_status ?? "unknown",
    color: r.color,
    pedigreeNumber: r.pedigree_number,
    microchipNumber: r.microchip_number,
    countryOfOrigin: r.country_of_origin,
    kennelName: r.kennel_name,
    kennelId: r.kennel_id,
    kennelSlug: null,
    description: r.description,
    profileImageUrl: r.profile_image_url,
    titles: r.titles,
    healthTests: Array.isArray(r.health_tests) ? r.health_tests : [],
    slug: r.slug,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Fill breedName / kennelSlug on a batch of dogs with two small lookups against tables that are
 * already anon-readable (`breeds`, `organisations`). Best-effort — a failure just leaves the
 * ids in place. */
async function hydrateBreedAndKennel(dogs: DogIdentity[]): Promise<DogIdentity[]> {
  if (dogs.length === 0) return dogs;
  const supabase = getPedigreeClient();
  const breedIds = Array.from(new Set(dogs.map((d) => d.breedId).filter(Boolean))) as string[];
  const kennelIds = Array.from(new Set(dogs.map((d) => d.kennelId).filter(Boolean))) as string[];

  const [breedRes, kennelRes] = await Promise.all([
    breedIds.length
      ? supabase.from("breeds").select("id, name").in("id", breedIds)
      : Promise.resolve({ data: [], error: null }),
    kennelIds.length
      ? supabase.from("organisations").select("id, slug").in("id", kennelIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const breedName = new Map<string, string>();
  for (const b of (breedRes.data ?? []) as { id: string; name: string | null }[]) {
    if (b.name) breedName.set(b.id, b.name);
  }
  const kennelSlug = new Map<string, string>();
  for (const o of (kennelRes.data ?? []) as { id: string; slug: string | null }[]) {
    if (o.slug) kennelSlug.set(o.id, o.slug);
  }

  return dogs.map((d) => ({
    ...d,
    breedName: d.breedId ? (breedName.get(d.breedId) ?? null) : null,
    kennelSlug: d.kennelId ? (kennelSlug.get(d.kennelId) ?? null) : null,
  }));
}

export async function getDogById(id: string): Promise<DogIdentity | null> {
  const supabase = getPedigreeClient();
  const { data, error } = await supabase
    .from("public_dogs")
    .select(DOG_VIEW_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [dog] = await hydrateBreedAndKennel([mapDogIdentityBase(data as unknown as RawDogView)]);
  return dog;
}

export async function getDogBySlug(slug: string): Promise<DogIdentity | null> {
  const supabase = getPedigreeClient();
  const { data, error } = await supabase
    .from("public_dogs")
    .select(DOG_VIEW_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [dog] = await hydrateBreedAndKennel([mapDogIdentityBase(data as unknown as RawDogView)]);
  return dog;
}

export async function getDogsByIds(ids: string[]): Promise<Map<string, DogIdentity>> {
  const out = new Map<string, DogIdentity>();
  if (ids.length === 0) return out;
  const supabase = getPedigreeClient();
  const { data, error } = await supabase
    .from("public_dogs")
    .select(DOG_VIEW_COLUMNS)
    .in("id", Array.from(new Set(ids)));
  if (error) throw error;
  const hydrated = await hydrateBreedAndKennel(
    ((data ?? []) as unknown as RawDogView[]).map(mapDogIdentityBase),
  );
  for (const dog of hydrated) out.set(dog.id, dog);
  return out;
}

type RawSearchRow = {
  id: string;
  registered_name: string;
  call_name: string | null;
  sex: DogSearchResult["sex"];
  breed_id: string | null;
  date_of_birth: string | null;
  pedigree_number: string | null;
  microchip_number: string | null;
  kennel_name: string | null;
  kennel_id: string | null;
  profile_image_url: string | null;
  slug: string | null;
  match_rank: number | string | null;
  matched_on: string[] | null;
};

function mapSearchRow(r: RawSearchRow): DogSearchResult {
  return {
    id: r.id,
    registeredName: r.registered_name,
    callName: r.call_name,
    sex: r.sex,
    breedId: r.breed_id,
    dateOfBirth: r.date_of_birth,
    pedigreeNumber: r.pedigree_number,
    microchipNumber: r.microchip_number,
    kennelName: r.kennel_name,
    kennelId: r.kennel_id,
    profileImageUrl: r.profile_image_url,
    slug: r.slug,
    matchRank: typeof r.match_rank === "string" ? Number(r.match_rank) : (r.match_rank ?? 0),
    matchedOn: (r.matched_on ?? []).filter(
      (m): m is DogSearchResult["matchedOn"][number] =>
        m === "pedigree_number" || m === "microchip" || m === "registered_name",
    ),
  };
}

/**
 * Registration-number / microchip exact matches rank far above fuzzy name matches — this ordering
 * is load-bearing for import dedup, so it is computed in SQL (`search_dogs_ranked`), not here.
 * An empty query returns the most-recent dogs (browse mode).
 */
export async function searchDogs(query: string, limit = 25): Promise<DogSearchResult[]> {
  const supabase = getPedigreeClient();
  const { data, error } = await supabase.rpc("search_dogs_ranked", {
    p_query: query ?? "",
    p_limit: limit,
  });
  if (error) throw error;
  return ((data ?? []) as unknown as RawSearchRow[]).map(mapSearchRow);
}

type RawEvidenceRelRow = {
  id: string;
  verification_level: PedigreeVerificationLevel;
  status: string;
};

type RawEvidenceSourceRow = {
  source_type: string;
  review_state: string;
};

/**
 * Only reports evidence that actually exists — there is no blanket "verified" state. Reads the
 * dog's parent edges (verification levels) plus the accepted sources attached to those edges.
 */
export async function getDogEvidenceSummary(dogId: string): Promise<DogEvidenceSummary> {
  const supabase = getPedigreeClient();

  const { data: rels, error: relErr } = await supabase
    .from("public_dog_parent_relationships")
    .select("id, verification_level, status")
    .eq("child_dog_id", dogId);
  if (relErr) throw relErr;

  const relRows = (rels ?? []) as unknown as RawEvidenceRelRow[];
  const relIds = relRows.map((r) => r.id);

  let sourceRows: RawEvidenceSourceRow[] = [];
  if (relIds.length > 0) {
    const { data: srcs, error: srcErr } = await supabase
      .from("pedigree_relationship_sources")
      .select("pedigree_sources(source_type, review_state)")
      .in("relationship_id", relIds);
    if (srcErr) {
      // A signed-out visitor cannot read relationship_sources (authenticated-only RLS); the
      // verification levels on the edges themselves are enough to render the badges.
      sourceRows = [];
    } else {
      sourceRows = ((srcs ?? []) as unknown as { pedigree_sources: RawEvidenceSourceRow | null }[])
        .map((row) => row.pedigree_sources)
        .filter((s): s is RawEvidenceSourceRow => !!s);
    }
  }

  const levels = new Set(relRows.map((r) => r.verification_level));
  return {
    hasPedigreeDocument:
      levels.has("document_supported") ||
      levels.has("breeder_confirmed") ||
      levels.has("registry_verified") ||
      sourceRows.some(
        (s) =>
          s.review_state === "accepted" &&
          ["uploaded_scan", "uploaded_pdf", "uploaded_photo"].includes(s.source_type),
      ),
    parentRelationshipSupportedBySource:
      levels.has("document_supported") ||
      levels.has("breeder_confirmed") ||
      levels.has("registry_verified") ||
      levels.has("community_supported"),
    registryVerified: levels.has("registry_verified"),
    dnaVerified: sourceRows.some(
      (s) => s.source_type === "dna_evidence" && s.review_state === "accepted",
    ),
    hasDisputedRelationship: relRows.some((r) => r.status === "disputed"),
  };
}
