import type { SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "./lib.ts";
import { anonClient, errorBody, json } from "./lib.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---- anon-safe row shapes (hand-picked columns, no private/operational fields) ----------------

interface OrgRow {
  id: string;
  slug: string;
  name: string;
  org_type: string;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  country: string | null;
  city: string | null;
  public_location: string | null;
  years_experience: number | null;
  transport_available: boolean | null;
  international_transport_available: boolean | null;
  plan: string;
}

interface SiteConfigRow {
  organisation_id: string;
  theme: string;
  primary_color: string | null;
  visible_sections: string[];
  section_order: string[];
  default_language: string;
  supported_languages: string[];
  contact_mode: string;
  show_anemalo_branding: boolean;
}

interface PublicDogRow {
  id: string;
  slug: string | null;
  registered_name: string | null;
  call_name: string | null;
  sex: string | null;
  breed_id: string | null;
  date_of_birth: string | null;
  date_of_death: string | null;
  life_status: string | null;
  color: string | null;
  titles: string | null;
  profile_image_url: string | null;
  health_tests: unknown;
  description: string | null;
}

interface LitterRow {
  id: string;
  code: string | null;
  breed_id: string | null;
  mother_id: string | null;
  father_id: string | null;
  birth_date: string | null;
  expected_birth_date: string | null;
  ready_date: string | null;
  puppy_count: number | null;
  male_count: number | null;
  female_count: number | null;
  description: string | null;
  status: string | null;
}

interface AnimalRow {
  id: string;
  slug: string | null;
  litter_id: string | null;
  name: string | null;
  listing_category: string | null;
  breed_id: string | null;
  sex: string | null;
  color: string | null;
  date_of_birth: string | null;
  price: number | null;
  currency: string | null;
  description: string | null;
  temperament: string | null;
  ideal_home: string | null;
  availability_status: string | null;
  is_featured: boolean | null;
}

interface AnimalImageRow {
  id: string;
  animal_id: string;
  image_url: string;
  display_order: number | null;
  is_cover: boolean | null;
  caption: string | null;
}

interface AchievementRow {
  id: string;
  parent_dog_id: string | null;
  title: string;
  issuing_body: string | null;
  achieved_on: string | null;
}

const ORG_COLS =
  "id, slug, name, org_type, description, logo_url, cover_image_url, country, city, public_location, years_experience, transport_available, international_transport_available, plan";
const CONFIG_COLS =
  "organisation_id, theme, primary_color, visible_sections, section_order, default_language, supported_languages, contact_mode, show_anemalo_branding";
const PUBLIC_DOG_COLS =
  "id, slug, registered_name, call_name, sex, breed_id, date_of_birth, date_of_death, life_status, color, titles, profile_image_url, health_tests, description";
const LITTER_COLS =
  "id, code, breed_id, mother_id, father_id, birth_date, expected_birth_date, ready_date, puppy_count, male_count, female_count, description, status";
const ANIMAL_COLS =
  "id, slug, litter_id, name, listing_category, breed_id, sex, color, date_of_birth, price, currency, description, temperament, ideal_home, availability_status, is_featured";
const IMAGE_COLS = "id, animal_id, image_url, display_order, is_cover, caption";
const ACHIEVEMENT_COLS = "id, parent_dog_id, title, issuing_body, achieved_on";

async function resolveOrg(sb: SupabaseClient, org: string): Promise<OrgRow | null> {
  const column = UUID_RE.test(org) ? "id" : "slug";
  const { data, error } = await sb
    .from("organisations")
    .select(ORG_COLS)
    .eq(column, org)
    .maybeSingle<OrgRow>();
  if (error) throw error;
  return data;
}

export interface SiteContentResponse {
  org: OrgRow;
  siteConfig: SiteConfigRow | null;
  dogs: PublicDogRow[];
  litters: LitterRow[];
  puppies: AnimalRow[];
  gallery: AnimalImageRow[];
  achievements: AchievementRow[];
  /** Sections with no Anemalo table yet — surfaced explicitly rather than faked as empty. */
  notImplemented: string[];
  generatedAt: string;
}

export async function handleSiteContent(env: Env, url: URL, origin: string | null): Promise<Response> {
  const org = url.searchParams.get("org")?.trim();
  if (!org) {
    return json(errorBody("missing_param", "Query parameter `org` (slug or id) is required."), {
      status: 400,
      env,
      origin,
    });
  }

  const sb = anonClient(env);

  const orgRow = await resolveOrg(sb, org);
  if (!orgRow) {
    // organisations has an anon SELECT policy of (verification_status = 'approved' AND is_public);
    // a suspended / unapproved / unknown org is indistinguishable here on purpose -> 404.
    return json(
      errorBody("org_not_found", `No public organisation matches "${org}".`),
      { status: 404, env, origin },
    );
  }

  const [configRes, dogsRes, littersRes, puppiesRes, achievementsRes] = await Promise.all([
    sb
      .from("organisation_site_configurations")
      .select(CONFIG_COLS)
      .eq("organisation_id", orgRow.id)
      .maybeSingle<SiteConfigRow>(),
    sb.from("public_dogs").select(PUBLIC_DOG_COLS).eq("kennel_id", orgRow.id).returns<PublicDogRow[]>(),
    sb.from("litters").select(LITTER_COLS).eq("kennel_id", orgRow.id).eq("is_published", true).returns<
      LitterRow[]
    >(),
    sb
      .from("animals")
      .select(ANIMAL_COLS)
      .eq("organization_id", orgRow.id)
      .eq("is_published", true)
      .returns<AnimalRow[]>(),
    sb
      .from("achievements")
      .select(ACHIEVEMENT_COLS)
      .eq("kennel_id", orgRow.id)
      .returns<AchievementRow[]>(),
  ]);

  for (const res of [configRes, dogsRes, littersRes, puppiesRes, achievementsRes]) {
    if (res.error) throw res.error;
  }

  const puppies = puppiesRes.data ?? [];
  const puppyIds = puppies.map((p) => p.id);
  let gallery: AnimalImageRow[] = [];
  if (puppyIds.length > 0) {
    const imagesRes = await sb
      .from("animal_images")
      .select(IMAGE_COLS)
      .in("animal_id", puppyIds)
      .returns<AnimalImageRow[]>();
    if (imagesRes.error) throw imagesRes.error;
    gallery = imagesRes.data ?? [];
  }

  const payload: SiteContentResponse = {
    org: orgRow,
    siteConfig: configRes.data ?? null,
    dogs: dogsRes.data ?? [],
    litters: littersRes.data ?? [],
    puppies,
    gallery,
    achievements: achievementsRes.data ?? [],
    notImplemented: ["testimonials", "posts"],
    generatedAt: new Date().toISOString(),
  };

  // Public, cacheable read. Short TTL + SWR mirrors Gryfin's 60s staleTime on the client.
  return json(payload, {
    env,
    origin,
    cache: "public, max-age=60, stale-while-revalidate=300",
  });
}
