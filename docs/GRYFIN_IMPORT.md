# Gryfin → Anemalo import (Phase C pilot)

Status: **plan + tooling, 2026-09-10. Nothing has been run.** `scripts/import-gryfin.ts` is
dry-run by default and was **not executed against any database**. No migration was applied.

Goal: land the real Gryfin York kennel (`/p/grif`) into the ONE shared Anemalo Supabase project as
**one `organisations` row + its parent dogs / litters / puppies / images**, so the `/p/grif/p`
public-site fork (Phase E, later) can render live from `api.anemalo.com` instead of Gryfin's own
Supabase project.

## Source of truth for the Gryfin schema

`/p/grif`'s own `supabase/` dir is **not checked out** in this workspace. The column names below
come from:

- `/p/grif/c/src/lib/dbMapping.ts` — the panel's row⇄domain adapters (`DogRow`, `LitterRow`,
  `PuppyRow`, `TestimonialRow`, `GalleryImageRow`, `EnquiryRow`, `SiteSettingsRow`).
- `/p/grif/p/src/lib/mappers.ts` — the public site's `Raw*` interfaces off the `get-site-content`
  edge function (adds `slug`, `sort_order`, `registered_name` on puppies, `width`/`height`/`dog_id`
  on gallery, `domain`/`founded_year` on settings).
- `/p/grif/c/src/lib/mock-data.ts` — the enum vocabularies.

**Before `--apply`, re-confirm every source column against the real Gryfin DB** (`\d dogs`,
`\d litters`, …). The script centralises the shapes in one `GryfinRow*` block for exactly this.

## Gryfin data model (what the panel manages)

| Gryfin table | Rows | Key columns |
|---|---|---|
| `dogs` | breeding dogs (sires/dams) | `id, slug, name, registered_name, sex('samiec'\|'suczka'), color, birth_date, status('aktywny'\|'emerytura'\|'nieaktywny'), visible_on_site, photo_url, photo_urls[], featured, health_tests[], achievements[], pedigree(text), description, character` |
| `litters` | planned/born litters | `id, slug, name, mother_id→dogs, father_id→dogs, planned_date, birth_date, puppies_count, expected_colors[], status('planowany'\|'oczekujemy'\|'urodzone'\|'rezerwacje'\|'zakonczony'), visible_on_site, accepting_requests, featured, description, extra` |
| `puppies` | individual puppies | `id, slug, litter_id→litters, name, registered_name, sex, color, birth_date, ready_from, status('dostepny'\|'wstepnie-zarezerwowany'\|'zarezerwowany'\|'w-nowym-domu'), visible_on_site, featured, photo_url, photo_urls[], description, temperament, socialization, health_info[], expected_weight, sort_order` |
| `gallery_images` | free-standing gallery | `id, image_url, caption, category('szczenieta'\|'psy'\|'mioty'\|'rodziny'\|'ogolne'\|…), dog_id(nullable), sort_order, width, height, visible_on_site` |
| `testimonials` | customer reviews | `id, customer_name, dog_name, content, rating(1-5), photo_url, published_at, visible_on_site, featured` |
| `enquiries` | contact-form leads | `id, customer_name, phone, email, interest, message, created_at, status('nowe'\|'kontakt'\|'zakonczone')` |
| `site_settings` | singleton (`id=1`) | `kennel_name, phone, email, location, domain, facebook_url, tiktok_url, founded_year, show_available_puppies, show_planned_litters, show_reviews, show_gallery` |

Single breed (Yorkshire Terrier). Media lives in a Cloudflare R2 bucket (`gryfinyork-media`),
referenced by absolute URL in `photo_url` / `image_url`.

## Target Anemalo schema (verified live 2026-09-10)

`organisations`, `organisation_site_configurations`, `organisation_domains`, `parent_dogs`,
`litters`, `animals` (`listing_category='breeder_puppy'`), `animal_images`, `dogs` (pedigree
identity — **auto-created by trigger** from `parent_dogs`/`animals` inserts, never inserted
directly), `achievements`, `organisation_members`, `auth.users` + `profiles` for the owner.

