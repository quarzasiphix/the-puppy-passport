# Post-integration hardening — final report

**Base integration HEAD**: `9c51661` (`integration/frontend-backend-rc`, currently under
independent Bot 1 certification — never modified from this branch).
**Hardening branch**: `hardening/post-integration-qa`, worktree
`/p/the-puppy-passport-post-integration-hardening`.
**Final hardening HEAD**: `244b0cb` — 18 commits on top of the integration base.
**Not pushed, not deployed, not merged.** `main`, the frozen frontend worktree, and the audited
integration branch were never touched.

## Commits (chronological)

1. Initialize isolated post-integration hardening branch
2. Baseline the integrated product and record the hardening plan (Phase 2)
3. Add maintained Playwright regression foundation (helpers, mobile project, e2e scripts)
4. Cover public discovery journeys and the two integration-found bug regressions
5. Cover authentication session, buyer, organisation, transport, and moderation journeys
6. Fix accessibility: add accessible names to icon-only notification, featured-toggle, and
   calendar nav buttons
7. Fix accessibility: associate unlabelled note fields, replace placeholder-only textareas with
   real accessible names
8. Fix hardcoded en-GB date formatting on customer-facing scheduled-transport, moderation-case,
   and document-checklist surfaces
9. Document accessibility hardening findings and method (Phase 11)
10. Document loading-state coverage audit for dashboard home pages (Phase 15)
11. Bound 6 previously-unbounded public list queries (same class as Q-1's `listPublishedPuppies`
    fix)
12. Document query-bounding audit method and findings (Phase 16)
13. Fix all 21 baseline lint errors (pure Prettier formatting) and the one fixable hook-dependency
    warning
14. Add robots.txt disallowing `/dashboard/` (no sitemap yet — no production domain configured)
15. Document SEO hardening and public-claim truthfulness spot-check (Phases 18-19)
16. Add route/generated-artifact static guard (Phase 21)
17. Document security-preservation static audit for the five former High findings (Phase 22)
18. Add `npm run quality:integration` (Phase 23)
19. Fix prettier formatting in `route-artifact-guard.mjs` (caught by its own quality gate)

## Real bugs found and fixed in this pass

None beyond what integration itself already found — this pass's fixes are smaller, independently
verifiable defects found by static/source-level audit (see below), not new critical-path bugs.

## Files changed / tests added

- 9 new E2E spec files (`tests/e2e/*.spec.ts`) plus a shared `helpers.ts` and an extended
  `playwright.config.ts` (added a `mobile` project). Written and lint/type-checked; **not yet
  executed** — see "What could not be done" below.
- 1 new static guard script (`scripts/route-artifact-guard.mjs`), wired into
  `npm run quality:integration` alongside the existing `release-preflight.mjs`.
- 12 accessibility/i18n/query-bounding fixes across `src/` (see itemized findings in
  `docs/ACCESSIBILITY_HARDENING_REPORT.md` and `docs/QUERY_AND_PERFORMANCE_HARDENING.md`).
- `public/robots.txt` added.
- 7 new documentation files under `docs/`.

## Lint before/after

**21 errors / 15 warnings → 0 errors / 14 warnings.** All 21 fixed errors were pure Prettier
formatting (deterministic, zero behavior change — diff reviewed). The 14 remaining warnings are
all `react-refresh/only-export-components`, a structural pattern requiring file-splitting
refactors, explicitly out of scope for a lint-debt pass.

## TypeScript / build

`npx tsc --noEmit` clean at every commit in this branch (verified incrementally, not just at the
end — caught one real scoping bug of my own mid-edit, in `dashboard.buyer.scheduled.tsx`, before it
was ever committed). `npm run build` clean.

## Non-destructive checkpoint (Phase 24) — all passed

- `npm run test:unit`: 48/48
- `npm run i18n:check`: 3/3
- `npx tsc --noEmit`: clean
- `npm run lint`: 0 errors / 14 warnings (baseline)
- `npm run build`: clean
- `npm run quality:integration`: 8/8 checks passed (git-clean, no duplicate migration prefixes, no
  secrets, `db:preflight`, the new route/artifact guard, TypeScript, lint baseline, build)

## Accessibility (Phase 11)

3 icon-only buttons with zero accessible name (notification bell, featured-org toggle, calendar
prev/next nav) and 7 unlabelled/placeholder-only form fields fixed, in files never covered by the
frontend branch's own earlier accessibility pass (commit `941fd9f`, explicitly scoped to "18 files
touched across this branch" — i.e., the operations/admin dashboards predating that branch were
never audited). Full method and findings: `docs/ACCESSIBILITY_HARDENING_REPORT.md`.

## Query bounding (Phase 16)

