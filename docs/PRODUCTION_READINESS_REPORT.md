# Havenpaw — Production Readiness Report

Original snapshot: 2026-07-17. **Reconciled 2026-07-24** (Stage P of the autonomous
backend-hardening session, see `docs/AUTONOMOUS_BACKEND_PROGRESS.md`) against everything that
session's Stages B–O actually built — several claims below (CI, automated tests, calendar,
notification preferences, welfare-urgent flow, team management, admin organisation/settings pages,
rate limiting) were true in the original snapshot and are no longer true; they're corrected in
place below with a note on what changed. Anything not called out as updated is unchanged from the
2026-07-17 snapshot and still reflects the current repo state as of this reconciliation pass — this
was a documentation-reconciliation stage, not a re-audit of every category from scratch. This
report answers "can Havenpaw launch, and what specifically stands in the way" by combining the
verified findings already recorded in `docs/CURRENT_STATE_AUDIT.md` and `docs/MVP_TEST_REPORT.md`
(both same-day as the original snapshot, both verified against a real local Supabase instance with
actual API calls and cross-tenant negative tests — not just code review; both are now themselves
partially stale in the same way, see the note added to their own headers) with a targeted check of
the categories those two documents don't already cover directly: uploads/storage, accessibility,
SEO breadth, CI, and environment/staging separation. Where a claim below is inherited from those
two documents, it is not re-litigated here — see them for the detailed evidence. Where a claim is
new to this pass, that's noted.

**No fixes were made in the course of writing the original 2026-07-17 report or this
reconciliation pass.** Every gap below is a description of current state. The Stage P
reconciliation only corrects factual claims against the real repo state; it doesn't fix anything
new. Fixing any remaining gap is separate follow-up work.

## Ready

- **Auth**: email/password sign up/in/out, session hydration, role-gated redirects. Verified
  end-to-end (`MVP_TEST_REPORT.md` §1).
- **Transport core loop**: public request → ops dispatch/quotation → deterministic matching →
  route assignment → driver workspace (status progression, incident reporting) → status history.
  Verified end-to-end.
- **Marketplace publishing**: breeder litters/puppies CRUD, foundation adoption listings, private
  rehoming (moderated, invisible until approved) — all real Supabase, RLS-enforced publication
  rules.
- **Applications & reservations**: puppy-purchase applications (full multi-step questionnaire,
  preview, reload-persistence), adoption/rehoming first-contact applications, breeder/foundation
  inbox (approve/reject/request-info/waitlist), buyer-side status + withdraw. Reservations
  (`dashboard.buyer.reservations.tsx`, `dashboard.breeder.reservations.tsx`) confirmed this pass to
  have **zero `mock-data.ts` imports** — consistent with `MVP_TEST_REPORT.md`'s claim they're wired
  to real data, linking sold puppies to transport requests.
- **Messaging**: real conversation threads gated by `SECURITY DEFINER` RPCs so only an actual
  application or transport relationship can open a thread.
- **Moderation & reporting**: report-a-listing from three public surfaces, admin triage, case
  resolution.
- **Community (baseline)**: public post feed, like, comment — real data, not mocked.
- **Notifications (baseline)**: real per-user list, unread badge, mark-read, one real end-to-end
  trigger (rehoming approval/rejection).
- **RLS / private data**: the most heavily verified area in the project. Eight real bugs found and
  fixed via actual authenticated `curl` calls and cross-tenant negative tests this build (missing
  GRANTs after a Supabase CLI default change, `profiles` PII over-exposure, two separate RLS
  recursion bugs, three instances of the "INSERT...RETURNING treated as SELECT" bug class, one
  column-shadowing bug that silently returned `[]` instead of erroring). Every table in `public` has
  RLS enabled with at least one policy; every INSERT-only policy checked against its matching SELECT
  policy for the same actor. See `MVP_TEST_REPORT.md` §3 for full detail — this is not a "trust me,"
  it's a list of specific bugs with specific fixes.
- **Build**: `npm run build` confirmed clean (zero errors/warnings), served and hit with real HTTP
  requests via `npx wrangler dev` (Cloudflare Worker target). `tsc --noEmit` and `eslint` clean on
  every file touched across sessions.
