/**
 * import-gryfin.ts — one-off, idempotent, dry-run-first import of the Gryfin York kennel
 * (/p/grif) into the shared Anemalo Supabase project.
 *
 * DRY-RUN BY DEFAULT. Pass `--apply` to actually write. See docs/GRYFIN_IMPORT.md for the full
 * field-by-field mapping, conflict notes, and prerequisites. This file has NOT been run.
 *
 * Typecheck:  npx tsc -p scripts/tsconfig.json --noEmit
 * Run (dry):  node --experimental-strip-types scripts/import-gryfin.ts \
 *               --source-url ... --source-key ... --target-url ... --target-key ... \
 *               --owner-email owner@gryfinyork.pl
 * Run (apply): same + --apply   (plus optionally --ledger --achievements --create-breed)
 *
 * It NEVER fabricates a field. Anything Gryfin doesn't have is left null and reported.
 */
import { parseArgs } from "node:util";
import process from "node:process";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// --------------------------------------------------------------------------------------------
// CLI
// --------------------------------------------------------------------------------------------

const { values: flags } = parseArgs({
  options: {
    "source-url": { type: "string" },
    "source-key": { type: "string" },
    "target-url": { type: "string" },
    "target-key": { type: "string" },
    "owner-email": { type: "string" },
    apply: { type: "boolean", default: false },
    ledger: { type: "boolean", default: false },
    achievements: { type: "boolean", default: false },
    "create-breed": { type: "boolean", default: false },
  },
});

function required(name: keyof typeof flags): string {
  const v = flags[name];
  if (typeof v !== "string" || v.length === 0) {
    console.error(`Missing required --${name}`);
    process.exit(2);
  }
  return v;
}

const SOURCE_URL = required("source-url");
const SOURCE_KEY = required("source-key");
const TARGET_URL = required("target-url");
const TARGET_KEY = required("target-key");
const OWNER_EMAIL = required("owner-email");
const APPLY = flags.apply === true;
const USE_LEDGER = flags.ledger === true;
const IMPORT_ACHIEVEMENTS = flags.achievements === true;
const CREATE_BREED = flags["create-breed"] === true;

const DOG_SPECIES_ID = "a0000000-5000-0000-0000-000000000001"; // animals.species_id default
const SOURCE_TAG = "gryfin";

// --------------------------------------------------------------------------------------------
// Gryfin source row shapes — derived from /p/grif/c/src/lib/dbMapping.ts + /p/grif/p/src/lib/
// mappers.ts. RE-CONFIRM against the real Gryfin DB before --apply (see docs/GRYFIN_IMPORT.md).
// --------------------------------------------------------------------------------------------

interface GryfinDog {
  id: string;
  slug: string | null;
  name: string;
  registered_name: string | null;
  sex: "samiec" | "suczka" | string;
  color: string | null;
  birth_date: string | null;
  status: "aktywny" | "emerytura" | "nieaktywny" | string;
  visible_on_site: boolean | null;
  photo_url: string | null;
  photo_urls: string[] | null;
  featured: boolean | null;
  health_tests: string[] | null;
  achievements: string[] | null;
  pedigree: string | null;
  description: string | null;
  character: string | null;
}

interface GryfinLitter {
  id: string;
  slug: string | null;
  name: string | null;
  mother_id: string | null;
  father_id: string | null;
  planned_date: string | null;
  birth_date: string | null;
  puppies_count: number | null;
  expected_colors: string[] | null;
  status: string;
  visible_on_site: boolean | null;
  accepting_requests: boolean | null;
  description: string | null;
  extra: string | null;
}

interface GryfinPuppy {
  id: string;
  slug: string | null;
  litter_id: string | null;
  name: string | null;
  registered_name: string | null;
  sex: "samiec" | "suczka" | string;
  color: string | null;
  birth_date: string | null;
  ready_from: string | null;
  status: string;
  visible_on_site: boolean | null;
  featured: boolean | null;
  photo_url: string | null;
  photo_urls: string[] | null;
  description: string | null;
  temperament: string | null;
  socialization: string | null;
  health_info: string[] | null;
  expected_weight: string | null;
  sort_order: number | null;
}

