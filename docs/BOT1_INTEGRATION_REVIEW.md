# Bot 1 — Integration Review (Finalisation Pass)

One row per file the frozen `ux-marketplace-frontend-pass` branch would conflict (or not) with the
current backend `main` (`26f1b2e`), computed via a real `git merge-tree --write-tree` 3-way merge
(not a file-touch heuristic). The frontend ref is unchanged since the last remediation pass
(`727d551b8306cf6bd5ce8a2b542ac118b1c4f417`, re-confirmed via `git fetch origin
ux-marketplace-frontend-pass` this pass — identical hash), and zero backend commits in the
`c8bc235..26f1b2e` delta touch any file in this table, so the prior pass's `git merge-tree`
computation (`docs/BOT1_REMEDIATION_VERIFICATION.md` §48) remains the authoritative, current
answer — re-verified this pass by re-fetching the frontend ref and confirming its hash is
byte-identical, not merely re-asserted. Merge-base: `02e64163d2162024968bf0e79d6aa999af57ac63`.

| File | Conflict? | Nature | Recommended resolution |
|---|---|---|---|
| `src/lib/queries/marketplace.ts` | **Yes — 5 conflict hunks** | Deepest real conflict: both sides independently implemented the same litter/animal-count N+1 fix with different shapes (backend's `countAnimalsByStatusForLitters()`/async `mapLitterRow()` vs. frontend's `litterCountsBatch()`/sync `mapLitterRow(l, counts)`). | Manual combined implementation. Recommend keeping backend's batching logic (already tested this session) and adapting frontend's call-site signature. Needs a human or dedicated integration pass — not a mechanical merge. |
| `src/lib/queries/buyer-activity.ts` | **Yes — 2 conflict hunks** | One trivial import-line union; one real conflict — frontend split `listFollowedBreeders()` into org-type-aware `listFollowedBreeders()`/`listFollowedFoundations()` (a real UX feature), backend kept the single simpler function. | Keep frontend's org-type split; reapply on top of backend's underlying query changes. |
| `src/routes/dashboard.buyer.quotations.tsx` | **Yes — 1 conflict hunk, trivial** | Single import-statement collision (backend added `documentExpiryWarning`; frontend added i18n/empty-state imports on the adjacent line). Actual logic (backend's `respond_to_quotation()` rewire, frontend's UI polish) sits in non-overlapping regions. | Trivial — union the import list. Lowest risk of the three real conflicts. |
| `src/routes/dashboard.buyer.transport.tsx` | No — auto-merges clean | Post-divergence backend and frontend edits sit in disjoint regions. | None needed beyond the standard post-merge test pass. |
| `src/routeTree.gen.ts` | No — auto-merges clean (must still be regenerated, never hand-merged) | Generated file. | Regenerate via a dev-server run or build after any real merge; do not trust the mechanical merge result as final. |
| `src/routes/_public.planned-routes.tsx` | No — auto-merges clean | Disjoint regions. | None. |
| `src/routes/_public.transport.index.tsx` | No — auto-merges clean | Disjoint regions. | None. |
| `package.json` | No — auto-merges clean | Dependency-only changes on both sides. | Regenerate lockfile after merge; sanity-check no duplicate/conflicting dependency version. |
| `src/lib/queries/profile.ts` | No — auto-merges clean | Pure end-of-file appends on both sides, different regions. | None. |
| `src/lib/queries/matching.ts` | No — frontend doesn't touch this file at all | New post-divergence backend-only commit (`e005868`, route-matching capacity batching). | None — no frontend awareness needed. |
| `src/lib/notification-templates.ts` | No — frontend doesn't touch this file at all | Backend-only (this finalisation pass's own delta confirms further backend-only churn here, Stage YR-1 category/template coupling fix — still no frontend touch). | None. |
| `src/lib/queries/community.ts` | No — zero post-divergence commits on either side | Not a conflict risk. | None. |
| Generated Supabase types (`src/lib/supabase/types.ts`) | N/A — not in the frontend diff, but must be regenerated | Touched 3× in the remediation-pass delta; the finalisation-pass delta added no new migrations, so no further regeneration need was introduced this pass. | Regenerate fresh (`npm run db:types`) after any real merge, never hand-merge. |

**Required tests after any real merge**: full `test:db` suite (validates backend RLS/RPC changes
survived unmutated), `tsc --noEmit` (catches type drift, especially `marketplace.ts`'s differing
function signatures), and a manual smoke test of the marketplace listing page (litter counts), the
buyer's followed-organisations page, and the buyer quotations page's accept/reject flow — the last
of which now also needs to specifically exercise `respond_to_quotation()`'s 2-argument RPC call
signature end-to-end through whatever UI wiring the merge produces, since NEW-H1
(`docs/BOT1_FINALISATION_AUDIT.md` §7) means the *raw* `transport_requests` status flip this RPC is
meant to gate is still directly reachable — an integration smoke test that only exercises the
frontend's "happy path" button would not surface that this control is RLS/trigger-layer porous, only
a deliberate raw-API attempt (or a backend regression test) would.

**Is the prior conflict map still current?** Yes, in full — this pass independently re-confirmed
both preconditions for reuse (identical frontend ref hash; zero backend file changes in this pass's
own delta window overlapping any row above) rather than assuming the prior computation still
applies. No new conflict was introduced or resolved since the last pass.

**Limitation**: like the prior pass, this is a real textual 3-way merge computation, not a semantic
one — auto-merging cleanly does not by itself prove the merged file is behaviourally correct at
runtime. A real merge attempt plus `tsc`/a smoke test remains necessary before trusting any row in
this table in production.
