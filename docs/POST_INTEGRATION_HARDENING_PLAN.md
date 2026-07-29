# Post-integration hardening — plan

Baseline captured from the integrated product (`docs/INTEGRATION_FINAL_REPORT.md`,
`docs/FRONTEND_52_COMMIT_MANIFEST.md`, `docs/FRONTEND_INTEGRATION_CONFLICT_LEDGER.md`,
`docs/CURRENT_RELEASE_STATUS.md`, `docs/BETA_SCOPE.md`, `docs/FEATURE_LAUNCH_MATRIX.md`,
`docs/E2E_TESTING.md`, `docs/SSR_AUTH_HYDRATION_FIX.md`) before starting new work, per Phase 2.

## Current state summary

- **Real-beta-ready and frontend-connected**: public marketplace discovery, breeder/foundation
  onboarding+verification, private rehoming, buyer applications, reservations, quotations,
  messaging, moderation, ownership handover, both transport-request flows, driver/vehicle/route
  operations, document review, legal holds, signup consent.
- **Backend real and tested, zero frontend surface**: support cases (`support_cases`/
  `support_case_messages`) — confirmed by the launch matrix and still true after this integration;
  none of the 52 cherry-picked frontend commits reference `support_cases` anywhere. Out-of-band
  support channel is the documented interim path.
- **Deliberately disabled**: fundraising (client-side flag; server-side forced-simulated as
  defense-in-depth even if bypassed).
- **Genuinely absent** (not flags, not half-built): payments, analytics/CRM, transactional email
  beyond Supabase Auth's own, SMS.
- **SSR auth hydration fix** already applied and verified on `_public.signin.tsx`,
  `_public.signup.tsx`, `_public.forgot-password.tsx` (disabled submit until hydrated +
  `method="post"`). `_public.reset-password.tsx` confirmed unaffected (gated behind an async-ready
  state). This is load-bearing for any E2E test involving these forms: Playwright's normal
  actionability wait on `.click()` already respects the disabled state correctly — no manual sleep
  needed, matching the existing `auth.spec.ts` style.
- **Existing E2E coverage**: `tests/e2e/auth.spec.ts` (3 specs: register, sign in, wrong password)
  plus a real `playwright.config.ts` (single chromium project, `workers: 1`/`fullyParallel: false`
  because specs share seeded demo accounts, `E2E_BASE_URL` override support, screenshot/trace on
  failure). This is the pattern every new spec in this hardening branch follows — no scratch
  `.mjs` scripts, no `force: true` on success-path assertions, no arbitrary sleeps.
- **7 real conflicts** resolved during integration (ledger summary): followed-org type-mapping
  split, breeder detail cache-invalidation + error-sanitisation merge, marketplace N+1
  dead-code removal, two rounds of quotations-page merges (expiry guard + locale-aware
  formatting + status labels, dropped stale 3-field mutation shape), planned-routes label
  addition + nullable-type fix, and a raw-error-exposure fix superseded by the existing
  `getFriendlyErrorMessage` convention.
- **Two real bugs found and fixed by browser QA during integration** (not simulated): unclickable
  Follow/Report buttons on breeder/foundation detail pages (decorative hero `position:relative`
  painting above later non-positioned siblings), and `/foundations/$slug` never rendering (missing
  `<Outlet/>` on the parent route — the identical bug already fixed for `/breeders` on `main`
  before integration). Both are prime regression-test targets for this hardening branch (Phase 5).
- **Lint baseline on the integration HEAD**: 21 errors (byte-identical to the certified backend
  baseline) / 15 warnings (+2 over baseline: two new legitimate exports in files that already
  carried this warning class).
- **DB test baseline**: 1062/1062, three consecutive passes, on the integration HEAD.

## Known open items carried into this branch, not new discoveries

- No production Supabase infrastructure (separate readiness gate, out of scope here).
- `/terms`/`/privacy` content is draft pending legal review (mechanism is real; content is not
  this branch's concern).
- Support case UI doesn't exist — building it would be new feature work, not hardening; noted as
  an open gap in the final report, not attempted here unless separately authorized.
- Commercial entitlements/pricing: explicitly deferred pending business input (unchanged).

## What this branch adds, in order

1. Maintained Playwright regression foundation (helpers: login/logout, hydration-aware waits,
   console/page-error capture, screenshot-on-failure) — extending the existing config, not
   replacing it.
2. Regression suites for public discovery, the two integration-found bugs specifically, auth,
   buyer, organisation, transport, moderation/support journeys.
3. Accessibility/keyboard/responsive/i18n/state audits with findings classified by severity.
4. Query-bounding audit and safe lint-debt reduction (before/after counts recorded).
5. SEO/crawl-control verification, public-claim truthfulness review, optional local-only demo
   extension mechanism, generated-artifact and security-preservation static guards, one
   non-destructive `npm run quality:integration` command.
6. Non-destructive checkpoint run now; full isolated stateful DB + Playwright verification
   deferred until it's safe relative to Bot 1's certification work on the shared local Supabase
   instance (checked at the time, not assumed).
7. Final hardening report and clean stop — no push, no deploy, no changes to any audited snapshot.