Relevant constraints found:

- `parent_dogs.sex` / `animals.sex` = enum `dog_sex` (`male` | `female`). `parent_dogs.sex` is
  **NOT NULL**; `animals.sex` is nullable.
- `parent_dogs.breed_id` / `litters.breed_id` / `animals.breed_id` are **nullable** — a missing
  breed row is not a blocker (import proceeds with `breed_id = null` and a warning).
- `animals.species_id` is NOT NULL but **defaults** to the dog species
  (`a0000000-5000-0000-0000-000000000001`); `animals.weight_unit` defaults `'kg'`;
  `animals.listing_category` defaults `'not_listed'` (import sets `'breeder_puppy'`);
  `animals.availability_status` defaults `'draft'`; `animals.is_published` defaults `false`.
- `litters.code` NOT NULL, `litters.kennel_id` NOT NULL, `litters.status` = enum `litter_status`
  (`planned | born | applications_open | fully_reserved | completed | cancelled`).
- `animals.availability_status` = enum `animal_availability_status`
  (`draft | applications_open | available | reserved | sold | adopted | unavailable | withdrawn`).
- `organisations.org_type` = enum incl. `kennel`; `verification_status` = enum
  (`pending | approved | rejected | suspended`).
- Org creation normally goes through `approve_user_verification()`. The import bypasses that with a
  direct service-role insert (legitimate one-off backfill) — see "Owner account" below.
- The `parent_dogs`→`dogs` and litter→puppy auto-identity triggers (see `docs/PEDIGREE_GRAPH.md`)
  mean: inserting `parent_dogs` mints the `dogs` identity row automatically, and a litter with a
  resolved `mother_id`/`father_id` gives the puppies `breeder_confirmed` pedigree edges **for
  free** — so getting the litter parent links right is how Gryfin pedigree data lands.

## Field-by-field mapping

### `site_settings` → `organisations` (one row, `org_type='kennel'`)

| Gryfin | Anemalo `organisations` | Transform / note |
|---|---|---|
| `kennel_name` | `name` | verbatim |
| — | `slug` | `slugify(kennel_name) || '-' || left(gen_random_uuid()::text,8)` — matches `approve_user_verification`'s pattern. Stored + logged; the public contract keys on it. |
| `location` (`"Wrocław, Dolnośląskie"`) | `city`, `public_location`; `country` | split on first comma → `city` = part 1, `public_location` = whole string; `country` = `'Poland'` (constant for this pilot — Gryfin has no country field) |
| `phone`, `email` | **owner `profiles.phone` / `profiles.email`** | NOT public on the org row — Anemalo keeps org contact on the profile / `private_addresses`. `contact_mode='both'` on the site config. |
| `founded_year` | `years_experience` | `currentYear - founded_year` if `founded_year` present, else `null`. **No fabrication** if absent. |
| `facebook_url`, `tiktok_url` | — | **No social-link columns on `organisations`.** Parked in the import report; a follow-up column (`organisations.social_links jsonb`) or `organisation_site_configurations` extension is flagged, not invented. |
| `domain` | `organisation_domains` row | `type='custom_domain'`, `status='pending'`, fresh `verification_token`. `www.` + apex both added if the value is a bare apex. |
| — | `verification_status='approved'`, `is_public=true`, `plan='free'` | pilot defaults; `plan` stays `free` until billing exists |
| `show_available_puppies` / `show_planned_litters` / `show_reviews` / `show_gallery` | `organisation_site_configurations.visible_sections[]` / `section_order[]` | map: `show_available_puppies→'litters'+'planned_litters'`, `show_reviews→'reviews'`, `show_gallery→'gallery'`; always include `'about'`,`'dogs'`,`'contact'`. `theme='classic'`, `default_language='pl'`, `supported_languages=['pl']`, `contact_mode='both'`, `show_anemalo_branding=true`. |

### `dogs` → `parent_dogs` (+ auto `dogs` identity)