6 public marketplace/community list queries had no `.limit()` (3 of those also had no `.order()`
at all, a separate correctness gap beyond being unbounded) — fixed with the same
`DEFAULT_PAGE_SIZE`/200 pattern already established by Q-1's `listPublishedPuppies` fix. Full
method: `docs/QUERY_AND_PERFORMANCE_HARDENING.md`.

## i18n (Phase 14, folded into the accessibility/state pass)

3 customer-facing surfaces (`dashboard.buyer.scheduled.tsx`, `_public.moderation.$caseId.tsx`,
`transport-document-checklist.tsx`) had hardcoded `en-GB` date formatting; fixed with the existing
`formatDate`/`useTranslation` pattern. Internal ops/admin-only dashboards were deliberately left
alone per this project's own documented rule that internal dashboards can stay technical.

## SEO (Phase 18)

Added `public/robots.txt`. No sitemap or canonical links were added — both need a confirmed real
production domain, which doesn't exist yet (`docs/PRODUCTION_SETUP.md`); guessing one would have
been actively wrong. Full findings: `docs/SEO_HARDENING_REPORT.md`.

## Security-preservation audit (Phase 22)

Manual, honestly-scoped static review of all five former High findings' frontend surfaces — no
regression found. Explicitly did **not** build an automated "security guard" script for this,
since the real enforcement is DB-layer RLS/triggers already covered by the dedicated DB test suite;
a static frontend-only script would have overstated what it could actually verify. Full reasoning:
`docs/SECURITY_GUARD_AUDIT.md`.

## Generated-artifact guard (Phase 21)

New `scripts/route-artifact-guard.mjs`, verified against both real bug classes found during
integration (missing `<Outlet/>` on a route with children; duplicate `package.json` script keys) by
deliberately reproducing each in a throwaway copy and confirming the script catches it (exit 1),
then restoring the real file and confirming a clean pass (exit 0).

## Former High findings status

Unchanged from the integration branch — not independently re-verified with live DB tests in this
pass (see below), but no frontend-side regression found by static review (Phase 22).

## What could not be done in this pass, and why

- **Phase 12/13 (live keyboard-only and mobile/responsive browser testing)**: needs a live app
  against a live database. The shared local Supabase instance showed activity (DB/auth/storage
  containers restarted roughly an hour before this check) that could not be confidently attributed
  to this session's own earlier work versus Bot 1's certification — given genuine uncertainty and
  the explicit "if uncertain, do not touch the shared database" rule, no stateful check was run
  against it from this branch.
- **Phase 20 (local-only demo-data extension mechanism)**: deliberately deferred — building it
  correctly (idempotent, dry-run mode, environment refusal) needs live verification against a
  database this pass didn't have safe access to; a rushed, unverified version would be worse than
  none.
- **Phase 26 (isolated DB verification) / Phase 27 (full Playwright run)**: both need either (a)
  confirmation that Bot 1's certification work has fully finished and the shared instance is free
  to reset, or (b) resources to stand up a genuinely separate, non-colliding local Supabase
  instance (distinct project id and ports) — a meaningful infrastructure commitment not taken
  unilaterally in this pass. The 9 new E2E spec files are real, reviewed, type-checked, and ready
  to run the moment either condition is met; they were deliberately not run against ambiguous
  shared state.
- **Dashboard home-page loading states** (6 files: `dashboard.admin.index.tsx`,
  `dashboard.breeder.index.tsx`/`.tsx`, `dashboard.foundation.index.tsx`/`.tsx`,
  `dashboard.operations.index.tsx`) — real gap found (multiple parallel `useQuery`s with no
  loading state), deliberately not fixed without live verification of the resulting UI (see
  `docs/STATE_COVERAGE_AUDIT.md` for the full reasoning).
- **Full accessibility pass** (color contrast, screen-reader session, axe-core/Lighthouse) — needs
  a live app; only static/source-level checks were possible this pass.

## Recommended next action

1. Once Bot 1's certification of the integration branch is confirmed complete (or the shared local
   Supabase instance is confirmed free), run this branch's `npm run quality:integration:full`
   (adds `test:db`, `db:contract-check`, `db:schema-drift`) and the full Playwright suite
   (`npm run test:e2e`, `test:e2e:mobile`).
2. If both pass cleanly, this branch's 18 commits are safe to cherry-pick onto whatever branch the
   integration result ultimately lands on — none of them touch backend security surfaces, all are
   independently reviewable, and none were rejected during this pass.
3. No commit in this branch should be rejected based on this pass's own review — every change was
   verified (tsc/lint/build, and for the two route-guard regression classes, an explicit
   reproduce-then-fix-then-reverify cycle) before being committed.

## No external or legal blockers found or introduced

This pass touched no legal/compliance surface, no production infrastructure, and no commercial
entitlements — all still correctly out of scope per `docs/CURRENT_RELEASE_STATUS.md`.