- **Automated database/API test suite — added since the original snapshot, corrects "No automated
  tests anywhere" below.** `npm run test:db` (`tests/db/*.test.ts`, `node --test`) runs ~395 real
  tests against a live local Supabase instance signed in as fixed seeded personas — positive and
  negative (cross-tenant, forbidden-column, RLS-bypass-attempt) cases for every domain area:
  transport lifecycle, quotations, moderation/appeals, welfare cases, organisation team management,
  adoption questionnaire, notification preferences, rate limiting, admin surfaces, database
  consistency (RLS/grant/search_path audit), and full operational scenarios (driver delivery
  journey, route assignment/unassignment). Verified for repeatability (safely re-runnable without a
  database reset) as a standing discipline, not just a one-off pass. See
  `docs/DATABASE_TESTING.md`. This is DB/API-level coverage, not browser/E2E — see "Partially
  ready" for what that leaves open.
- **CI pipeline — added since the original snapshot, corrects "No CI pipeline" below.**
  `.github/workflows/ci.yml`: one job runs install/typecheck/lint/build plus a duplicate-migration-
  prefix check and a route-tree-consistency check on every push/PR; a second, independent job spins
  up the local Supabase stack via Docker and runs the full `test:db` suite twice (repeatability
  check) — both jobs match real gaps found and fixed during the session that added them.
- **Operations calendar — real, corrects the "Partially ready" placeholder entry below.** Day/week
  view, filters, and deterministic scheduling-conflict detection (driver/vehicle double-booking)
  backed by `src/lib/queries/calendar.ts`, covered by `tests/db/calendar-scheduling.test.ts`.
- **Notification preferences — real, corrects the "Partially ready" placeholder entry below.**
  Per-category opt-in/out (`notification_preferences` table, mandatory `security` category,
  opt-out default for the rest), replacing the earlier "coming soon" placeholder on both
  breeder/foundation settings pages.
- **Welfare-urgent / rescue intake — real, corrects the "Partially ready" placeholder entry below.**
  Full intake form, ops acknowledge/review workflow, conversion into a real transport draft
  (`welfare_cases`/`welfare_case_documents`, `dashboard.foundation.urgent.tsx`,
  `dashboard.operations.welfare-cases.tsx`).
- **Organisation team/invitation management — real, corrects the earlier placeholder listing
  below.** Invite/accept/decline/remove/suspend/role-change, tier-protected, with an
  owner-transfer lock (`dashboard.foundation.team.tsx`, `organisation_invitations`).
- **Admin organisation management, platform settings, and buyer's scheduled-transport view —
  real, corrects the earlier placeholder listing below.** `dashboard.admin.organisations.tsx`
  (suspend/restore, featured flag), `dashboard.admin.settings.tsx` (markets table),
  `dashboard.buyer.scheduled.tsx` (scheduled-or-later transport list + timeline).
- **Per-actor rate limiting / abuse prevention — added since the original snapshot.** Real,
  code-enforced per-actor cooldowns (not an in-memory counter — a Postgres table, correct given
  the app runs as multiple concurrent, cold-starting Cloudflare Worker instances) on 7 previously
  unprotected abuse vectors (reports, messages, welfare cases, applications, transport-draft
  creation, amendment requests, org invitations). See `docs/RATE_LIMITING_AND_ABUSE_PROTECTION.md`
  for exactly what's covered vs. what's still genuinely external (Cloudflare WAF, Supabase Auth
  rate limits — not something this repo can implement).
- **Adoption questionnaire and moderation appeals — added since the original snapshot.** Full
  buyer-side adoption questionnaire (housing, landlord permission, vet plan, consent metadata) with
  a default-deny lock trigger stopping applicants from writing to org-controlled fields; a
  user-facing moderation-decision/appeal flow (`_public.moderation.$caseId.tsx`,
  `moderation_appeals`).
- **Database consistency/security and privacy audits — added since the original snapshot.** A
  full RLS/grant/`SECURITY DEFINER` search-path sweep across all 63 `public` tables (see
  `docs/AUTONOMOUS_BACKEND_PROGRESS.md`, Stage L) and a personal-data/GDPR-posture audit (see
  `docs/PRIVACY_DATA_LIFECYCLE.md`, Stage O) — both found the existing protections already correct
  aside from one closed gap (quotation column-scoping).
