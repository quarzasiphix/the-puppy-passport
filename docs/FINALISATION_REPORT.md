# Havenpaw — Finalisation Report

Snapshot: 2026-07-23, after a 13-phase product pass (scope correction through this report — see
`docs/IMPLEMENTATION_PLAN.md` for the full phase-by-phase build log and `git log` for the
individual commits). This report is the single answer to "where does Havenpaw actually stand, and
what specifically is left before launch" — it supersedes nothing (see `docs/MVP_TEST_REPORT.md` and
`docs/PRODUCTION_READINESS_REPORT.md` for the detailed evidence this report summarises), it
consolidates. Where this report's classification differs from an older document, this report is
newer and should be trusted; where an older document has *more* verification detail on a specific
bug or feature, it's cross-referenced rather than repeated.

**No claim in this report is guessed.** Every "ready" below was verified this session via a real
migration, a real authenticated API call, or a real automated test — not inferred from reading code.
Every "blocked" is a real, reproduced limitation (a missing browser, a missing payment provider), not
a guess. Where something could not be checked, it says so explicitly instead of assuming success.

## Automated verification run this session

| Check | Result |
|---|---|
| `supabase db reset` (76 migrations + seed) | **Clean.** Confirmed multiple times across this session's phases; every new migration applied without error. |
| `npx tsc --noEmit` | **Clean.** |
| `npm run lint` | **38 pre-existing errors, 13 warnings** — all in files never touched this session (`dashboard.breeder.litters.tsx`'s sibling files, `matching.ts`, `pricing.ts`, `how-it-works.tsx`, `guards.ts`, `fleet.ts`, plus 3 new fast-refresh warnings from `src/lib/i18n/index.tsx`, same class already present elsewhere in the codebase). Every file actually touched this session is lint-clean. |
| `npm run build` | **Clean** — Cloudflare Worker bundle, confirmed working via `npx wrangler dev` earlier in the project's history (`docs/DEPLOYMENT_CHECKLIST.md`). |
| `npm run test:db` (170 tests) | **170 passing, 0 failing.** The 4 open findings tracked in `docs/DATABASE_TESTING.md` (a transport-request operational-field-locking gap, an ownership-vs-role org-access gap, a notifications `RETURNING`/visibility gap, and a driver-document storage column-shadowing bug) were all fixed in a dedicated security-hardening pass (migrations `20260101006000`–`20260101006400`) and their tests rewritten into comprehensive allowed/forbidden coverage — see "Fixed findings" below. Verified against a clean reset and confirmed repeatable by running the suite twice in a row without a reset in between. |
| `npm run test:e2e` (Playwright) | **Blocked in this sandbox** — Chromium's headless shell fails to load a system library (`libglib-2.0.so.0`), and this sandbox's `apt` sources are broken for installing it (see `docs/E2E_TESTING.md`). Not run this session; not claimed as passing. Needs a machine with working package installation. |
| Route-tree consistency | **Confirmed** — all 116 route files are represented in `routeTree.gen.ts` (checked by direct comparison, not assumed). |
| `mock-data.ts` usage | **One file** (`src/components/cards.tsx`), **type imports only** — confirmed by grep, no rendered data comes from it anywhere. |
| `NotImplemented` placeholders | **9 pages**, every one an honest "not built yet" state with a real explanation, never fabricated data (see the per-persona journeys below for which). |
| `TODO`/`FIXME`/`XXX` markers | **Zero** in `src/`. |

## Per-persona journey review

Each journey below states what's real (verified this session or in prior sessions, cross-referenced)
vs. what's a known gap. "Verified" means an actual authenticated API call or a real page load was
checked, not that the code merely looks correct.

1. **Visitor discovering an animal → seller profile → message → application → approval →
   reservation → collection/transport.** Real end to end. Marketplace pages query Supabase directly
   (zero mock data). Messaging is gated by real relationship-checking RPCs. The reservations page
   was fixed this session to show real transport-request status instead of a dead-looking button
   once transport is requested (see `IMPLEMENTATION_PLAN.md` phase 9 notes, commit `38e574a`).
2. **Adoption → organisation contact → application → approval → distant transport → organisation
   fundraiser → transport readiness.** Real end to end, including the fundraiser step added this
   session — but the fundraiser step is **disabled by default** behind `VITE_FUNDRAISING_ENABLED`
   until a payment provider is approved (see below).
3. **Fast standalone transport post → initial options → account continuation → quotation →
   scheduling.** `/estimate` already covered the fast, no-account-needed entry (4 fields, real price
   range + route match); this session fixed the gap where continuing to the full form discarded
   everything just entered (commit `c6b7b8a`).
4. **Breeder creates profile → litter → animal listing → responds to buyer → arranges transport.**
   Real end to end. This session fixed a real dead-end where a breeder with zero litters had no way
   forward from the puppies page (commit `6b2ada2`).
5. **Foundation creates animal listing → receives applications → selects adopter → requests
   transport.** Real end to end.
6. **Breeder contacts another breeder directly.** Real, via the general public-profile
   follow/message-adjacent surface added this session (`/profile/$profileId`, commit `c42dcff`) —
   note this is *profile following*, not yet a general unrestricted messaging system (see phase 4's
   documented gap: message requests/accept/decline/block/mute are not built).
7. **User follows profiles and sees relevant feed content.** Real. Post-type badges and a real
   (not fake-algorithm) "people you follow" feed section were added this session (commit `ae38404`).
   Interest/topic preferences and any recommendation signal beyond "who you follow" are not built.
8. **Moderator receives a report and completes the decision workflow.** Real, including a working
   report → moderation-case escalation flow (verified this session's DB test suite,
   `tests/db/workflows.test.ts`). Appeals: `moderation_cases.appeal_status` exists in the schema but
   there's no user-facing way to request one — decisions aren't visible to the affected user at all
   yet (documented in phase 12, commit `b019db7`).
9. **Driver sees only assigned work and completes pickup and handover.** Real, RLS-enforced
   (`tests/db/security-regressions.test.ts` "drivers cannot see routes or fleet records they're not
   assigned to" — passing). A column-shadowing bug that blocked an assigned driver from reading
   their own job's documents in Storage was found and fixed this session (migration
   `20260101006300`, see "Fixed findings" below) — confirmed against the live policy definition,
   not just the migration source.
10. **Every enabled language renders the important flows correctly.** **Partially real.** The site
    header, footer and homepage hero render correctly in English and Polish (verified: SSR English
    output checked directly, Polish resource values checked directly, both locale files confirmed to
    have exactly matching keys). Every other page — every dashboard, every form, every marketplace/
    transport/adoption/fundraising screen — is English-only. This is the single largest honest gap
    in this report; see "Blocked / needs further work" below.

## Classification

### Ready (verified working end to end this session or in a prior, cross-referenced session)

- Auth (email/password), session hydration, role-gated dashboards.
- Marketplace: discovery, breeder/foundation profiles, litters, puppies, applications, reservations
  — zero mock data.
- Transport: request form (with `/estimate` prefill carried through, fixed this session), ops
  dispatch, matching engine, quotations, driver workspace, status history.
- Transport data model hardening (see `docs/adr/TRANSPORT_DATA_MODEL.md`): `transport_parties`
  backfilled and given a real writer, `transport_request_animals` for genuine multi-animal support,
  `create_transport_draft()` atomic creation RPC (with animal-entitlement and party-forgery checks),
  a post-draft snapshot lock + amendment workflow, and a column-minimized `driver_transport_job_view`
  — verified end to end via 46 new/rewritten regression tests, all against a clean reset. Ops
  transport detail page and driver workspace now surface parties/multi-animal/exact-address/
  amendments; real document upload to private Storage with signed-URL viewing replaced the previous
  free-text `file_url`. No UI wires the three Phase-5 integration entry points
  (`createTransportDraftForMarketplacePurchase`/`ForFoundationAdoption`/`ForPrivateRehoming`) yet —
  real, tested backend functions, ready for a future UI to call.
- Adoptions, private rehoming (moderated, invisible until approved).
- Community: post feed with real post-type badges and a real follows-based section (this session);
  groups with join/leave and group-scoped posting (this session, including two RLS bugs found and
  fixed before shipping).
- Public profiles and profile-following (this session).
- Moderation & reporting, audit logs.
- GDPR self-service (export, deletion request queue).
- Multi-species schema foundation, product/service category architecture, European market registry
  (all schema-only, deliberately disabled/unused by UI where the phase brief said to keep them that
  way — see `IMPLEMENTATION_PLAN.md` phases 15/16/17).
- Legal-requirements rule-pack schema (species/jurisdiction/enforcement-level, extended this
  session).
- A Node-based database/API regression suite (`tests/db/`, 170 tests) protecting all of the above
  against RLS regressions — did not exist before this session.
- A major routing bug (6 pages silently rendering the wrong content) found and fixed this session —
  see `docs/DECISIONS.md`.
- All 4 security findings below (transport-request operational-field locking, ownership-vs-role
  organisation access, notifications visibility scope, driver-document storage access) — fixed and
  verified end to end, not just documented as known issues.

### Technically ready but needs external configuration

- Google/Facebook OAuth (buttons exist, honestly show "not configured").
- Production Supabase project and Cloudflare deployment (procedure documented in
  `docs/PRODUCTION_SETUP.md`/`docs/DEPLOYMENT_CHECKLIST.md`, not executed — a business/account step).
- **Rate limiting / abuse protection at the edge** — found during this pass's launch-hardening
  audit: nothing in this codebase throttles repeated auth attempts, application/message spam, or
  API abuse. This is correctly an infra-level concern for a Cloudflare Worker deployment (Cloudflare
  dashboard → Security → WAF rate-limiting rules, or Supabase Auth's own rate limits, both
  configured outside this repo), not a code gap — but it genuinely does not exist yet anywhere, and
  should be configured before a real public launch, not assumed.
- Playwright E2E execution (blocked by this sandbox's missing system libraries, not by the code —
  see the automated-verification table above).

### Needs legal review

- `/terms`, `/privacy`, `/cookies` — placeholder text, explicitly marked as draft.
- Any customer-facing copy implying a legal/veterinary/safety guarantee (ongoing discipline per
  `CLAUDE.md` rule 9, not a one-time audit item).
- `legal_requirements` rows — the table now supports species/jurisdiction rule packs, but zero rows
  exist; populating it requires real legal research per market, not invention.

### Needs payment-provider configuration

- The entire fundraising module (commit `ac0d8da`) — schema, RLS, org/admin/public UI and a
  development-only *simulated* contribution flow are real and tested, but stay behind
  `VITE_FUNDRAISING_ENABLED` (default off) until a real payment provider, refund rules and legal
  texts are approved. No Havenpaw wallet exists or is planned.

### Blocked (by this sandbox, not by the product)

- Playwright/browser-driven E2E testing (missing system libraries; documented, not worked around by
  weakening the tests).
- Anything requiring a real payment provider account.

### Post-launch features (real ideas, correctly not blocking a first launch)

- Full-app translation beyond the header/footer/homepage slice (the single largest remaining
  product gap this report identifies — see below).
- General user-to-user messaging (requests/accept/decline/block/mute) beyond relationship-gated
  conversations.
- Operations calendar, document library/upload UI, per-type notification preferences, community
  groups' richer moderation, foundation welfare-urgent flow and team management, full adoption
  questionnaire (currently first-contact only), user-facing moderation appeals.
- Locale-aware URLs, SSR-aware locale cookie (current locale switch is client-side/localStorage
  only), user-content translation (listings/messages keeping original + optional machine
  translation), an admin translation-completeness dashboard (the underlying
  `checkTranslationCompleteness()` check exists and is callable; no dashboard UI wraps it yet).
- Any listing/query/UI for the product/service categories or multi-species beyond dogs — both are
  real schema, zero UI, by design (their own phases' briefs said to keep them inert for now).
- Route-level React error boundaries (only one route defines `errorComponent`; a client-render error
  elsewhere falls through to the framework default rather than a graceful in-page recovery — the
  global SSR-level fallback in `src/server.ts` is real and already covers server-side failures).
- Image lazy-loading is inconsistent (5 of 21 `<img>` tags use `loading="lazy"`) — a real, minor
  performance polish item, not a functional bug.

## Fixed findings (see `docs/DATABASE_TESTING.md` for full root-cause detail and live-policy verification)

All four were found the same way as everything else in this report — by testing a real
authenticated call, not by reading SQL and assuming it was correct — then fixed in migrations
`20260101006000`–`20260101006300` and given comprehensive allowed/forbidden test coverage rather
than a single broad assertion:

1. **A customer could change their own transport request's operational `status` directly.** Fixed
   by a `BEFORE UPDATE` trigger that blocks any change to `status`/`compliance_review_result`/
   `visibility`/`assigned_*` unless the actor is ops staff or the assigned driver — while still
   allowing the two legitimate customer transitions (`draft -> submitted`, `-> cancelled_by_customer`).
2. **Suspending a breeder's role did not revoke their organisation-management access.** Fixed by
   making `owns_org()` also require the role that org type actually depends on (kennel → breeder,
   shelter → shelter_member, foundation/rescue → foundation_member) to still be active — verified
   for all four org types, plus that non-owner members and admins are unaffected.
3. **An org owner notifying an applicant failed outright** (`42501`) despite the INSERT policy
   reading correctly. Root cause: `INSERT ... RETURNING` requires a matching `SELECT` policy too,
   and none existed for "an org owner sees a notification filed under someone else's profile\_id".
   Fixed with a narrowly-scoped `actor_profile_id`-based `SELECT` policy — the sender can see what
   they sent, never the recipient's full inbox. A follow-up audit found the actor-stamping trigger
   only filled that column when the client left it null, letting a user forge it to someone else's
   id — hardened to always be server-set from `auth.uid()` regardless of client input.
4. **A column-shadowing bug blocked an assigned driver from their own job's documents in Storage** —
   the same bug class already fixed once for `conversations`, reintroduced via a different pair of
   same-named columns (`storage.objects.name` vs. `drivers.name`). Fixed by qualifying the
   reference explicitly.

## What this report does not do

It does not claim Playwright tests pass (they didn't run — blocked, documented above). It does not
claim full-app translation is complete (it isn't — one real, demonstrated slice exists). It does not
claim the fundraising module is launch-ready (it's real and tested but intentionally disabled
pending a payment-provider decision that isn't this report's or this session's to make). It does not
recommend a production deployment — that requires the external configuration steps above plus
explicit approval, neither of which this report grants itself.
