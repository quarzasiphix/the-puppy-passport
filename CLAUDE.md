# Havenpaw — project context for Claude

Havenpaw is a **dedicated European animal ecosystem** — animal discovery/marketplace, breeder and
foundation profiles, community, adoption/handover, and (once a purchase or adoption is agreed)
professional animal transport — being rebuilt from a static TanStack Start visual prototype into a
real application on a **local Supabase** database.

It is **not**: a generic OLX/classifieds clone, a pet shop, a childish dog website, an unmoderated
Facebook group, an open marketplace where random transporters can accept jobs, or — permanently —
**a general marketplace for unrelated categories** (cars, electronics, furniture, tools, etc.).
Transport is a major advantage of the platform, not its primary identity — see the corrected
hierarchy in `docs/PRODUCT_VISION.md`, which you must read before touching product scope.

## Repo orientation

- **Framework**: TanStack Start (React 19, SSR, file-based router via `@tanstack/react-router`),
  built with Vite through `@lovable.dev/vite-tanstack-config`, deployed as a Cloudflare Worker
  (`nitro` preset `cloudflare-module`, configured in `vite.config.ts`). Native `node`/`npm` (nvm,
  currently v24) **is** on `PATH` in this sandbox and both `npm run build` and `npm run dev` work
  fine through it — a stale note here once claimed otherwise based on an earlier, different sandbox
  state; that's no longer true, confirmed by running a real `npm run build` and serving the output
  with `npx wrangler dev`. The **only** hard rule that still stands: never run `npm install` through
  the Windows `node.exe` at `/mnt/c/Program Files/nodejs/node.exe` — that previously corrupted the
  user's real dev environment. Using native `node`/`npm` for `install`, `build`, `dev`, `tsc`, and
  `eslint` is fine and preferred; fall back to the Windows binary only if native node ever isn't on
  `PATH` in a given session.
- **Routes**: `src/routes/*.tsx`, file-based (`_public.*` = public layout, `dashboard.buyer.*` /
  `dashboard.breeder.*` = dashboards). `src/routeTree.gen.ts` is generated — never hand-edit it;
  it regenerates when the dev server or a build runs.
- **UI kit**: shadcn/Radix components in `src/components/ui/*` — reuse these, don't add a second
  design system. Shared marketplace cards live in `src/components/cards.tsx`, site chrome in
  `src/components/site-chrome.tsx`.
- **Database**: local Supabase only (`supabase/config.toml`, `supabase/migrations/*.sql`,
  `supabase/seed.sql`). No production Supabase project is configured. See `docs/LOCAL_SETUP.md` for
  commands and demo credentials, and `docs/DOMAIN_MODEL.md` for the schema.
- **Supabase clients**: `src/lib/supabase/browser.ts` (isomorphic, used for all data queries) and
  `src/lib/supabase/server.ts` (cookie-aware, used only inside `createServerFn` handlers for
  session lookup and sign-in/up/out). Don't create a third pattern.
- **Auth**: `src/lib/auth/session.ts` (`getCurrentUser` server fn, hydrated in `__root.tsx`
  `beforeLoad` into `context.auth`) and `src/lib/auth/actions.ts` (`signUp`/`signIn`/`signOut`).
  Client-side reactive auth state: `src/hooks/use-auth.ts`. Roles are additive
  (`public.user_roles`), not a single account type — see `docs/DOMAIN_MODEL.md`.
- **Mock data**: `src/lib/mock-data.ts` is effectively retired — confirmed by grep 2026-07-22, it's
  imported by exactly one file (`src/components/cards.tsx`), and only for **type definitions**
  (`Puppy`/`Litter`/`Breeder`), not rendered data. Every marketplace/dashboard page queries Supabase
  directly now. Do not add new mock arrays, and don't trust older docs/comments claiming pages are
  "still mocked" without re-checking — grep for `mock-data` imports to see the real current state.

## Engineering workflow (apply to every task)

1. Inspect relevant existing code first — don't assume, read it.
2. Explain the planned change briefly before large edits.
3. Implement only the requested scope. Don't redesign unrelated pages.
4. Reuse existing components (`src/components/ui`, `cards.tsx`, query helpers in
   `src/lib/queries/*`) instead of writing new ones that duplicate them.
5. Add loading, empty, success and error states for anything touching the database.
6. Add validation (zod + react-hook-form, matching the pattern in `_public.signup.tsx` and
   `_public.transport.request.tsx`).
7. Protect private data at the RLS layer, not just by hiding UI — every table in
   `supabase/migrations` has RLS enabled with explicit policies; new tables must too.
8. Run type checking and linting before calling a task done (see commands below).
9. Report changed files and remaining limitations — don't claim a feature is "done" if it's only
   visual/mocked.
10. Stop after completing the requested scope; don't chain into unrequested follow-on work.

## UX principle for any user-facing flow (forms, onboarding, applications)

The bar is "an ordinary user with no technical knowledge, on a phone, completes this without
reading instructions." Concretely: short guided steps over one long form, plain language, sensible
defaults, prefilled information wherever it's already known, automatic draft saving, progressive
disclosure (ask only what's needed *right now* — legal/document/operational detail can come later,
before final approval, not all up front), a clear preview before submitting, an obvious next
action, and the user always understanding *what* is being asked, *why*, *what happens next*, and
whether their request is merely submitted vs. estimated vs. accepted vs. confirmed. Don't
overengineer past this — reuse existing form patterns (`react-hook-form` + zod +
`src/components/ui/form.tsx`) rather than inventing a new one per feature.