| Gryfin `dogs` | Anemalo `parent_dogs` | Transform / note |
|---|---|---|
| `id` | — (idempotency ref) | see "Idempotency" |
| `name` | `call_name` | |
| `registered_name` | `registered_name` | nullable → `null` when empty |
| `sex` | `sex` | `samiec→male`, `suczka→female`. NOT NULL — a row with an unrecognised value is **skipped + reported**, never defaulted. |
| `color` | `color` | |
| `birth_date` | `date_of_birth` | `null` when empty |
| `status` | `is_active` | `aktywny→true`; `emerytura`/`nieaktywny→false`. The `emerytura` (retired) nuance is appended to `description` as `"[Na emeryturze]"` so it isn't lost. |
| `health_tests[]` | `health_tests` (jsonb) | `["HD-A", …] → [{ "test": "HD-A" }, …]` (matches `public_dogs.health_tests` shape seen live) |
| `achievements[]` | `titles` (text) | joined with `" · "`. `achievements` **table** rows are an *optional* follow-up (`--achievements` flag): one row per entry, `verification_status` left to the table default, `title` = entry text. Off by default to avoid guessing the enum. |
| `pedigree` (free text) | `pedigree_number` **or** `description` | if it matches `/^[A-Z]{0,4}[- ]?\d{3,}/` (looks like a reg number) → `pedigree_number`; else appended to `description` under `"Rodowód: …"`. Never both. |
| `photo_url` + `photo_urls[]` | `profile_image_url` | first non-empty URL. `parent_dogs` has no multi-image table — the rest go to the report (candidate for a future `parent_dog_images`). |
| `description`, `character` | `description` | `[description, character].filter(Boolean).join("\n\n")` |
| `visible_on_site` | — | parent dogs are public when their kennel is approved+public (RLS); `is_active` already carries "shown". A hidden-but-active Gryfin dog is imported `is_active=false` + noted. |
| `featured` | — | no per-parent-dog featured flag in Anemalo; dropped, noted. |
| — | `kennel_id` | the new org id |
| — | `breed_id` | resolved Yorkshire Terrier `breeds.id` (lookup by slug/name); **`null` + warning** if the breed row doesn't exist (it currently doesn't — see "Prerequisites") |

### `litters` → `litters`

| Gryfin `litters` | Anemalo `litters` | Transform / note |
|---|---|---|
| `id` | — (idempotency ref) | |
| `name` / `slug` | `code` | `code` is NOT NULL — use `name`, else `slug`, else `"Miot " + left(id,6)` |
| `mother_id` → Gryfin `dogs` | `mother_id` → Anemalo `parent_dogs` | remapped through the dog id-map built earlier in the run; unresolved → `null` + warning |
| `father_id` | `father_id` | same |
| `birth_date` | `birth_date` | |
| `planned_date` (may be human text like `"late lato 2026"`) | `expected_birth_date` | only if it parses as a date; otherwise appended to `description` as `"Planowane: …"` and `expected_birth_date=null` |
| `puppies_count` | `puppy_count` | |
| `expected_colors[]` | `description` (append `"Spodziewane kolory: …"`) | no array column on `litters` |
| `status` | `status` | `planowany→planned`, `oczekujemy→planned`, `urodzone→born`, `rezerwacje→applications_open`, `zakonczony→completed` |
| `visible_on_site` | `is_published` | direct |
| `accepting_requests` | — | closest is `status='applications_open'`; if `true` and status maps to `born`, bump to `applications_open`. Noted. |
| `description`, `extra` | `description` | joined |
| `featured` | — | dropped, noted |
| — | `kennel_id` | new org id |
| — | `breed_id` | Yorkshire Terrier or `null`+warning |

### `puppies` → `animals` (`listing_category='breeder_puppy'`) + `animal_images`

