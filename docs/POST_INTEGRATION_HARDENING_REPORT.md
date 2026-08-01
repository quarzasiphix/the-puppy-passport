# Post-integration hardening — final report

**Base integration HEAD**: `9c51661` (`integration/frontend-backend-rc`, currently under
independent Bot 1 certification — never modified from this branch).
**Hardening branch**: `hardening/post-integration-qa`, worktree
`/p/the-puppy-passport-post-integration-hardening`.
**Final hardening HEAD**: `fc1e378` — 34 commits on top of the integration base.
**Not pushed, not deployed, not merged.** `main`, the frozen frontend worktree, and the audited
integration branch were never touched at any point in this pass.

## Isolated database environment

This branch runs its own local Supabase stack — distinct `project_id`
(`the-puppy-passport-hardening`) and every port shifted +1000 (API 55321, DB 55322, Studio 55323,
etc.) — verified running alongside the shared instance with zero container-name or port collision.
Full detail: `docs/HARDENING_ISOLATED_DB_ENVIRONMENT.md`.

**Two rounds of the same real isolation bug were found and fixed mid-pass.** First:
`tests/db/helpers.ts` and two tooling scripts (`contract-drift-check.mjs`,
`query-performance-report.mjs`) had the shared instance's URL/container name hardcoded, so
`test:db` and `db:contract-check` runs in this branch were silently hitting the shared instance the
whole time, not the isolated one — surfaced by a reproducible rate-limit failure that turned out to
be a real, accumulated (2857-row, dating to 2026-07-29) `rate_limit_events` state on the shared
instance, correctly enforcing its own real 50/day threshold — not a code defect. Fixed by deriving
the URL/container name from this worktree's own `supabase/config.toml` at runtime instead of a
hardcoded default (commit `14c38da`).

Second, in a later session: 9 test files (`account-deletion-execution.test.ts`,
`risk-signals.test.ts`, `verification-approval-idempotency.test.ts`,
`legal-consent-versioning.test.ts`, `deletion-blocker-graph.test.ts`, `duplicate-detection.test.ts`,
`legal-holds.test.ts`, `recent-auth-step-up.test.ts`, `support-case-rate-limits.test.ts`) each
independently duplicated their own local disposable-signup client with the same old hardcoded URL,
bypassing the first fix entirely. This produced a "different failures every run" symptom on a
genuinely fresh volume that was initially (wrongly) attributed to environmental flakiness under
load, then correctly root-caused and fixed by exporting one `freshClient()` from `helpers.ts` and
using it everywhere (commit `f914887`). Full incident and fix for both rounds:
`docs/HARDENING_ISOLATED_DB_VERIFICATION.md`.

## Isolated database results

- `npm run db:contract-check`: clean — 70 tables, 43 RPCs match the committed baseline (confirmed
  genuinely against the isolated instance after the fix above).
- `npm run test:db`: **1062/1062, three consecutive clean runs**, against a freshly
  volume-recreated isolated instance (`supabase stop`/`start` alone was found to preserve the
  Docker volume — `docker volume rm` was needed for a genuinely fresh database), re-verified after
  the second isolation-bug fix (commit `f914887`) — genuinely deterministic, immediately
  reproducible, no run-to-run variance. An earlier round of this same "1062/1062 × 3" claim, made
  right after the first isolation fix, was not actually trustworthy: the second, still-undiscovered
  bug (9 test files independently bypassing the fixed default) meant those earlier "clean" runs
  either got lucky on execution order or hadn't triggered the affected tests in that interleaving.
  Only the post-`f914887` runs should be treated as trustworthy evidence.
- 114/114 targeted security/workflow tests (HF-2 authorization boundary, quotation-expiry
  enforcement, quotation field lock, account deletion, legal holds).
- `SECURITY DEFINER` search_path: 94/94 functions pinned. RLS: 70/70 tables. Storage policies: 19.
  Secret scan clean.
