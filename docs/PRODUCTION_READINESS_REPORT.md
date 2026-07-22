# Havenpaw — Production Readiness Report

Snapshot: 2026-07-17. This report answers "can Havenpaw launch, and what specifically stands in the
way" by combining the verified findings already recorded in `docs/CURRENT_STATE_AUDIT.md` and
`docs/MVP_TEST_REPORT.md` (both same-day, both verified against a real local Supabase instance with
actual API calls and cross-tenant negative tests — not just code review) with a targeted check of
the categories those two documents don't already cover directly: uploads/storage, accessibility,
SEO breadth, CI, and environment/staging separation. Where a claim below is inherited from those
two documents, it is not re-litigated here — see them for the detailed evidence. Where a claim is
new to this pass, that's noted.

**No fixes were made in the course of writing this report.** Every gap below is a description of
current state, not yet touched code. Fixing any of them is separate follow-up work — see the
prioritised list in `CLAUDE.md`'s companion summary (delivered alongside this report in chat).

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
| Documents (breeder/buyer/operations/foundation) | Honest `NotImplemented` placeholders (deliberately replaced fabricated fake data this build — see `MVP_TEST_REPORT.md` bug context). No document library, no per-reservation checklist, no upload UI wired despite storage buckets existing at the schema layer. |
| Operations calendar | Honest `NotImplemented` placeholder (`dashboard.operations.calendar.tsx`). Ops staff currently plan routes/pickups without any calendar surface — the underlying route/vehicle/driver/matching data it would need already exists and is real. |
| Notification preferences | Only a "coming soon" placeholder on breeder/foundation settings pages — no per-type opt-in/out exists; all notifications are currently all-or-nothing. |
| Community groups | Only a flat public post feed exists (`_public.community.tsx`). `group_members` table exists in the schema but is unused by any UI — no join/leave, no group-scoped posts. |
| Welfare-urgent flag | Honest placeholder (`dashboard.foundation.urgent.tsx`) — no intake form, no priority/urgency review workflow. |
| Other honest placeholders (found by a full `NotImplemented` sweep, 2026-07-22, not previously listed here) | `dashboard.foundation.team.tsx` (volunteer/staff invitation), `dashboard.buyer.scheduled.tsx` (post-quotation confirmed-transport timeline), `dashboard.admin.organisations.tsx` (suspend/restore any organisation), `dashboard.admin.settings.tsx` (platform-wide config, featured-breeder selection) — all render an honest "not built" state, none fabricate data. |
| Accessibility | Minimal, not audited as a dedicated pass. Only 25 `aria-*` attribute occurrences across the entire `src/routes`+`src/components` tree — likely concentrated in a handful of shadcn primitives rather than deliberately added per-page. No confirmed keyboard-navigation or screen-reader testing anywhere in prior session notes. |
| Error handling | A global SSR-level fallback exists and is real (`src/server.ts` + `src/lib/error-capture.ts`/`error-page.ts` — catches thrown fetch exceptions and h3-swallowed 500s, renders a branded error page; security headers added this pass are confirmed applied to that fallback too). What's missing is **route-level** React error boundaries — only one route defines `errorComponent` — so a client-side render error on any other route falls through to TanStack Start's default UI instead of a graceful in-page recovery. |
| Mobile usability | Broad Tailwind responsive classes (`md:`/`lg:`) are used throughout, and the header hamburger menu was fixed from decorative to functional. No dedicated pass has tested the many multi-step forms (transport request, applications) or the dense ops-dashboard tables on an actual narrow viewport. |
| Legal pages | Real routes exist (`/terms`, `/privacy`, `/cookies`) but are explicitly marked draft/pending lawyer review — correctly not presented as final, but real text is still outstanding (business/legal dependency, not technical). |

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
3. **No CI pipeline.** No `.github/workflows` (or equivalent) exists — install/typecheck/lint/build
   currently only run manually, by whoever remembers to run them, in whatever local environment
   they happen to have.
4. **No automated tests anywhere.** Every verification claim in this report and its predecessors is
   manual (`tsc`, `eslint`, hand-run `curl`) — including the storage-security and deployment
   verification done this pass. That was rigorous *this session*, but it doesn't survive a change
   made by someone who doesn't re-run the same manual checklist by hand.

## Requires business configuration (not a code task)

- Real Cloudflare account, custom domain, DNS.
- Real Supabase project (production tier/region decision, billing).
- Real transport-company entity details, supported countries/currencies, contact details — no
  admin-configurable settings surface exists yet for any of this; it would currently require a code
  change and redeploy to alter.
- Google/Facebook OAuth credentials (buttons exist, show an honest "not configured" state).

## Requires legal review

- `/terms`, `/privacy`, `/cookies` — placeholder text only, explicitly marked as such.
- Any customer-facing language implying legal, veterinary, safety or availability guarantees needs
  a pass once real legal text exists — flagged as a rule in `CLAUDE.md` fundamental rule #9, not yet
  a completed audit of copy.

## Should wait until after launch

- Community groups, per-notification-type preferences, group posts — real value, non-blocking for
  a first complete transport/marketplace loop.
- Admin-configurable platform settings — until then, the handful of business constants live in code
  and change via a normal deploy, which is acceptable pre-launch scale.
- Achievements/champions-style secondary marketplace features — already built, not a launch risk
  either way.

## Note on scope

This report intentionally does not fix anything it found, per the instruction that produced it
("do not add unrelated features... fix safe technical problems found"). No "safe technical
problems" distinct from the above categories turned up during this pass — everything found was
either already-documented (cross-referenced above) or a genuine feature gap requiring a real
decision (calendar layout, notification grouping, etc.), not a small isolated bug fixable in
isolation. The next-task prioritisation for closing these gaps is delivered separately in chat,
ordered by business value and launch risk.