interface GryfinGalleryImage {
  id: string;
  image_url: string;
  caption: string | null;
  category: string;
  dog_id: string | null;
  sort_order: number | null;
  width: number | null;
  height: number | null;
  visible_on_site: boolean | null;
}

interface GryfinTestimonial {
  id: string;
  customer_name: string;
  dog_name: string | null;
  content: string;
  rating: number | null;
  photo_url: string | null;
  published_at: string | null;
  visible_on_site: boolean | null;
  featured: boolean | null;
}

interface GryfinEnquiry {
  id: string;
  customer_name: string;
  phone: string | null;
  email: string | null;
  interest: string | null;
  message: string;
  created_at: string | null;
  status: string;
}

interface GryfinSiteSettings {
  kennel_name: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  domain: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  founded_year: number | null;
  show_available_puppies: boolean | null;
  show_planned_litters: boolean | null;
  show_reviews: boolean | null;
  show_gallery: boolean | null;
}

// --------------------------------------------------------------------------------------------
// Report accumulator — every decision the import made, printed and written to JSON.
// --------------------------------------------------------------------------------------------

type Op = "insert" | "update" | "skip";

interface PlannedRow {
  table: string;
  op: Op;
  sourceId: string;
  reason?: string;
  data: Record<string, unknown>;
  targetId?: string;
}

class Report {
  rows: PlannedRow[] = [];
  warnings: string[] = [];
  deferred: {
    gallery: GryfinGalleryImage[];
    testimonials: GryfinTestimonial[];
    enquiries: GryfinEnquiry[];
  } = {
    gallery: [],
    testimonials: [],
    enquiries: [],
  };

  add(row: PlannedRow): void {
    this.rows.push(row);
  }

  warn(message: string): void {
    this.warnings.push(message);
    console.warn(`  ! ${message}`);
  }

  summary(): void {
    const byTable = new Map<string, Record<Op, number>>();
    for (const r of this.rows) {
      const t = byTable.get(r.table) ?? { insert: 0, update: 0, skip: 0 };
      t[r.op] += 1;
      byTable.set(r.table, t);
    }
    console.log("\n=== Import plan ===");
    for (const [table, counts] of byTable) {
      console.log(
        `  ${table.padEnd(30)} insert=${counts.insert}  update=${counts.update}  skip=${counts.skip}`,
      );
    }
    console.log(
      `  deferred: gallery=${this.deferred.gallery.length} testimonials=${this.deferred.testimonials.length} enquiries=${this.deferred.enquiries.length}`,
    );
    console.log(`  warnings: ${this.warnings.length}`);
  }

  writeFile(path: string): void {
    writeFileSync(
      path,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          applied: APPLY,
          rows: this.rows,
          warnings: this.warnings,
          deferred: this.deferred,
        },
        null,
        2,
      ),
    );
    console.log(`\nWrote ${path}`);
  }
}

// --------------------------------------------------------------------------------------------
// Pure transforms
// --------------------------------------------------------------------------------------------

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function orgSlug(name: string): string {
  return `${slugify(name) || "kennel"}-${randomUUID().slice(0, 8)}`;
}

function mapSex(gryfin: string): "male" | "female" | null {
  if (gryfin === "samiec") return "male";
  if (gryfin === "suczka") return "female";
  return null;
}

const LITTER_STATUS: Record<string, string> = {
  planowany: "planned",
  oczekujemy: "planned",
  urodzone: "born",
  rezerwacje: "applications_open",
  zakonczony: "completed",
};

const PUPPY_STATUS: Record<string, string> = {
  dostepny: "available",
  "wstepnie-zarezerwowany": "reserved",
  zarezerwowany: "reserved",
  "w-nowym-domu": "sold",
};

function nonEmpty(...parts: (string | null | undefined)[]): string | null {
  const joined = parts
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .join("\n\n");
  return joined.length > 0 ? joined : null;
}

function firstUrl(single: string | null, many: string[] | null): string | null {
  return (
    [single, ...(many ?? [])].find((u): u is string => typeof u === "string" && u.length > 0) ??
    null
  );
}

function looksLikeRegNumber(text: string): boolean {
  return /^[A-Z]{0,4}[-/ ]?\d{3,}/.test(text.trim());
}