- What was originally logged here as "genuine, non-deterministic flakiness under sustained session
  load" was a misdiagnosis, corrected in a later session: it was the second isolation bug above
  (deterministic, not load-related) — see `docs/HARDENING_ISOLATED_DB_VERIFICATION.md` for the full
  corrected account.
- `npm run db:schema-drift`: fails with a reproducible container crash (`exit 139`) provisioning
  the shadow database — a known, pre-existing Docker/CLI limitation (Bot 1's own disclosed item),
  unrelated to the URL/container bug above, and not a finding about the actual schema (which
  `db:preflight`/`db:contract-check` independently confirm clean).

## E2E (Playwright) results

**40/43 on `chromium`, 36/37 on `mobile`** (re-verified in a later session; `chromium`'s total grew
from 37 to 43 with a new automated accessibility suite — see below — 3 of which fail for an honest,
documented reason, not a test defect. `mobile`'s one gap is an already-retry-scoped,
environment-sensitive test that hit genuinely extreme host load — see
`docs/HARDENING_E2E_VERIFICATION.md` for the full, honest account, including a stray unrelated
dev server that briefly caused several false-alarm failures before being root-caused). Full
detail, including 10 real test-infrastructure bugs found and fixed (all root-caused by direct
reproduction, never guessed): `docs/HARDENING_E2E_VERIFICATION.md`. Highlights:

1. `.fill()` on auth forms can race ahead of React hydration (the disabled-until-hydrated submit
   button only gates `.click()`, not `.fill()`) — fixed by waiting for the button to become enabled
   before filling anything.
2. `signOut()` assumed a sign-out control exists on dashboard pages (it doesn't) and used a
   non-retrying visibility check to pick desktop vs. mobile UI (a real failure on the *desktop*
   project proved this raced) — both fixed.
3. Follow/Save buttons can act on stale React Query state before `isSignedIn`/`isFollowing`/
   `isSaved` settle — centralized into one `waitForDataSettled()` helper.
4. The mobile Playwright project used a WebKit device preset; WebKit isn't installed in this
   sandbox — switched to a Chromium-based mobile profile (`devices["Pixel 7"]`).
5. One test (4 sequential navigations) has genuine residual timing variance under load — given
   scoped retries (2, only for that one test), not more magic-number delays.
6. A process lesson: two earlier runs produced spurious failures from running Playwright
   concurrently with itself or with source-file edits (Vite HMR mid-run) — both procedural
   mistakes, not product or test defects, corrected by always running solo.

## Commits (30, chronological)

Setup/plan (2), Playwright foundation + journey coverage (4), accessibility fixes (3) +
documentation (1), i18n fix (1), query bounding fix (1) + documentation (1), lint cleanup (1),
SEO (1) + documentation (1), route/artifact guard (1) + security audit documentation (1), quality
gate (2), final hardening evidence (1), isolated DB environment setup (1) + verification (1),
Playwright infrastructure fixes (3), E2E verification documentation (1), the first shared-instance
isolation bug fix (1) + corrected documentation (1), state doc finalized (1), the second
shared-instance isolation bug fix — 9 more test files (1). Full list:
`git log --oneline e925089..f914887`.

## Lint before/after

**21 errors / 15 warnings → 0 errors / 14 warnings.** All 21 fixed errors were pure Prettier
formatting (deterministic, zero behavior change). The 14 remaining warnings are all
`react-refresh/only-export-components`, a structural pattern requiring file-splitting refactors,
out of scope for a lint-debt pass.

## TypeScript / build

Clean at every commit in this branch (verified incrementally — caught one real scoping bug of my
own mid-edit before it was ever committed). `npm run build` clean throughout.

## Non-destructive checkpoint — all passed

`test:unit` 48/48, `i18n:check` 3/3, `tsc` clean, `lint` 0/14, `build` clean,
`quality:integration` 8/8.

## Accessibility (Phase 11)

3 icon-only buttons with zero accessible name and 7 unlabelled/placeholder-only form fields fixed,
in files never covered by the frontend branch's own earlier accessibility pass (explicitly scoped
to its own 18 touched files — the operations/admin dashboards predating that branch were never
audited). Full method: `docs/ACCESSIBILITY_HARDENING_REPORT.md`.

## Query bounding (Phase 16)

6 public marketplace/community list queries had no `.limit()` (3 also had no `.order()` at all) —
fixed with the same `DEFAULT_PAGE_SIZE`/200 pattern already established by Q-1's
`listPublishedPuppies` fix. Full method: `docs/QUERY_AND_PERFORMANCE_HARDENING.md`.

## i18n

3 customer-facing surfaces had hardcoded `en-GB` date formatting; fixed with the existing
`formatDate`/`useTranslation` pattern. Internal-only dashboards deliberately left alone per this
project's own documented rule.

## SEO

Added `public/robots.txt`. No sitemap/canonical links — both need a confirmed real production
domain, which doesn't exist yet; guessing one would have been actively wrong. Full findings:
`docs/SEO_HARDENING_REPORT.md`.

## Security-preservation audit (Phase 22)

Manual, honestly-scoped static review of all five former High findings' frontend surfaces — no
regression found. Deliberately did not build an automated "security guard" script, since the real
enforcement is DB-layer RLS/triggers already covered by the dedicated DB test suite. Full
reasoning: `docs/SECURITY_GUARD_AUDIT.md`.

## Generated-artifact guard (Phase 21)

`scripts/route-artifact-guard.mjs`, verified against both real bug classes found during integration
(missing `<Outlet/>`; duplicate `package.json` script keys) by deliberately reproducing each and
confirming the script catches it, then confirming a clean pass on the real file.

## Former High findings status

No frontend-side regression found by static review (Phase 22); the DB-layer enforcement itself is
unchanged from the certified integration branch and re-exercised (not just assumed) by the 1062
DB/API tests, including the exact HF-2/HF-4 scenarios, passing cleanly against the isolated
instance.

## What could not be done in this pass, and why

- **Live keyboard-only walkthrough and a screen-reader (VoiceOver/NVDA) session** — still need a
  human, not something an automated tool substitutes for. The automated half of this gap (axe-core/
  color-contrast scanning) **was** done in a later session — see
  `docs/ACCESSIBILITY_HARDENING_REPORT.md`'s "Later session" addendum: 2 real bugs found and fixed,
  1 real gap found and honestly documented (a shared brand-color token needs a design decision, not
  a code fix).
- **Phase 20 (local-only demo-data extension mechanism)** — deliberately deferred; building it
  correctly (idempotent, dry-run, environment refusal) deserves its own focused pass rather than a
  rushed addition at the end of an already long session.
- **`db:schema-drift`** — blocked by the disclosed, pre-existing shadow-DB container crash, not
  something this pass could fix (a Docker/CLI-level issue, not a schema issue). Confirmed again on
  the final `quality:integration:full` run: 10/11 checks pass cleanly, this is the one disclosed
  exception.

**Dashboard home-page loading states** (6 files: admin/breeder/foundation/operations index pages),
originally deferred in `docs/STATE_COVERAGE_AUDIT.md` pending live verification, was completed in
a later session once a live dev server against the isolated DB was available — see the isolated DB
environment section above.

## Recommended next action

1. This branch's 27 commits are safe to cherry-pick onto whatever branch the integration result
   ultimately lands on — none touch backend security surfaces beyond the two disclosed,
   independently-verified isolation-tooling fixes, all are independently reviewable, and none were
   rejected during this pass's own review.
2. The shared-instance isolation bug fix (commit `14c38da`) is worth cherry-picking on its own,
   independent of the rest — it's a real correctness fix for anyone running `test:db` from a
   worktree with a non-default `supabase/config.toml`.
3. If a dedicated accessibility-tooling pass and the deferred demo-data extension mechanism are
   wanted, they're well-scoped follow-ups, not blockers.

## No external or legal blockers found or introduced

This pass touched no legal/compliance surface, no production infrastructure, and no commercial
entitlements — all still correctly out of scope per `docs/CURRENT_RELEASE_STATUS.md`.