**Every submission flow needs the same shape**: a preview step before sending (clearly separating
what's public, what's operations-only, what's private, and what's still missing/can be added
later, each section editable from the preview) and a specific, non-generic success screen (what
was submitted, whether it's public yet, whether review is required, what happens next, how to get
back to it — never a bare "Success"). Reuse the `_public.transport.request.tsx` step-7 summary +
`SubmittedSummary` pattern as the template for every other flow (breeder listing, litter
publication, adoption listing, private rehoming, route-place request), don't invent a new preview
pattern per feature. Customer-facing status displays translate internal operational states into a
short plain-language journey (see `transportMilestones` in `src/lib/queries/transport.ts`) —
never show raw internal codes like a compliance-review enum value or a route-assignment id to a
customer without translation.

**Customer-facing copy is written for an ordinary person, not a logistics employee, lawyer or
developer.** Design from the user's goal ("I need a dog transported", "I want to find a puppy",
"I want to publish my litter", "I need a new home for my dog") and everyday phrasing ("Where
should we collect the dog?", "My dates are flexible", "We found a possible route"), never internal
system nouns ("logistics request", "compliance classification", "operational assignment",
"dispatch state", "route compatibility score") in anything a buyer/breeder/foundation/driver sees.
Internal dashboards (ops/admin) can and should stay precise and technical — the translation only
has to happen at the customer-facing edge. The bar: an ordinary user should find Havenpaw easier
than a Facebook group, a phone call, or a private message thread — immediate understanding, not
just a working feature.

## Fundamental product rules

1. Transport is a central workflow, not a small add-on.
2. Any registered user may submit a transport request.
3. Not every user may publish commercial puppy listings — only approved breeders.
4. Only approved organisations may publish foundation/shelter (adoption) listings.
5. Private rehoming requires a separate moderated workflow.
6. Public maps must never expose exact private residential addresses.
7. Exact pickup/delivery addresses are private operational data (see
   `transport_requests.pickup_address_exact` / `destination_address_exact` — RLS-restricted).
8. Social login (Google/Facebook) never implies identity, breeder or ownership verification.
9. A completed form never means transport is declared legally compliant — only a review-routing
   label (`compliance_review_result`), never a final decision.
10. AI (when introduced) may only produce recommendations — final transport, legal, route and
    quotation approval stays human.
11. Never use localStorage as the primary data source.
12. Never silently fall back to fake/mock data after a page has been connected to the database.
13. Important status changes need an audit trail (`transport_status_history`, `audit_logs`).

## Commands

```bash
npm run dev          # vite dev
npm run build         # vite build
npm run lint           # eslint .
npm run db:start / db:stop / db:reset / db:status / db:types   # supabase CLI wrappers
```

Native `node`/`npm` are on `PATH` in this sandbox — just run the commands above directly (`npm run
build`, `npx tsc --noEmit`, `npx eslint .`, etc). Only fall back to prefixing with the Windows node
binary (`"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit`) if a
future session finds native `node`/`npm` genuinely missing from `PATH` — and even then, never run
`npm install` through that binary (see the framework note above).

## Where to look next

- `docs/PRODUCT_VISION.md` — what Havenpaw is, the permanent priority hierarchy, and the staged
  roadmap. Read this before touching product scope — Havenpaw is a dedicated animal ecosystem, not
  a transport company or a general marketplace.
- `docs/FUNDRAISING_POLICY.md` — the authoritative fundraising policy (eligibility, campaign
  requirements, financial rules); no fundraising code exists yet.
- `docs/DOMAIN_MODEL.md` — entities and relationships (identity, animals, transport, routes/fleet,
  moderation, community).
- `docs/IMPLEMENTATION_PLAN.md` — phased build order.
- `docs/DECISIONS.md` — architectural/product decisions already made, so later work doesn't
  contradict earlier work.
- `docs/CURRENT_STATE_AUDIT.md` — historical snapshot of what's real vs. mocked, mid-build.
- `docs/MVP_TEST_REPORT.md` — current "what actually works today," verified against real API calls.
- `docs/PRODUCTION_READINESS_REPORT.md` — ready / partial / blocks-launch / business / legal /
  post-launch breakdown, the authoritative "can we launch" answer.
- `docs/DEPLOYMENT_CHECKLIST.md` — how the Cloudflare Worker build/deploy actually works, confirmed
  against a real `npm run build`.
- `docs/PRODUCTION_SETUP.md` — how to stand up a real production Supabase project when that's
  explicitly approved; not yet done.
- `docs/E2E_TESTING.md` — how to run the Playwright suite locally, and the sandbox gap that
  currently blocks running it here.
- `docs/DATABASE_TESTING.md` — how to run the Node-based database/API regression suite
  (`npm run test:db`), and the real, currently-open bugs it found (read before assuming an RLS
  policy "works" just because it reads correctly).
- `docs/LOCAL_SETUP.md` — how to run the local Supabase stack and demo logins.