function parseLeadingNumber(text: string): number | null {
  const m = text.trim().match(/^(\d+(?:[.,]\d+)?)/);
  return m && m[1] ? Number(m[1].replace(",", ".")) : null;
}

function isIsoDate(text: string | null): boolean {
  return typeof text === "string" && /^\d{4}-\d{2}-\d{2}/.test(text);
}

// --------------------------------------------------------------------------------------------
// Idempotency: external-ref ledger (optional) + natural-key matching
// --------------------------------------------------------------------------------------------

interface ExistingRow {
  id: string;
}

class Ledger {
  private map = new Map<string, string>(); // `${table}:${sourceId}` -> targetId

  async load(target: SupabaseClient): Promise<void> {
    if (!USE_LEDGER) return;
    const { data, error } = await target
      .from("import_external_refs")
      .select("source_table, source_id, target_id")
      .eq("source", SOURCE_TAG);
    if (error) {
      console.warn(`  ! ledger read failed (${error.message}); falling back to natural keys only`);
      return;
    }
    for (const r of (data ?? []) as {
      source_table: string;
      source_id: string;
      target_id: string;
    }[]) {
      this.map.set(`${r.source_table}:${r.source_id}`, r.target_id);
    }
    console.log(`  ledger: ${this.map.size} existing refs`);
  }

  get(table: string, sourceId: string): string | undefined {
    return this.map.get(`${table}:${sourceId}`);
  }

  async record(
    target: SupabaseClient,
    table: string,
    sourceId: string,
    targetId: string,
  ): Promise<void> {
    this.map.set(`${table}:${sourceId}`, targetId);
    if (!USE_LEDGER || !APPLY) return;
    await target.from("import_external_refs").upsert(
      {
        source: SOURCE_TAG,
        source_table: table,
        source_id: sourceId,
        target_table: table,
        target_id: targetId,
        imported_at: new Date().toISOString(),
      },
      { onConflict: "source,source_table,source_id" },
    );
  }
}

