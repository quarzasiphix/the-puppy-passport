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

## Status — ✅ IMPORTED 2026-09-10

Applied to `anemalo` (`pgzvkkybqrhxedjoyjzy`) as migration `import_gryfin_york_kennel`, one
transaction. Live Gryfin site + DB untouched. Verified row counts:

| target | rows |
|---|---|
| `organisations` (`slug='gryfin-york'`) | 1 |
| `organisation_site_configurations` | 1 |
| `organisation_domains` (`hodowlagryfinyork.pl` + `www.`) | 2 |
| `organisation_members` (Monika = `owner`) | 1 |
| `breeds` (`yorkshire-terrier`, `size_category='small'`) | 1 |
| `parent_dogs` | 11 |
| `litters` (2 `born`, 2 `planned`) | 4 |
| `animals` (`breeder_puppy`; 7 `sold` → Alumni, Timon `reserved`) | 8 |
| `animal_images` | 55 |
| `auth.users` + `auth.identities` + `profiles` (`ja@hodowlagryfinyork.pl`) | 1 each |
| `user_roles` (`breeder` / `active`) | 1 |
| pedigree graph `dogs` (auto, 11 parent + 8 puppy) | 19 |
| pedigree graph `dog_parent_relationships` (auto; Miot S has no dam → 4×1 + 4×2) | 12 |

`get_advisors(security)` after apply: no new findings — the import is pure DML into existing
already-RLS'd tables (+ one `breeds` row), zero DDL. Deterministic UUIDs are in
`.gryfin-migration/id-map.json`.

**Monika's first sign-in**: her `auth.users` row has `email_confirmed_at` set and no password.
She signs in via a magic link / password reset to `ja@hodowlagryfinyork.pl`. Add
`https://anemalo.com/auth/callback` to the project's Auth → Redirect URLs first (see main CLAUDE.md).

### Follow-ups (raised by the user 2026-09-10, not yet done)

1. **Retire the seed/demo kennels** once Gryfin is fully live in the network — 3 orgs remain from
   `supabase/seed.sql` (`cichy-las` 7 animals, `wolna-dolina` 3, `ratunek-dla-psow` 1 foundation),
   all under `10000000-…` / `20000000-…` UUIDs. Goal: production shows only real Gryfin data.
2. **Clickable parents on the puppy page** — `src/routes/_public/puppies.$id.tsx` `ParentCard`
   is static. `getLitterParents()` (`src/domains/marketplace/services/marketplace.ts:563`) must
   also return each parent's pedigree-graph `dogs.slug` so the card links to…
3. **The individual dog page already exists**: `src/routes/_public/dogs.$slug.tsx` (pedigree
   identity, 5-gen ancestor tree, evidence badges, claim flow). It just needs to be linked to from
   the puppy page (2) and the breeder profile dog list.

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

## Gateway wiring — status (2026-09-10)

Done, on branches (both repos need a deploy):

- **`anemalo/app`** migration `20260910100000_public_parent_dogs_view.sql` — *applied*. New
  `public_parent_dogs` anon view = a kennel's breeding stock (`parent_dogs`, approved+public
  kennels only, no `microchip_number`), carrying the linked pedigree `dogs.slug`.
- **`anemalo-gateway`** commit *"site-content: split breeding stock from the pedigree graph"* —
  pushed to `main` and **live** (the gateway auto-deploys from GitHub — no `wrangler deploy`).
  Verified against `api.anemalo.com`: `dogs` = 11 (from `public_parent_dogs`), `pedigreeDogs` =
  19, `pedigreeRelationships` = 12.
- **`/p/grif/p`** branch `anemalo-gateway` — commit *"read site content from the Anemalo
  platform"*. `src/lib/{api,mappers,anemalo-types,site-fallback}.ts` only; domain types and every
  component/route unchanged. `main` still serves the live site. See `/p/grif/p/NOTES-ANEMALO.md`
  for the remaining gaps (testimonials + standalone gallery have no Anemalo home yet;
  phone/email/socials come from a per-site fallback file).

The gateway side is done and live; what's left is to build/preview the `/p/grif/p` branch.
