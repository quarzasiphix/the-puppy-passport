# Gryfin York → Anemalo import

**Rewritten 2026-09-10 against the REAL Gryfin schema** (Supabase project `eqggerrzfwlfqibcdyjy`,
read via MCP). The earlier version of this doc was inferred from `/p/grif/c` client code and was
wrong in several places (it assumed `kennels` / `people_directory` tables and a `chip_number`
column — none exist). A full read-only snapshot is at `.gryfin-migration/snapshot.json`
(gitignored — carries the kennel's contact details + testimonial author names).

## Gryfin's actual data (small — a single-kennel Yorkshire Terrier site)

| Gryfin table | rows | notes |
|---|---|---|
| `site_settings` | 1 (`id=1`) | kennel name, phone, email, `location`, `domain` = `hodowlagryfinyork.pl`, FB + TikTok URLs, `founded_year` = null, four `show_*` section toggles |
| `dogs` | 11 | the kennel's **breeding stock** (8 `suczka` / 3 `samiec`). `status` all `aktywny`. `birth_date` null on every row. `pedigree` null on every row. `health_tests` / `achievements` arrays all empty. `photo_url` + `photo_urls[]` (heavily duplicated) |
| `litters` | 4 | 2 `urodzone` (born, with puppies), 2 `oczekujemy` (expecting, Sept 2026). `mother_id`/`father_id` → `dogs`. **Miot S has `mother_id` = null** (a real gap in the source) |
| `puppies` | 8 | all from the 2 born litters (Miot S: Suzi/Sara/Spajki/Sonik; Miot T: Tami/Timon/Tobik/Teodor). `registered_name` null on all. `price` 2200–3500. Status: 7 × `w-nowym-domu` (placed), 1 × `zarezerwowany` (Timon) |
| `gallery_images` | 30 | all `category = 'ogolne'`, none linked to a dog, `image_url` on `media.hodowlagryfinyork.pl` |
| `testimonials` | 19 | customer reviews, all rating 5, `photo_url` points at bundled `/assets/dogN-*.jpg` placeholders (not real photos) |
| `enquiries` | 4 | lead-capture: name / phone / email / message |

**Images** live at `https://media.hodowlagryfinyork.pl/{dogs,puppies,gallery}/<uuid>.{webp,jpg}` —
a Cloudflare custom domain already in front of the R2 bucket. Per the decision in
`docs/STORAGE_AND_MEDIA.md`, these URLs are stored **as-is** in Anemalo; nothing is re-hosted.

## What migrates, and where

| Gryfin | → Anemalo | mapping notes |
|---|---|---|
| `site_settings` | one `organisations` row (`org_type='kennel'`) | `name` = "GRYFIN YORK", `slug` = `gryfin-york`, `country` = "Poland", `city` = "Łódź", `public_location` = "Łódź-Polesie, Poland", `verification_status='approved'`, `is_public=true`, `plan='website'` (she has a custom domain). `phone`/`email` → operations-only (not a public column). **FB/TikTok URLs: no `organisations` column** → deferred (breeder-panel social-links gap, see `docs/BREEDER_PANEL_GAP_ANALYSIS.md`) |
| — | one `organisation_site_configurations` row | seeded: `default_language='pl'`, `supported_languages=['pl','en']`, `contact_mode='both'`, visible sections from the `show_*` toggles |
| `site_settings.domain` | `organisation_domains` × 2 | `hodowlagryfinyork.pl` + `www.hodowlagryfinyork.pl`, `type='custom_domain'`, `status='active'` (admin attaching a known-good domain), first one `is_primary` |
| — | one `breeds` row | **Anemalo has no Yorkshire Terrier breed row** — insert one: name "Yorkshire Terrier", `slug='yorkshire-terrier'`, toy size, FCI group 3. Real breed, factual. |
| `dogs` (11) | `parent_dogs` (11) | `registered_name` trimmed (fallback `name`), `call_name` = `name`, `sex` samiec→`male`/suczka→`female`, `color` trimmed, `date_of_birth`=null, `breed_id` = the new YT row, `kennel_id` = the org, `description` verbatim, `profile_image_url` = `photo_url`, `is_active` = (`status='aktywny'`). Extra `photo_urls` are **not** carried (`parent_dogs` has only a single image column) — kept in the snapshot if needed later. |
| `litters` (4) | `litters` (4) | `kennel_id`, `breed_id`=YT, `mother_id`/`father_id` = mapped `parent_dogs` (Miot S mother → null), `code` = Gryfin `name`, `birth_date` verbatim, `expected_birth_date` = `planned_date` for the 2 expecting, `status` urodzone→`born` / oczekujemy→`planned`, `is_published`=true, `puppy_count` = real count |
| `puppies` (8) | `animals` (8) + `animal_images` | `listing_category='breeder_puppy'`, `litter_id` mapped, `organization_id`=org, `name`, `sex` mapped, `color`, `date_of_birth`, `breed_id`=YT, `price` + `currency='PLN'`, `description` verbatim, `availability_status`: w-nowym-domu→`sold` / zarezerwowany→`reserved`, `is_published`=true (a **sold** puppy stays published → it surfaces in the breeder's **Alumni** section — the intended behaviour). `animal_images` from de-duplicated `photo_urls`; the entry matching `photo_url` gets `is_cover=true`. |
| — | pedigree graph (automatic) | the applied `20260910000100` triggers fire on every `parent_dogs` / `animals` / `litters` insert: each becomes a permanent `dogs` identity, and each puppy inherits sire/dam edges from its litter's mother/father. **Gryfin's dogs land in the Anemalo pedigree graph with no extra step**, sourced as `breeder_declaration` → `breeder_confirmed`. |

## What does NOT migrate (and why)

- **`testimonials` (19)** — Anemalo has no reviews table, *and* every row carries a third party's
  personal name (the review author). No lawful basis to move other people's personal data into
  Anemalo. Left in Gryfin. (A future Anemalo reviews table + a proper consent path could revisit.)
- **`gallery_images` (30)** — no org-gallery table in Anemalo yet (breeder-panel gap). URLs are in
  the snapshot; import them once that table exists.
- **`enquiries` (4)** — transient lead-capture PII, no Anemalo target.
- **FB / TikTok URLs** — no `organisations` social-links column yet.

## Owner account

Needs **Monika's email** (the Gryfin breeder). The import will:
1. `insert into auth.users` a pre-provisioned row (email, `email_confirmed_at` set) + let the
   `handle_new_user` trigger create her `profiles` row.
2. `organisations.owner_user_id` = that user; `organisation_members` (owner); `user_roles`
   (`breeder`, `active`).
3. She sets her password via a magic-link / reset on first sign-in.

Alternative (if no email yet): import under an admin-owned org, `invite_org_member` her later.

## Idempotency / re-runs

For 1 org + 11 + 4 + 8 rows, the import is a single transaction. Re-run safety: it checks for an
existing `organisations` row with `slug='gryfin-york'` and **aborts** if found (no partial
double-import). The Gryfin source UUIDs are recorded in `animals.description` / a local
`.gryfin-migration/id-map.json` is written on apply so a second pass can diff. Dry-run mode
(`SELECT`-only, reports the plan, writes nothing) runs first.

## Status

- ✅ Full Gryfin snapshot captured (`.gryfin-migration/snapshot.json`).
- ⏳ **Blocked on**: (a) Supabase MCP reconnected to the `anemalo` project (`pgzvkkybqrhxedjoyjzy`)
  — currently only `gryfinyork` is connected; (b) Monika's email.
- Then: dry-run report → review → apply. The live Gryfin site + DB are never touched.

## Bigger picture — this is Phase C of `docs/API_GATEWAY_AND_MULTI_TENANT_BREEDERS.md`

Gryfin is **breeder #1**. The full vision (the user's 2026-09-10 framing): Monika manages her
kennel, dogs, litters, puppies, posts and public profile entirely from the **Anemalo breeder
panel**, and that one dataset powers (a) her `hodowlagryfinyork.pl` site via `api.anemalo.com`,
(b) her public `anemalo.com/@gryfin-york` profile, (c) the Anemalo marketplace (indexable
immediately), (d) the pedigree graph. Sequencing after the data import:
- **Breeder-panel parity** with `/p/grif/c` — see `docs/BREEDER_PANEL_GAP_ANALYSIS.md` (gallery,
  social links, logo/cover upload, the `owns_org()`→`is_org_member()` widenings, `team.tsx`).
- **Social panel** — the redesigned `/@handle` profile + `KennelPostComposer` already exist
  (built this session); wire them into her flow.
- **Gateway site wiring** — a fork of `/p/grif/p` that reads `api.anemalo.com/v1/site-content?org=gryfin-york`
  instead of its own Supabase, leaving her live site untouched until cutover.