// --------------------------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`Gryfin -> Anemalo import  (${APPLY ? "APPLY" : "DRY RUN"})`);
  const source = createClient(SOURCE_URL, SOURCE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const target = createClient(TARGET_URL, TARGET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const report = new Report();
  const ledger = new Ledger();
  await ledger.load(target);

  // 1. Pull Gryfin -----------------------------------------------------------------------------
  const [dogsR, littersR, puppiesR, galleryR, testimonialsR, enquiriesR, settingsR] =
    await Promise.all([
      source.from("dogs").select("*"),
      source.from("litters").select("*"),
      source.from("puppies").select("*"),
      source.from("gallery_images").select("*"),
      source.from("testimonials").select("*"),
      source.from("enquiries").select("*"),
      source.from("site_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
  for (const r of [dogsR, littersR, puppiesR, galleryR, testimonialsR, enquiriesR, settingsR]) {
    if (r.error) throw new Error(`Gryfin read failed: ${r.error.message}`);
  }
  const gDogs = (dogsR.data ?? []) as GryfinDog[];
  const gLitters = (littersR.data ?? []) as GryfinLitter[];
  const gPuppies = (puppiesR.data ?? []) as GryfinPuppy[];
  const gSettings = settingsR.data as GryfinSiteSettings | null;
  if (!gSettings)
    throw new Error("Gryfin site_settings row (id=1) not found — cannot build the organisation");
  report.deferred.gallery = (galleryR.data ?? []) as GryfinGalleryImage[];
  report.deferred.testimonials = (testimonialsR.data ?? []) as GryfinTestimonial[];
  report.deferred.enquiries = (enquiriesR.data ?? []) as GryfinEnquiry[];

  console.log(
    `  pulled: dogs=${gDogs.length} litters=${gLitters.length} puppies=${gPuppies.length} ` +
      `gallery=${report.deferred.gallery.length} testimonials=${report.deferred.testimonials.length} enquiries=${report.deferred.enquiries.length}`,
  );

  // 2. Resolve breed -------------------------------------------------------------------------
  let breedId: string | null = null;
  {
    const { data } = await target
      .from("breeds")
      .select("id")
      .or("slug.ilike.%york%,name.ilike.%york%")
      .maybeSingle();
    if (data) {
      breedId = (data as ExistingRow).id;
    } else if (CREATE_BREED && APPLY) {
      const { data: created, error } = await target
        .from("breeds")
        .insert({
          name: "Yorkshire Terrier",
          slug: "yorkshire-terrier",
          species_id: DOG_SPECIES_ID,
        })
        .select("id")
        .single();
      if (error) throw new Error(`breed create failed: ${error.message}`);
      breedId = (created as ExistingRow).id;
      console.log("  created breed: Yorkshire Terrier");
    } else {
      report.warn(
        "No Yorkshire Terrier row in Anemalo `breeds` — importing with breed_id=null (pass --create-breed to seed it).",
      );
    }
  }

  // 3. Owner --------------------------------------------------------------------------------
  let ownerUserId = "00000000-0000-0000-0000-000000000000";
  {
    const existing = await findAuthUserByEmail(target, OWNER_EMAIL);
    if (existing) {
      ownerUserId = existing;
      console.log(`  owner: reusing auth user ${ownerUserId}`);
    } else if (APPLY) {
      const { data, error } = await target.auth.admin.createUser({
        email: OWNER_EMAIL,
        email_confirm: true,
      });
      if (error || !data.user) throw new Error(`owner createUser failed: ${error?.message}`);
      ownerUserId = data.user.id;
      console.log(`  owner: created auth user ${ownerUserId}`);
    } else {
      report.add({
        table: "auth.users",
        op: "insert",
        sourceId: OWNER_EMAIL,
        data: { email: OWNER_EMAIL, email_confirm: true },
      });
    }
    report.add({
      table: "profiles",
      op: existing ? "update" : "insert",
      sourceId: OWNER_EMAIL,
      data: { id: ownerUserId, email: OWNER_EMAIL, display_name: gSettings.kennel_name },
      targetId: existing ? ownerUserId : undefined,
    });
    report.add({
      table: "user_roles",
      op: "insert",
      sourceId: OWNER_EMAIL,
      data: { user_id: ownerUserId, role: "breeder", status: "active" },
    });
    if (APPLY) {
      await target
        .from("profiles")
        .upsert(
          { id: ownerUserId, email: OWNER_EMAIL, display_name: gSettings.kennel_name },
          { onConflict: "id" },
        );
      await target
        .from("user_roles")
        .upsert(
          { user_id: ownerUserId, role: "breeder", status: "active" },
          { onConflict: "user_id,role" },
        );
    }
  }

  // 4. Organisation ------------------------------------------------------------------------
  const locationParts = (gSettings.location ?? "").split(",").map((s) => s.trim());
  const orgData: Record<string, unknown> = {
    org_type: "kennel",
    name: gSettings.kennel_name,
    slug: orgSlug(gSettings.kennel_name),
    description: null,
    country: "Poland",
    city: locationParts[0] || null,
    public_location: gSettings.location || null,
    years_experience:
      typeof gSettings.founded_year === "number"
        ? Math.max(0, new Date().getFullYear() - gSettings.founded_year)
        : null,
    verification_status: "approved",
    is_public: true,
    plan: "free",
    owner_user_id: ownerUserId,
  };
  const existingOrg = await matchOne(
    target,
    "organisations",
    { org_type: "kennel" },
    "name",
    gSettings.kennel_name,
  );
  const orgId =
    existingOrg ??
    (APPLY ? await insertReturningId(target, "organisations", orgData) : "<new-org-id>");
  report.add({
    table: "organisations",
    op: existingOrg ? "update" : "insert",
    sourceId: "site_settings:1",
    data: orgData,
    targetId: existingOrg ?? undefined,
  });
  if (APPLY && existingOrg) await target.from("organisations").update(orgData).eq("id", orgId);

  if (gSettings.facebook_url || gSettings.tiktok_url) {
    report.warn(
      `Social links (facebook="${gSettings.facebook_url ?? ""}", tiktok="${gSettings.tiktok_url ?? ""}") have no organisations column — parked, needs a follow-up field.`,
    );
  }

  // 5. Site configuration ----------------------------------------------------------------
  const sections: string[] = ["about", "dogs"];
  if (gSettings.show_planned_litters !== false) sections.push("planned_litters");
  if (gSettings.show_available_puppies !== false) sections.push("litters");
  if (gSettings.show_gallery !== false) sections.push("gallery");
  if (gSettings.show_reviews !== false) sections.push("reviews");
  sections.push("contact");
  const siteConfig: Record<string, unknown> = {
    organisation_id: orgId,
    theme: "classic",
    visible_sections: sections,
    section_order: sections,
    default_language: "pl",
    supported_languages: ["pl"],
    contact_mode: "both",
    show_anemalo_branding: true,
  };
  report.add({
    table: "organisation_site_configurations",
    op: "insert",
    sourceId: "site_settings:1",
    data: siteConfig,
  });
  if (APPLY)
    await target
      .from("organisation_site_configurations")
      .upsert(siteConfig, { onConflict: "organisation_id" });

  // 6. Custom domain -------------------------------------------------------------------
  if (gSettings.domain) {
    const host = gSettings.domain
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .toLowerCase();
    const domainRow: Record<string, unknown> = {
      organisation_id: orgId,
      hostname: host,
      type: "custom_domain",
      status: "pending",
      verification_token: randomUUID(),
      is_primary: true,
    };
    report.add({
      table: "organisation_domains",
      op: "insert",
      sourceId: `domain:${host}`,
      data: domainRow,
    });
    if (APPLY)
      await target.from("organisation_domains").upsert(domainRow, { onConflict: "hostname" });
  }

  // 7. Owner membership --------------------------------------------------------------
  const memberRow = {
    org_id: orgId,
    profile_id: ownerUserId,
    member_role: "owner",
    status: "active",
  };
  report.add({
    table: "organisation_members",
    op: "insert",
    sourceId: OWNER_EMAIL,
    data: memberRow,
  });
  if (APPLY)
    await target
      .from("organisation_members")
      .upsert(memberRow, { onConflict: "org_id,profile_id" });

  // 8. Parent dogs ------------------------------------------------------------------
  const dogIdMap = new Map<string, string>(); // gryfin dog id -> anemalo parent_dogs id
  for (const d of gDogs) {
    const sex = mapSex(d.sex);
    if (sex === null) {
      report.add({
        table: "parent_dogs",
        op: "skip",
        sourceId: d.id,
        reason: `unrecognised sex "${d.sex}"`,
        data: {},
      });
      continue;
    }
    const pedigreeNumber = d.pedigree && looksLikeRegNumber(d.pedigree) ? d.pedigree.trim() : null;
    const retiredNote = d.status === "emerytura" ? "[Na emeryturze]" : null;
    const pedigreeNote = d.pedigree && !pedigreeNumber ? `Rodowód: ${d.pedigree.trim()}` : null;
    const row: Record<string, unknown> = {
      kennel_id: orgId,
      breed_id: breedId,
      registered_name: d.registered_name || null,
      call_name: d.name,
      sex,
      date_of_birth: isIsoDate(d.birth_date) ? d.birth_date : null,
      color: d.color || null,
      pedigree_number: pedigreeNumber,
      description: nonEmpty(d.description, d.character, pedigreeNote, retiredNote),
      profile_image_url: firstUrl(d.photo_url, d.photo_urls),
      health_tests: (d.health_tests ?? []).map((t) => ({ test: t })),
      titles: (d.achievements ?? []).join(" · ") || null,
      is_active: d.status === "aktywny",
    };
    const existing = ledger.get("parent_dogs", d.id) ?? (await matchParentDog(target, orgId, row));
    const op: Op = existing ? "update" : "insert";
    let id = existing ?? `<pd:${d.id}>`;
    if (APPLY) {
      id = existing ? existing : await insertReturningId(target, "parent_dogs", row);
      if (existing) await target.from("parent_dogs").update(row).eq("id", id);
      await ledger.record(target, "parent_dogs", d.id, id);
    }
    dogIdMap.set(d.id, id);
    report.add({
      table: "parent_dogs",
      op,
      sourceId: d.id,
      data: row,
      targetId: existing ?? undefined,
    });

    if (IMPORT_ACHIEVEMENTS) {
      for (const title of d.achievements ?? []) {
        const achRow = { kennel_id: orgId, parent_dog_id: id, title };
        report.add({
          table: "achievements",
          op: "insert",
          sourceId: `${d.id}:${title}`,
          data: achRow,
        });
        if (APPLY) await target.from("achievements").insert(achRow);
      }
    }
    if ((d.photo_urls ?? []).length > 1) {
      report.warn(
        `parent_dog ${d.id} has ${(d.photo_urls ?? []).length} photos; only the first maps (parent_dogs has one image slot).`,
      );
    }
  }

  // 9. Litters --------------------------------------------------------------------
  const litterIdMap = new Map<string, string>();
  for (const l of gLitters) {
    const motherId = l.mother_id ? (dogIdMap.get(l.mother_id) ?? null) : null;
    const fatherId = l.father_id ? (dogIdMap.get(l.father_id) ?? null) : null;
    if (l.mother_id && !motherId) report.warn(`litter ${l.id}: mother ${l.mother_id} not resolved`);
    if (l.father_id && !fatherId) report.warn(`litter ${l.id}: father ${l.father_id} not resolved`);
    const plannedIsDate = isIsoDate(l.planned_date);
    const descBits = nonEmpty(
      l.description,
      l.extra,
      (l.expected_colors ?? []).length
        ? `Spodziewane kolory: ${(l.expected_colors ?? []).join(", ")}`
        : null,
      !plannedIsDate && l.planned_date ? `Planowane: ${l.planned_date}` : null,
    );
    let status = LITTER_STATUS[l.status] ?? "planned";
    if (l.accepting_requests === true && status === "born") status = "applications_open";
    const row: Record<string, unknown> = {
      kennel_id: orgId,
      breed_id: breedId,
      code: l.name || l.slug || `Miot ${l.id.slice(0, 6)}`,
      mother_id: motherId,
      father_id: fatherId,
      birth_date: isIsoDate(l.birth_date) ? l.birth_date : null,
      expected_birth_date: plannedIsDate ? l.planned_date : null,
      puppy_count: typeof l.puppies_count === "number" ? l.puppies_count : null,
      description: descBits,
      status,
      is_published: l.visible_on_site === true,
    };
    const existing =
      ledger.get("litters", l.id) ??
      (await matchOne(target, "litters", { kennel_id: orgId }, "code", String(row.code)));
    const op: Op = existing ? "update" : "insert";
    let id = existing ?? `<litter:${l.id}>`;
    if (APPLY) {
      id = existing ? existing : await insertReturningId(target, "litters", row);
      if (existing) await target.from("litters").update(row).eq("id", id);
      await ledger.record(target, "litters", l.id, id);
    }
    litterIdMap.set(l.id, id);
    report.add({
      table: "litters",
      op,
      sourceId: l.id,
      data: row,
      targetId: existing ?? undefined,
    });
  }

  // 10. Puppies (+ images) -----------------------------------------------------------
  for (const p of gPuppies) {
    const litterId = p.litter_id ? (litterIdMap.get(p.litter_id) ?? null) : null;
    if (p.litter_id && !litterId) report.warn(`puppy ${p.id}: litter ${p.litter_id} not resolved`);
    const sex = mapSex(p.sex);
    if (p.sex && sex === null) report.warn(`puppy ${p.id}: unrecognised sex "${p.sex}" -> null`);
    const weightKg = p.expected_weight ? parseLeadingNumber(p.expected_weight) : null;
    const extraDesc = nonEmpty(
      p.description,
      p.registered_name ? `Nazwa rodowodowa: ${p.registered_name}` : null,
      p.ready_from ? `Gotowe od: ${p.ready_from}` : null,
      p.expected_weight && weightKg === null ? `Waga docelowa: ${p.expected_weight}` : null,
    );
    const row: Record<string, unknown> = {
      organization_id: orgId,
      listing_category: "breeder_puppy",
      litter_id: litterId,
      breed_id: breedId,
      species_id: DOG_SPECIES_ID,
      name: p.name || `Szczenię ${p.id.slice(0, 6)}`,
      slug: p.slug || slugify(p.name ?? `puppy-${p.id.slice(0, 6)}`),
      sex,
      color: p.color || null,
      date_of_birth: isIsoDate(p.birth_date) ? p.birth_date : null,
      weight_kg: weightKg,
      description: extraDesc,
      temperament: p.temperament || null,
      ideal_home: p.socialization || null,
      health_tests: (p.health_info ?? []).map((n) => ({ note: n })),
      availability_status: PUPPY_STATUS[p.status] ?? "draft",
      is_published: p.visible_on_site === true,
      is_featured: p.featured === true,
      price: null,
      currency: null,
    };
    const existing =
      ledger.get("animals", p.id) ??
      (await matchOne(target, "animals", { organization_id: orgId }, "slug", String(row.slug)));
    const op: Op = existing ? "update" : "insert";
    let id = existing ?? `<animal:${p.id}>`;
    if (APPLY) {
      id = existing ? existing : await insertReturningId(target, "animals", row);
      if (existing) await target.from("animals").update(row).eq("id", id);
      await ledger.record(target, "animals", p.id, id);
    }
    report.add({
      table: "animals",
      op,
      sourceId: p.id,
      data: row,
      targetId: existing ?? undefined,
    });

    const photos = [p.photo_url, ...(p.photo_urls ?? [])].filter(
      (u): u is string => typeof u === "string" && u.length > 0,
    );
    photos.forEach((url, i) => {
      const imgRow = {
        animal_id: id,
        image_url: url,
        display_order: i,
        is_cover: i === 0,
        caption: null,
      };
      report.add({ table: "animal_images", op: "insert", sourceId: `${p.id}:${i}`, data: imgRow });
    });
    if (APPLY && photos.length > 0) {
      // idempotent: delete-then-insert this animal's image set
      await target.from("animal_images").delete().eq("animal_id", id);
      await target.from("animal_images").insert(
        photos.map((url, i) => ({
          animal_id: id,
          image_url: url,
          display_order: i,
          is_cover: i === 0,
          caption: null,
        })),
      );
    }
  }

  // 11. Deferred -----------------------------------------------------------------
  if (report.deferred.gallery.length)
    report.warn(
      `${report.deferred.gallery.length} gallery_images deferred — no Anemalo org-gallery table (see docs/GRYFIN_IMPORT.md).`,
    );
  if (report.deferred.testimonials.length)
    report.warn(
      `${report.deferred.testimonials.length} testimonials deferred — no Anemalo reviews table.`,
    );
  if (report.deferred.enquiries.length)
    report.warn(
      `${report.deferred.enquiries.length} enquiries deferred — no Anemalo organisation_enquiries table.`,
    );

  report.summary();
  report.writeFile("gryfin-import.report.json");
  if (!APPLY)
    console.log("\nDRY RUN — nothing was written. Re-run with --apply to perform the import.");
}

// --------------------------------------------------------------------------------------------
// Target helpers
// --------------------------------------------------------------------------------------------

async function insertReturningId(
  client: SupabaseClient,
  table: string,
  data: Record<string, unknown>,
): Promise<string> {
  const { data: row, error } = await client.from(table).insert(data).select("id").single();
  if (error) throw new Error(`insert ${table} failed: ${error.message}`);
  return (row as ExistingRow).id;
}

async function matchOne(
  client: SupabaseClient,
  table: string,
  eqFilter: Record<string, string>,
  col: string,
  value: string,
): Promise<string | null> {
  let q = client.from(table).select("id");
  for (const [k, v] of Object.entries(eqFilter)) q = q.eq(k, v);
  const { data, error } = await q.ilike(col, value).limit(1).maybeSingle();
  if (error) return null;
  return data ? (data as ExistingRow).id : null;
}

async function matchParentDog(
  client: SupabaseClient,
  orgId: string,
  row: Record<string, unknown>,
): Promise<string | null> {
  const regName = row.registered_name as string | null;
  if (regName)
    return matchOne(client, "parent_dogs", { kennel_id: orgId }, "registered_name", regName);
  const callName = row.call_name as string;
  const dob = row.date_of_birth as string | null;
  let q = client
    .from("parent_dogs")
    .select("id")
    .eq("kennel_id", orgId)
    .ilike("call_name", callName);
  if (dob) q = q.eq("date_of_birth", dob);
  const { data } = await q.limit(1).maybeSingle();
  return data ? (data as ExistingRow).id : null;
}

async function findAuthUserByEmail(client: SupabaseClient, email: string): Promise<string | null> {
  // admin.listUsers is paginated; scan a bounded number of pages.
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

main().catch((err: unknown) => {
  console.error("\nImport failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