- **SEO — broader than previously documented.** `MVP_TEST_REPORT.md` §1 only credited two page
  types with real `head()` meta. Rechecked this pass with the actual code pattern used
  (`head: () => ...`, not a bare `head()` call, which is why an earlier grep undercounted it): **28
  route files** set real per-page `head:` metadata, including `__root.tsx`, both marketplace detail
  page types, breeder map, guided search, legal pages, auth pages, and the transport request flow.
  Not yet audited for *quality* (title length, OG image presence) — only presence confirmed.
- **Storage/uploads — security-verified this pass.** Two buckets exist:
  `kennel-media` (public — logos, animal photos) and `transport-documents` (private — passport
  scans, health certificates, incident evidence). Verified with real authenticated API calls
  against the local stack, not just reading the policy SQL: uploaded a real object as its owning
  customer into `transport-documents`; confirmed an unauthenticated request gets `404` (not `403`
  — doesn't even leak that the object exists); confirmed an unrelated authenticated user gets `404`
  on read and `403` (`row-level security policy` violation) on write into another customer's
  transport-request folder; confirmed ops staff *can* read it; confirmed the driver-access policy
  is scoped to active (non-draft/rejected/cancelled) assigned jobs only, not the whole document
  bucket. Confirmed the public `kennel-media` bucket rejects an anonymous write into an arbitrary
  org's folder (`403`) while still allowing reads. One notable, likely-intentional behavior: the
  requester who uploads a `transport-documents` object has no self-delete/update policy — only ops
  staff can delete or replace it (no bug found while confirming this, just flagging it as a design
  choice worth a deliberate yes/no rather than an assumption, since it affects any future "delete my
  upload" UI). No document *upload UI* exists yet (see "Partially ready" below), so nothing has
  actually been uploaded through the app itself — this verification exercised the storage layer
  directly, the same layer any future upload UI would sit on top of.

## Partially ready

| Area | State |
|---|---|
| Documents (breeder/buyer/operations/foundation) | Honest `NotImplemented` placeholders (deliberately replaced fabricated fake data this build — see `MVP_TEST_REPORT.md` bug context). No document library, no per-reservation checklist, no upload UI wired despite storage buckets existing at the schema layer. **Still true as of this reconciliation** — deliberately left out of Stage I's priority list, not since revisited. |
| Community groups | Only a flat public post feed exists (`_public.community.tsx`). `group_members` table exists in the schema but is unused by any UI — no join/leave, no group-scoped posts. **Still true as of this reconciliation.** |
| Accessibility | Minimal, not audited as a dedicated pass. Only 25 `aria-*` attribute occurrences across the entire `src/routes`+`src/components` tree — likely concentrated in a handful of shadcn primitives rather than deliberately added per-page. No confirmed keyboard-navigation or screen-reader testing anywhere in prior session notes. **Still true as of this reconciliation** — not touched by the backend-hardening session (backend-only scope). |
| Error handling | A global SSR-level fallback exists and is real (`src/server.ts` + `src/lib/error-capture.ts`/`error-page.ts` — catches thrown fetch exceptions and h3-swallowed 500s, renders a branded error page; security headers added this pass are confirmed applied to that fallback too). What's missing is **route-level** React error boundaries — only one route defines `errorComponent` — so a client-side render error on any other route falls through to TanStack Start's default UI instead of a graceful in-page recovery. **Still true as of this reconciliation.** |
| Mobile usability | Broad Tailwind responsive classes (`md:`/`lg:`) are used throughout, and the header hamburger menu was fixed from decorative to functional. No dedicated pass has tested the many multi-step forms (transport request, applications) or the dense ops-dashboard tables on an actual narrow viewport. **Still true as of this reconciliation.** |
| Legal pages | Real routes exist (`/terms`, `/privacy`, `/cookies`) but are explicitly marked draft/pending lawyer review — correctly not presented as final, but real text is still outstanding (business/legal dependency, not technical). **Still true as of this reconciliation.** |
| Account deletion | Request-tracking is real (self-service request, admin list/mark-processed), but **execution is not**: marking a request "processed" doesn't actually delete or anonymise the account's data. See `docs/PRIVACY_DATA_LIFECYCLE.md`. New finding from Stage O, not in the original 2026-07-17 snapshot. |
| Browser/E2E test coverage | The new ~395-test `test:db` suite (see "Ready" above) covers the database/API layer thoroughly, but no browser-driven (Playwright) test run has actually executed in this sandbox — `docs/E2E_TESTING.md` documents how to run the suite and the sandbox gap that currently blocks doing so here. Frontend behavior is still only manually spot-checked, not automated. |

**Removed from this table since the original snapshot** (now real, moved to "Ready" above):
operations calendar, notification preferences, welfare-urgent flag, organisation team/invitation
management, admin organisation management, admin platform settings, buyer's scheduled-transport
view.

## Blocks launch

1. **No production Supabase project exists yet — still purely a business/account step.** Everything
   — schema, RLS, auth, storage — has only ever run against the local Docker stack. The *procedure*
   for creating one, promoting migrations safely (no down-migrations exist — fix-forward only),
   separating local/staging/production data, and configuring storage/auth/email/backups is now
   fully documented in `docs/PRODUCTION_SETUP.md`, written this pass. Creating the actual project
   and running the first `db push` is the remaining blocker — deliberately not done automatically,
   pending explicit approval per instruction.
2. **No production Cloudflare deployment exists yet.** The build/deploy *mechanism* is now
   confirmed working end-to-end this pass — a real `npm run build` + `npx wrangler dev` against the
   built worker, hit with real HTTP requests (`/`, a Supabase-backed marketplace page, an unknown
   path) all returned correct responses, now including baseline security headers
   (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) added and
   verified live in `src/server.ts`. `docs/DEPLOYMENT_CHECKLIST.md` documents the full procedure
   including a real config-conflict gotcha found while testing. What's still missing: an actual
   custom domain, a real staging-vs-production split (two separate `.env` files and two separate
   deploys — no infrastructure blocker, just hasn't been done since no domain/second Supabase
   project exists yet), and a deliberately-deferred CSP (a wrong one fails silently, so it needs
   per-page verification against a real deploy rather than being guessed here).
3. ~~No CI pipeline.~~ **Resolved since the original snapshot** — `.github/workflows/ci.yml` now
   runs install/typecheck/lint/build plus the full database/API test suite (twice, for
   repeatability) on every push/PR. No longer a launch blocker.
4. ~~No automated tests anywhere.~~ **Partially resolved since the original snapshot** — ~395
   database/API tests now run in CI and locally (see "Ready" above). What's still missing: no
   automated browser/E2E coverage (see "Partially ready"), so frontend regressions still rely on
   manual verification. Downgraded from a launch blocker to a partial-readiness gap.

## Requires business configuration (not a code task)

- Real Cloudflare account, custom domain, DNS.
- Real Supabase project (production tier/region decision, billing).
- Real transport-company entity details and contact details — no admin-configurable settings
  surface exists yet for these; still requires a code change and redeploy to alter. **Partially
  resolved since the original snapshot**: supported countries/currencies/locales are now
  admin-configurable at runtime via `dashboard.admin.settings.tsx` (a real `markets` table, added
  Stage I) — no redeploy needed to enable/disable a market or change its currency/locale.
- Google/Facebook OAuth credentials (buttons exist, show an honest "not configured" state).

## Requires legal review

- `/terms`, `/privacy`, `/cookies` — placeholder text only, explicitly marked as such.
- Any customer-facing language implying legal, veterinary, safety or availability guarantees needs
  a pass once real legal text exists — flagged as a rule in `CLAUDE.md` fundamental rule #9, not yet
  a completed audit of copy.

## Should wait until after launch

- Community groups, group posts — real value, non-blocking for a first complete
  transport/marketplace loop. (Per-notification-type preferences, previously listed here, are now
  built — see "Ready" above; removed from this list.)
- Achievements/champions-style secondary marketplace features — already built, not a launch risk
  either way.

## Note on scope

The original 2026-07-17 pass intentionally did not fix anything it found, per the instruction that
produced it ("do not add unrelated features... fix safe technical problems found"). No "safe
technical problems" distinct from the above categories turned up during that pass — everything
found was either already-documented (cross-referenced above) or a genuine feature gap requiring a
real decision (calendar layout, notification grouping, etc.), not a small isolated bug fixable in
isolation. The Stage P reconciliation pass (2026-07-24) is documentation-only in the same spirit —
it corrects factual claims against the real repo state (several of the "genuine feature gaps" named
above were, in fact, subsequently built by the autonomous backend-hardening session) but does not
introduce any new fix or feature itself. The two real remaining launch blockers — a production
Supabase project and a production Cloudflare deployment — are both business/account steps, not
code gaps, and remain deliberately undone pending explicit approval.