| Gryfin `puppies` | Anemalo `animals` | Transform / note |
|---|---|---|
| `id` | — (idempotency ref) | |
| `name` | `name` | NOT NULL — fallback `"Szczenię " + left(id,6)` |
| `registered_name` | — | `animals` has no `registered_name`; appended to `description` if present, noted |
| `slug` | `slug` | keep Gryfin slug (collision-checked; suffixed on clash) |
| `litter_id` | `litter_id` | remapped through the litter id-map |
| `sex` | `sex` | `samiec→male`, `suczka→female`; nullable → `null` + note on unrecognised |
| `color` | `color` | |
| `birth_date` | `date_of_birth` | |
| `ready_from` | — | `animals` has no ready-date; carried on `litters.ready_date` if empty there, else appended to `description` (`"Gotowe od: …"`) |
| `status` | `availability_status` | `dostepny→available`, `wstepnie-zarezerwowany→reserved`, `zarezerwowany→reserved`, `w-nowym-domu→sold` |
| `visible_on_site` | `is_published` | direct |
| `description`, `temperament`, `socialization` | `description`, `temperament`, `ideal_home` | `description`←`description`; `temperament`←`temperament`; `ideal_home`←`socialization` (closest field) + noted |
| `health_info[]` | `health_tests` (jsonb) | `["…"] → [{ "note": "…" }]` |
| `expected_weight` (free text e.g. `"2-3 kg"`) | `weight_kg` **or** `description` | parse leading number → `weight_kg`; unparseable → `description` (`"Waga docelowa: …"`) |
| `photo_url` + `photo_urls[]` | `animal_images` rows | one row each; first = `is_cover=true`; `display_order` = index; `caption=null` |
| `featured` | `is_featured` | direct |
| `sort_order` | — | `animals` has no sort column; dropped, noted |
| — | `organization_id` | new org id |
| — | `price` / `currency` | **left null** — Gryfin has no price. No fabrication. |
| — | `breed_id` | Yorkshire Terrier or `null`+warning |

### `gallery_images` — **deferred**

Anemalo `animal_images` requires an `animal_id`; `parent_dogs` has only a single
`profile_image_url`; there is **no org-level gallery/media table**. Options, none taken this pass:

- A `dog_id`-linked gallery image *could* attach to that dog's puppy row — but Gryfin `dog_id`
  points at breeding dogs, not puppies, so there's no `animals` row to hang it on.
- Standalone category images (`ogolne`, `rodziny`, …) have no home at all.

**Plan**: the script exports every `gallery_images` row to `gryfin-import.report.json` under
`deferred.gallery`. A follow-up needs an `organisation_media` (or `organisation_gallery_images`)
table before these can land. Flagged in `docs/BREEDER_PANEL_GAP_ANALYSIS.md`.

### `testimonials` — **deferred**

No Anemalo reviews table (`docs/SOCIAL_DOMAIN.md` lists a `reviews` section, no schema). Exported
to `report.json` under `deferred.testimonials`. Candidate targets: a new `organisation_reviews`
table, or a `review` post type in the social `posts` domain — decision open (see
`docs/API_GATEWAY_AND_MULTI_TENANT_BREEDERS.md` §8 open questions).

### `enquiries` — **deferred**

No Anemalo per-org enquiry table (see `docs/API_GATEWAY_AND_MULTI_TENANT_BREEDERS.md` §2 —
`organisation_enquiries` + `submit_org_enquiry()` proposed, not built). Exported to `report.json`
under `deferred.enquiries`. These are historical leads; not urgent.

## Owner account

The Gryfin owner gets a real identity so the dashboard works and `organisations.owner_user_id` is
populated:

1. `auth.admin.createUser({ email: <ownerEmail>, email_confirm: true })` (service-role). If a user
   with that email already exists, reuse it (idempotent).
2. `profiles` row — usually auto-created by an `on_auth_user_created` trigger; the script
   `upsert`s `{ id: userId, email, display_name: kennel_name }` to be safe.
3. `organisation_members` — `{ org_id, profile_id: userId, member_role: 'owner', status: 'active' }`.
4. The owner still gets an **invitation email** in the normal flow later (`invite_org_member`), or
   a password-reset link — the import only creates the record, it does not send credentials.

`user_roles` (`role='breeder'`) is **also** inserted (`on_conflict do nothing`) so the account
sees the breeder dashboard, matching what `approve_user_verification` grants.

## Idempotency

Anemalo tables have **no generic `import_ref` column**. The script supports both of:

1. **External-ref ledger (preferred)** — a tiny table (draft migration, unapplied):
   `public.import_external_refs (source text, source_table text, source_id text, target_table
   text, target_id uuid, imported_at timestamptz, primary key (source, source_table, source_id))`.
   Every insert also writes its ledger row; every run first loads the ledger and skips/updates
   rather than re-inserting. This is the clean, auditable answer — recommended.
2. **Natural-key fallback** (works with no ledger, so a first run is still safe):
   - `parent_dogs`: match on `(kennel_id, lower(registered_name))` when a reg name exists, else
     `(kennel_id, lower(call_name), date_of_birth)`.
   - `litters`: match on `(kennel_id, lower(code))`.
   - `animals`: match on `microchip_number` when present, else `(organization_id, lower(slug))`,
     else `(organization_id, lower(name), date_of_birth)`.
   - `animal_images`: match on `(animal_id, image_url)`.
   - `organisations`: match on `(org_type, lower(name))`.
   - owner: match on `auth.users.email`.

On a re-run: matched rows are **updated in place** (never duplicated); new rows inserted; the
id-maps are rebuilt from whatever's found. `--apply` twice = same end state.

The `--ledger` flag turns on (1); without it the script uses (2) only and prints a note that
re-run safety relies on natural keys. Neither invents data.

## Dry-run plan

```
node scripts/import-gryfin.ts \
  --source-url  https://<gryfin-ref>.supabase.co \
  --source-key  <gryfin service_role key> \
  --target-url  https://pgzvkkybqrhxedjoyjzy.supabase.co \
  --target-key  <anemalo service_role key> \
  --owner-email owner@gryfinyork.pl \
  [--ledger] [--achievements] [--create-breed] [--apply]
```

Without `--apply` (the default) the script:

1. Connects to both projects, `select('*')` from every Gryfin table.
2. Re-validates every Gryfin column against what it actually got back; aborts with a diff if the
   real schema disagrees with the `GryfinRow*` interfaces.
3. Resolves the Yorkshire Terrier `breeds` row (currently absent → warning; `--create-breed`
   would `insert { name:'Yorkshire Terrier', slug:'yorkshire-terrier', species_id:<dog> }`).
4. Builds the full plan: 1 org, 1 site-config, 1 domain (if `site_settings.domain`), 1 owner,
   N parent_dogs, N litters, N animals, N animal_images.
5. Prints a per-table table of `insert` / `update` / `skip (reason)` counts and every field that
   was dropped, coerced, or deferred.
6. Writes `gryfin-import.report.json` (full detail incl. `deferred.gallery` /
   `deferred.testimonials` / `deferred.enquiries`).
7. **Writes nothing.**

With `--apply` it performs the writes in dependency order (org → site-config → domain → owner →
member → parent_dogs → litters → animals → animal_images), each guarded by the idempotency check,
inside per-table batches, and re-writes the report with actual target ids.

## Prerequisites before `--apply`

- [ ] Re-confirm Gryfin's real column names (schema not in this workspace).
- [ ] A Yorkshire Terrier row in Anemalo `breeds` (or run with `--create-breed`).
- [ ] Decide `--ledger` (recommended) → apply the `import_external_refs` draft migration first.
- [ ] A real `--owner-email` for the Gryfin owner.
- [ ] Service-role keys for **both** projects, passed as flags/env, never committed.
- [ ] Confirm media URLs: Gryfin photos are absolute R2 URLs — decide whether to copy bytes into
      Anemalo storage now or leave hot-links for the pilot (script leaves them as-is + flags).
- [ ] `docs/API_GATEWAY_AND_MULTI_TENANT_BREEDERS.md` §1 open question on `public_dogs` visibility
      resolved (does it leak non-public kennels' identities?).

## Not done this pass (explicit)

- The script was **not run** — no dry run, no `--apply`.
- No `import_external_refs` migration applied (draft only, if written).
- `gallery_images` / `testimonials` / `enquiries` have no target and are export-only.
- The `/p/grif/p` fork that reads `api.anemalo.com` is a **separate later deliverable** — not
  created, production untouched.
