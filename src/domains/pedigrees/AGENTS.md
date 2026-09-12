# Pedigrees domain

The pedigree graph: permanent dog identities, parent-child relationships with per-edge
verification, breeder document submissions, and dog-ownership claims. See `docs/PEDIGREE_GRAPH.md`.

## ⚠ The barrel comment is stale — the migration IS applied

`index.ts:4-8` says: "Backed by `supabase/migrations/20260910000100_pedigree_graph_schema.sql` +
`20260910000200_pedigree_graph_rpcs.sql`. Those migrations are written but **NOT YET APPLIED** to
the live project, so `src/lib/supabase/types.ts` has **no pedigree tables**... Everything here
compiles and is logically correct against the migration; none of it is DB-verified yet."

**This is no longer true.** `src/lib/supabase/types.ts` (checked 2026-09-12, after this session's
own type regeneration) contains real references to `dogs`, `dog_parent_relationships`,
`pedigree_sources`, and `pedigree_submissions`, plus the `pedigree_parent_role` and
`pedigree_verification_level` enums. The schema is applied. **Update `index.ts`'s header comment
when next touching this domain** — left as-is in this pass since editing it wasn't this pass's
purpose, but it will actively mislead the next person who reads it first.

## What this owns

- `dogs`, `dog_parent_relationships` — `getDogById`, `getDogBySlug`, `getDogsByIds`, `searchDogs`,
  `getDogEvidenceSummary` (`services/dogs.ts`, 266 lines); `getAncestorTree`,
  `computeTreeCompleteness` (`services/tree.ts`, 202 lines) — per-edge `verification_level`, never
  a blanket "this litter is verified" flag (per `docs/DOMAIN_MODEL.md`).
- `pedigree_sources`, `pedigree_submissions` — `createPedigreeSubmission`,
  `uploadPedigreeSourceDocument`, `listKennelDogIdentities`, `listMySubmissions`, `getSubmission`,
  `listSubmissionResolutions`, `listSubmissionAncestorSlots`, `resolvePedigreeSlot`
  (`services/submissions.ts`, 305 lines). **`PEDIGREE_SOURCES_BUCKET = "pedigree-sources"`
  (`services/submissions.ts:1`) is a real, working Supabase Storage bucket with an upload function
  already wired** (`uploadPedigreeSourceDocument`) — directly relevant prior art for any future
  document-upload need (e.g. the WNI/kennel-club evidence upload flagged in the repo-root
  `TODO.md` — that work should reuse this bucket/pattern rather than building new storage wiring).
- Dog ownership claims — `createDogClaim`/`listMyDogClaims` (`services/claims.ts`).
- `services/client.ts` — `getPedigreeClient()`, a loosely-typed Supabase client wrapper. Per the
  (stale) barrel comment this existed because the schema wasn't in the generated types yet; now
  that it is, whether this domain still needs its own client wrapper instead of the standard
  `getSupabaseBrowserClient()` used everywhere else wasn't re-evaluated in this pass.
- `services/extraction.ts` — `PedigreeDocumentExtractor` interface + a `noopExtractor` currently
  assigned as the live `pedigreeDocumentExtractor` — i.e. automatic data extraction from an
  uploaded pedigree document is a defined contract with **no real implementation yet** (a stub, not
  a partial one — always returns nothing).

## File structure

- `index.ts` — re-exports `types`, `services/dogs`, `services/tree`, `services/submissions`,
  `services/claims`, `services/extraction`. Note: does **not** re-export `services/client` — that
  file is internal-only, consistent with the domain's own "never reach into `./services` directly"
  rule applying even to itself.
- `types.ts` — shared type contracts for the above.
- `services/dogs.ts`, `services/tree.ts`, `services/submissions.ts`, `services/claims.ts`,
  `services/extraction.ts`, `services/client.ts` — described above.

## Public API

`index.ts` exports `types`, `dogs`, `tree`, `submissions`, `claims`, `extraction` — deliberately
excludes `client.ts`.

## Known gaps

- Barrel comment is stale (see the warning above) — fix it next time this domain is touched.
- `pedigreeDocumentExtractor` is a no-op stub — no automatic extraction from uploaded documents
  happens; every submission requires full manual data entry today.
- Whether `services/client.ts`'s loosely-typed client wrapper is still necessary now that the
  schema is in the generated types was not re-evaluated in this pass.

## Related docs

- `docs/PEDIGREE_GRAPH.md` — the schema/design doc, cited in `index.ts:2`.
- `docs/DOMAIN_MODEL.md` — per-edge verification-level posture.
- Repo-root `TODO.md` — the WNI/document-upload item that should reuse this domain's storage
  pattern.

## Last significant change

Schema applied at some point after the 2026-09-10 migration files were written and before
2026-09-12 (exact date not determined in this pass — confirmed only by presence in the regenerated
`src/lib/supabase/types.ts`, not by a specific commit/log entry). File created 2026-09-12 as part
of the project-wide `AGENTS.md` rollout, which is also when the stale barrel-comment discrepancy
was first caught and documented.
