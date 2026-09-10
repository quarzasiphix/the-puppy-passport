# Pedigree graph (Pedigree V1)

Status (updated 2026-09-11): **applied and live** on the `anemalo` project. Both migrations
(`20260910000100_pedigree_graph_schema.sql`, `20260910000200_pedigree_graph_rpcs.sql`, plus two
small advisor-fixup follow-ups) are on the DB; all 6 RPCs exist
(`create_pedigree_submission`, `attach_pedigree_submission_document`, `resolve_pedigree_slot`,
`finalize_pedigree_submission`, `attach_breeder_pedigree_source`, `search_dogs_ranked`).

Real production data: **36 `dogs`, 29 `dog_parent_relationships`, 5 `pedigree_sources`**
(populated automatically by the identity trigger when GRYFIN YORK's breeding stock was imported —
see `docs/GRYFIN_IMPORT.md`). `search_dogs_ranked('Tina', 5)` verified live, returns a correctly
ranked real match. `/pedigrees` (search) and `/pedigrees/add` (the submission wizard — upload a
document or type ancestors in, 6-slot v1: subject's parents + grandparents) both render 200
against live data, checked directly.

**Still genuinely untested**: `pedigree_submissions` and `dog_claims` are both **0 rows** — no
real user has ever run the create-submission → resolve-slot → finalize write path end-to-end, or
the dog-claim flow, through the actual UI. The RPCs and pages exist and are logically sound, but
nobody has clicked through them for real yet.

## The model — every concept is its own row

| Concept | Table | Note |
|---|---|---|
| **Dog identity** | `dogs` | Permanent. Independent of any listing or breeding-stock record. A foreign / historical / deceased ancestor known only from a scanned document is a `dogs` row with no `parent_dogs` / `animals` row at all. |
| **Parent relationship** | `dog_parent_relationships` | One sire/dam **edge** between two `dogs`. Carries its own `verification_level` and a `status` (`active` / `disputed` / `rejected`). A partial-unique index enforces at most one *active* parent per (child, role); a competing claim moves both rows to `disputed` — never a silent overwrite. |
| **Source** | `pedigree_sources` | One piece of evidence — an upload, a breeder declaration, a future registry record, DNA evidence. Carries the private document pointer (`pedigree-sources` bucket) and a `review_state`. |
| **Edge ↔ source** | `pedigree_relationship_sources` | M:N. "Two independent pedigree documents support the same relationship" is the normal case, not an error. `recompute_dog_parent_relationship_verification()` derives the edge's `verification_level` from the set of accepted sources attached to it. |
| **Submission** | `pedigree_submissions` | One "Add pedigree" contribution attempt (`upload` / `manual_entry` / `build_from_existing`). `submitted_by` is null for an anonymous visitor. Always `pending_review` until staff/owner action. |
| **Per-slot review decision** | `pedigree_submission_resolutions` | `slot_key` `''` = the subject dog, then a dot path of `sire`/`dam` segments. `action` = `use_existing` / `create_new` / `skip`. A slot cannot be resolved before its parent slot. |
| **Duplicate-match audit** | `dog_match_candidates` | What the matcher surfaced for a submission slot + the human's `confirmed_duplicate` / `confirmed_distinct` verdict. Never an automatic merge. |
| **Ownership / breeder claim** | `dog_claims` | "Is this your dog / kennel." `owner` or `breeder`. Reviewed separately; claiming never by itself grants edit rights over verified pedigree history. |

Ownership, breeder-of-record, record-contributor and source-authority are **four separate
concepts** — `dogs.current_owner_profile_id`, `dogs.kennel_id`, `pedigree_sources.submitted_by`,
and `pedigree_sources.organisation_id` / `source_type` respectively. None implies another.

## Write paths (part-2 RPCs) — canonical writes are DB-enforced, not UI convention

Part-1 RLS grants **no** direct `insert`/`update` on `dogs` or `dog_parent_relationships` to
`anon`/`authenticated`. Every mutation goes through a `SECURITY DEFINER` function:

- **Auto-identity triggers** — a new `parent_dogs` / `animals` row gets a `dogs` row; a litter's
  puppies inherit the litter's sire/dam as `breeder_confirmed` edges. "Enter once, reused
  everywhere" with zero extra steps for existing breeder data (a backfill `do` block does the
  same for rows that already exist).
- **`create_pedigree_submission`** (anon + authenticated) — a `pending_review` row + its paired
  source. Anonymous ⇒ `submitted_by = null`, never a canonical write.
- **`resolve_pedigree_slot`** (authenticated; submission owner or staff) — records one slot
  decision; `create_new` mints a brand-new ancestor `dogs` row (the only canonical write a
  contributor can trigger, and only for a new node — never an edit of an existing dog).
- **`finalize_pedigree_submission`** (staff/admin only) — promotes resolved slots to canonical
  edges via `upsert_parent_relationship()` (which disputes rather than overwrites a conflict).
