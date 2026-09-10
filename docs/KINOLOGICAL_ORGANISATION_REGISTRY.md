# Kinological organisation registry — design (Phase E)

Status: **design doc, 2026-09-10. No schema applied.** A draft migration
(`supabase/migrations/20260910100000_kinological_organisations.sql`) accompanies this doc, marked
`NOT APPLIED`. This supersedes and folds in the earlier lightweight sketch
`docs/TODO_KENNEL_ASSOCIATIONS_REGISTRY.md` (now deleted).

## What this is

A **worldwide, structured directory of kennel clubs, cynological federations, national registries
and breed clubs** — FCI and its member national clubs (ZKwP / PKR in Poland, VDH in Germany, The
Kennel Club in the UK), non-FCI registries (AKC, UKC), independent registries, and breed-specific
clubs. Not a free-text field: a real, searchable, referenceable entity.

Three consumers:

1. **Breeder profiles** — replace the free-text `organisations.association_name` with a real
   reference + a proper membership relation ("this kennel is a member of ZKwP, number 12345,
   breeder-declared"). Powers the existing `organisation_trust_claims` `association` claim
   precisely.
2. **Pedigree provenance** — a `pedigree_sources` row can attribute a pedigree document to the
   registry that issued it, even when that registry is not an Anemalo tenant.
3. **SEO** — permanent indexable directory pages (`/organisations`, `/organisations/:country`,
   `/organisation/:slug`) — strong long-tail surface (country × registry × breed).

## Naming — why `kinological_organisations`, and how it relates to `organisations`

Anemalo already has:

- `public.organisations` — the **tenant** table (kennels, foundations, shelters). Has an owner,
  members, a `plan`, verification, RLS scoped by `owns_org()` / `is_org_member()`.
- `org_type` enum — includes `kennel_club` and `other`.

A federation like FCI is **not an Anemalo tenant** — nobody "owns" it, it has no `plan`, it isn't
onboarded. Overloading `organisations` with non-tenant rows would break every `owns_org()`-scoped
query's assumptions. So the registry is a **separate reference table**.

Chosen name: **`kinological_organisations`** (British `-isation` spelling, matching the codebase;
"kinological" per the product owner's framing, cf. Polish *związek kynologiczny*). It reads
clearly next to `organisations` and never collides in a query.

**Bridge, not merge**: when an Anemalo tenant *is also* itself a kennel club (an
`organisations` row with `org_type = 'kennel_club'` that also runs a registry), a nullable
`kinological_organisations.linked_organisation_id` FK ties the two — the tenant row stays the
thing with members/plan, the registry row stays the thing pedigrees and memberships point at.

## Entity: `kinological_organisations`

| Column | Type | Note |
|---|---|---|
| `id` | uuid pk | |
| `name` | text not null | official name, source language |
| `name_localised` | jsonb not null default `'{}'` | `{ "pl": "Związek Kynologiczny w Polsce", "en": "Polish Kennel Club" }` — localisation matters here |
| `short_name` | text | `ZKwP`, `FCI`, `AKC` |
| `slug` | text unique not null | for `/organisation/:slug` |
| `country` | text | ISO-ish country name; **null for international bodies** (FCI) |
| `region` | text | sub-national region for a regional branch (`Dolnośląskie`) |
| `organisation_type` | enum `kinological_organisation_type` | see below |
| `official_website` | text | |
| `description` | text | factual blurb, no evaluative language (see "Trust rule") |
| `logo_url` | text | |
| `status` | enum `kinological_organisation_status` | `active` \| `historical` \| `merged` \| `dissolved` — a **fact about the org**, not a judgement |
| `verification_status` | enum `kinological_organisation_verification` | `unverified` \| `verified` \| `disputed` — whether *Anemalo staff* confirmed the directory entry is real; never `legitimate`/`scam` |
| `verified_by` / `verified_at` | uuid / timestamptz | audit of the directory entry itself |
| `linked_organisation_id` | uuid null → `organisations(id)` | when this registry is also an Anemalo tenant |
| `created_by` | uuid null → `profiles(id)` | null for a seeded/curated row |
| `created_at` / `updated_at` | timestamptz | |

### `kinological_organisation_type` enum

`international_federation` (FCI, WUSV) ·
`national_registry` / national kennel club (ZKwP, VDH, The Kennel Club) ·
`kennel_club` (a club that is not the sole national body) ·
`breed_club` (Klub Yorkshire Terriera) ·
`regional_branch` (Oddział ZKwP we Wrocławiu) ·
`independent_registry` (a registry outside the FCI system) ·
`association` (an umbrella / professional association that isn't itself a registry).

Deliberately flat — the *structure* between orgs lives in the relationships table, not in the type.

## Relationships: `kinological_organisation_relationships` (its own table, NOT a tree)

FCI structure is not a tree and non-FCI orgs don't fit one at all — a national club can be an FCI
member *and* recognise several foreign registries *and* have regional branches. Model each link
explicitly and directionally.

| Column | Type | Note |
|---|---|---|
| `id` | uuid pk | |
| `from_organisation_id` | uuid not null → `kinological_organisations(id)` | the subject |
| `to_organisation_id` | uuid not null → `kinological_organisations(id)` | the object |
| `relationship_type` | enum `kinological_relationship_type` | see below |
| `status` | enum `kinological_relationship_status` | `asserted` \| `verified` \| `disputed` \| `historical` |
| `since` / `until` | date null | when the relationship held |
| `evidence_note` | text | free-text provenance ("listed on fci.be member directory, retrieved 2026-09") |
| `source` | enum `kinological_fact_source` | `anemalo_curated` \| `organisation_declared` \| `community_suggested` \| `document` |
| `created_by` | uuid null → `profiles(id)` | |
| `created_at` / `updated_at` | timestamptz | |
| unique `(from_organisation_id, to_organisation_id, relationship_type)` | | one edge per type per pair |
| check `from_organisation_id <> to_organisation_id` | | no self-edge |

### `kinological_relationship_type` enum

`member_of` (generic membership) ·
`national_member_of` (a national club → its international federation: ZKwP → FCI) ·
`regional_branch_of` (Oddział → national club) ·
`affiliated_with` (looser cooperation, no membership) ·
`recognized_by` (registry A's pedigrees accepted by registry B).

Examples this models cleanly:
- `ZKwP —national_member_of→ FCI`
- `Oddział Wrocław —regional_branch_of→ ZKwP`
- `AKC —recognized_by→ FCI` (partial reciprocity) without AKC being an FCI member
- `Klub Yorkshire Terriera —member_of→ ZKwP` and `—affiliated_with→ (an international breed body)`

## Breeder membership: `breeder_organisation_memberships` (a relation, not a column)

A breeder's affiliation is a **claim with evidence and a lifecycle** — never a boolean or a text
field on `organisations`.

| Column | Type | Note |
|---|---|---|
| `id` | uuid pk | |
| `organisation_id` | uuid not null → `organisations(id)` | the Anemalo tenant kennel |
| `kinological_organisation_id` | uuid not null → `kinological_organisations(id)` | |
| `membership_number` | text | as issued by the registry |
| `membership_since` | date | |
| `status` | enum `breeder_membership_status` | `breeder_declared` \| `document_supplied` \| `verified` \| `expired` \| `disputed` |
| `evidence_note` | text | what backs the current status |
| `evidence_source_id` | uuid null → `pedigree_sources(id)` | reuse the existing evidence-document store when a membership card / certificate is uploaded |
| `declared_by` | uuid null → `profiles(id)` | who asserted it (the breeder) |
| `verified_by` / `verified_at` | uuid / timestamptz | who at Anemalo confirmed it, if anyone |
| `created_at` / `updated_at` | timestamptz | |
| unique `(organisation_id, kinological_organisation_id)` | | one membership row per (kennel, registry) |

**Claims stay separate from Anemalo-verified**: `status = 'breeder_declared'` and
`status = 'verified'` are different rows' states, and the UI must render the distinction (same
posture as `docs/PEDIGREE_GRAPH.md`'s per-edge verification level — never a blanket badge).

### Migration path off `organisations.association_name`

- Keep `organisations.association_name` (free text) **and** `organisation_trust_claims` as they are
  — no breaking rename.
- New `breeder_organisation_memberships` rows are the structured truth going forward.
- A later backfill can try to fuzzy-match existing `association_name` strings to
  `kinological_organisations` and create `status = 'breeder_declared'` rows for admin review —
  **not** in the draft migration.
- The `organisation_trust_claims` `association` claim can gain an optional
  `kinological_organisation_id` FK later so "the association claim" points at a real row.

## Pedigree linkage — smallest clean evolution

**What already exists (applied Pedigree V1):** `pedigree_sources` has `organisation_id`
(FK → `organisations`), `source_type` (enum includes `registry_record`, `association_import`), and
`document_metadata jsonb` (holds `source_pedigree_number`). So a pedigree document can already be
attributed to an Anemalo *tenant* org and carry the source registration number.

**The gap:** `organisation_id` can only point at an Anemalo tenant. FCI / ZKwP are not tenants, so
"this rodowód was issued by ZKwP" cannot be expressed.

**Recommendation — one additive column, no new table for v1:**

```sql
alter table public.pedigree_sources
  add column kinological_organisation_id uuid null references public.kinological_organisations(id);
```

That, plus the existing `document_metadata.source_pedigree_number`, fully covers "which registry
issued this pedigree document" without a schema rewrite.

**`dog_registry_identifiers` — deferred, not in the draft.** A dog can hold numbers in several
registries at once (FCI + national + breed club), and `dogs.pedigree_number` is a single column.
A future `dog_registry_identifiers (dog_id, kinological_organisation_id, registration_number,
source_id → pedigree_sources, verification_status)` is the right model for *displaying* per-dog
multi-registry identity — but it's only worth adding when the product surfaces that. For now the
pedigree-source attribution above is enough. This doc flags it; the migration doesn't create it.

## Trust rule — factual, never judgemental

Same discipline as the pedigree graph and `organisation_trust_claims`:

- No column ever labels an organisation `legitimate` / `fake` / `reputable` / `scam` / `good` /
  `bad`. `status` describes existence (`active`/`historical`/`merged`/`dissolved`);
  `verification_status` describes only *whether Anemalo confirmed the directory entry is a real
  entity* (`unverified`/`verified`/`disputed`).
- Every relationship and membership carries `evidence_note` + `source` — the platform represents
  **facts, evidence, and claims separately** and renders them as such, it does not adjudicate an
  organisation's worth.
- Disputes are a state (`disputed`), surfaced, never silently resolved.

## Community "suggest a missing organisation" — mirror the pedigree submission model

Anon or authenticated users can **propose** a registry entry; they can never write a canonical
`kinological_organisations` row.

`kinological_organisation_suggestions`:

| Column | Type | Note |
|---|---|---|
| `id` | uuid pk | |
| `submitted_by` | uuid null → `profiles(id)` | null for anonymous |
| `contact_email` | text | optional, for anon follow-up |
| `proposed_data` | jsonb not null | name, country, type, website, short_name… |
| `relationship_hints` | jsonb | "member of FCI", free-form, for the reviewer |
| `status` | enum `kinological_suggestion_status` | `pending_review` \| `accepted` \| `merged_into_existing` \| `rejected` |
| `resolved_kinological_organisation_id` | uuid null → `kinological_organisations(id)` | set on accept/merge |
| `reviewer_id` / `reviewed_at` / `review_note` | uuid / timestamptz / text | |
| `created_at` | timestamptz | |

- INSERT granted to `anon` + `authenticated`, **rate-limited** (anon: an IP-based limiter like the
  one proposed for `submit_org_enquiry` in `docs/API_GATEWAY_AND_MULTI_TENANT_BREEDERS.md` §2 —
  `enforce_rate_limit()` no-ops for anon).
- SELECT: submitter sees their own; staff/admin see all. No public read.
- Promotion to a real row is an admin/staff action (a `promote_kinological_suggestion()` RPC,
  `SECURITY DEFINER`, `is_admin()` — **not** built this pass).
- **No moderation UI this pass** — table + RLS only.

## Public / SEO pages — plan only, no metrics

- `/organisations` — index: browse by type, country, first letter. (Alternative path `/registries`
  if `/organisations` reads as too close to the tenant `organisations` — flagged, product call.)
- `/organisations/:country` — all registries in a country + the national body highlighted.
- `/organisation/:slug` — one registry: localised name, type, country, official website,
  relationships (rendered as "Member of FCI", "12 regional branches", "Recognised by …" —
  factual), and **the list of Anemalo kennels with a `verified` membership** (never "declared" —
  don't imply Anemalo vouches for unverified claims), plus breed pages cross-linked.
- SSR `head()` per page (the stack SSRs every route — see `docs/SOCIAL_DOMAIN.md`), JSON-LD
  `Organization`. **No fabricated counts / ratings / "trusted by N breeders"** — only real
  `count(*)` of verified memberships, shown as a plain number or omitted when zero.
- Canonical: these pages are canonical on `anemalo.com`; a registry's own site is unrelated
  (different entity than a breeder's own domain — no duplicate-content tension here).

## Seeding strategy (not this pass)

Mixed: a curated starter seed of FCI + its ~100 member national clubs (a finite, well-documented,
publicly listed set) as `source = 'anemalo_curated'`, `verification_status = 'verified'`; then
organic growth via breeder self-entry and community suggestions with admin review. The draft
migration creates the tables **empty** — no seed rows (avoids shipping unverified data).

## Draft migration

`supabase/migrations/20260910100000_kinological_organisations.sql` — creates the 5 tables above,
their enums, RLS (public read on `kinological_organisations` +
`kinological_organisation_relationships` + verified `breeder_organisation_memberships`;
owner/`is_org_member`-scoped write on a kennel's own membership rows; staff-only canonical writes;
anon-insert + rate-limit on suggestions), and the one additive `pedigree_sources` column.

**It is commented `NOT APPLIED — draft for review` and has not been run.** It can be split into
`_registry`, `_memberships`, `_suggestions` migrations if reviewers prefer smaller units.

## Explicitly not done this pass

- No migration applied. No seed data.
- No `promote_kinological_suggestion()` RPC, no admin moderation UI, no breeder search/select UI.
- No `dog_registry_identifiers` table (deferred by recommendation above).
- No backfill of `organisations.association_name` → membership rows.
- No SEO pages built.