- **`attach_breeder_pedigree_source`** (authenticated; `owns_org` verified) — a breeder attaches
  a source + edges to a dog their kennel already owns; canonical immediately, no queue.
- **`search_dogs_ranked`** (anon + authenticated, read-only) — exact registration-number /
  microchip hit ranks 100 / 90; fuzzy trigram name match 0–60. Load-bearing for import dedup.

## Data integrity

- **Anonymous writes never reach canonical records.** No anon table grant on `dogs` /
  `dog_parent_relationships`; anon can only call `create_pedigree_submission` /
  `attach_pedigree_submission_document`, both of which produce a `pending_review` row with
  `submitted_by = null`. `finalize_*` is staff-only.
- **Provenance / attribution is preserved.** Every edge links to its source(s) via
  `pedigree_relationship_sources`; each source keeps `submitted_by`, `organisation_id`,
  `source_type`, `submitted_at`, `review_state`, `reviewed_by`. The public dog page renders the
  edge's `verification_level` per relationship, never a blanket "verified" badge (matches
  `docs/POK_INTEGRATION.md`'s display contract).
- **No silent fuzzy merges.** A second source naming the *same* parent attaches to the existing
  edge. A second source naming a *different* parent for the same (child, role) moves both rows to
  `disputed` and surfaces them. Duplicate dogs are surfaced as `dog_match_candidates` for human
  verdict, never auto-merged.

## POK comparison (`/p/pok`)

| POK | Anemalo | Why |
|---|---|---|
| `dogs_registry.father_id` / `mother_id` (plain self-FK, one canonical parent per role) | `dog_parent_relationships` table with `verification_level` + `disputed` status + M:N sources | POK **is** the registry authority — one parent per role is always right. Anemalo is crowdsourced and multi-source. |
| `source_pedigrees` (`unique(dog_id)`, one external-registry pedigree per dog) | `pedigree_sources` (many per dog via many edges; `source_type` spans upload / declaration / DNA / registry / import) | Generalised from "one registry pedigree" to "any evidence item". |
| `pedigreeTree.ts` in-memory walk over a loaded `dogs` array; `father`/`mother` keys | `services/tree.ts` breadth-first, one batched round-trip per generation; cycle-safe; a node carries the **edge's** verification level + status | Same tree-walk shape (`allPathsAtDepth`, completeness count adapted), different data source and multi-source awareness. |
| `SourcePedigreeRedactor.tsx` — manual canvas redaction of a source scan | `pedigree_sources.public_redacted_path` column exists, unused | The human-in-the-loop redaction tool is the reference for a future pass; not built. |
| Wizard OCR extraction anchored on the real PL template | `PedigreeDocumentExtractor` interface + no-op impl | Brief: do not fake OCR. |
| **Reusable as-is:** the generation-path enumeration, the "reopen an existing dog's tree" idea, the completeness math, the "text-only ancestor becomes a name-only leaf" fallback. |
| **Stays POK-specific:** member/application/document/office-decision tables, pedigree *issuance*, the single-authority assumption, the PL rodowód PDF template parsing. |

## The model does not block the roadmap

- **Reverse pedigree / descendants** — `dog_parent_relationships` is already queryable by
  `parent_dog_id` (indexed); a descendants view is a read, no schema change.
- **Siblings** — dogs sharing both parent edges; a query, no schema change.
- **Test mating / COI** — both are pure graph traversals over `dog_parent_relationships`; add a
  compute function later.
- **Completeness %** — `computeTreeCompleteness()` already exists client-side; can move to SQL.
- **Health overlays** — `dogs.health_tests jsonb` is carried through; a typed `dog_health_results`
  table can attach by `dog_id` without touching the graph.
- **Kennel analytics** — `dogs.kennel_id` + edges give per-kennel ancestry stats directly.
- **Embeds / SEO** — every dog has a stable `slug`; `_public/dogs.$slug` SSRs `head()` with a
  canonical link. An `<iframe>` embed route or an OG-image endpoint is additive.
- **Per-field provenance** (name/colour/title, not just the edge) — `PedigreeAssertion` in
  `types.ts` already models the target shape; a `pedigree_assertions` table attaches by `dog_id`
  later without reworking the graph.

## Files

- `supabase/migrations/20260910000100_pedigree_graph_schema.sql` (+ self-audit block at the end)
- `supabase/migrations/20260910000200_pedigree_graph_rpcs.sql`
- `src/domains/pedigrees/` — `types.ts`, `services/{client,dogs,tree,submissions,claims,extraction}.ts`, `index.ts`
- `src/routes/_public/dogs.$slug.tsx`, `pedigrees.tsx`, `pedigrees.add.tsx`
- `src/routes/_public/-components/pedigree/{evidence-badges,ancestor-tree}.tsx`
- `src/routes/dashboard/breeder/pedigrees.tsx` (+ nav entry in `src/app/config/navigation.ts`)
- `pedigree.*` i18n namespace in `src/shared/i18n/locales/{en,pl}.json`
