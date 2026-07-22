# Havenpaw — Decisions Log

Architectural and product decisions already made, with the reasoning, so later work doesn't
quietly contradict earlier work. Newest at the bottom of each section is not implied — read the
whole thing before making a conflicting choice.

## Product direction

- **Scope correction, 2026-07-22: Havenpaw is a dedicated animal ecosystem; transport is a major
  advantage, not the primary identity.** This explicitly **reverses** the earlier decision directly
  below ("transport is the primary commercial service"). That framing drove a transport-first
  homepage hero, nav order, and header CTA, which have now all been corrected back toward
  animal-discovery-first (see `src/routes/_public.index.tsx`, `src/components/site-chrome.tsx`).
  The permanent priority order is now: (1) animal discovery/marketplace, (2) breeder/foundation/
  public profiles, (3) social feed/communication/community, (4) applications/reservations/adoption/
  handover, (5) integrated Havenpaw transport after a purchase or adoption, (6) standalone transport
  requests, (7) verified-organisation fundraising (see `docs/FUNDRAISING_POLICY.md`), (8)
  animal-related services/products/events/education. See `docs/PRODUCT_VISION.md` for the full
  hierarchy and the main customer journey. **Havenpaw must never expand into unrelated
  general-marketplace categories** (cars, electronics, furniture, tools, etc.) — every feature must
  trace back to this hierarchy.
- ~~Transport is the primary commercial service; marketplace/adoption/community are supporting
  pillars.~~ **Superseded by the correction above.** This had itself superseded an earlier "puppy
  marketplace first" framing and a separate "breeder map + achievements" request — kept here as a
  historical record of how the framing has moved over time, not as current guidance.
- **Fundraising is verified-organisation-only, transport/welfare-only, never a Havenpaw wallet.**
  See `docs/FUNDRAISING_POLICY.md` for the complete policy, decided 2026-07-22 ahead of any
  implementation. Key points worth restating here so they can't be quietly relaxed by a later
  feature request: only approved organisations (never private users/buyers/adopters) may create a
  campaign; a campaign never funds the purchase/adoption fee of an animal, only transport and
  related welfare costs; collected funds go directly to the connected Havenpaw transport balance,
  never to a freely-withdrawable personal balance; and no payment provider is integrated until one
  is explicitly approved — until then this stays behind a feature flag.
- **VIP transport is privacy/scheduling/communication, never a higher minimum welfare standard.**
  Every UI surface describing transport tiers must say this explicitly — it's a legal/ethical
  claim, not just marketing copy, and has been called out in every relevant spec this project has
  received so far.
- **No automated legal-compliance claims.** `compliance_review_result` (and every related field)
  is a *routing label* for ops staff, never presented to the customer as "your transport is legally
  compliant." Copy always uses review-in-progress language ("subject to review", "final eligibility
  confirmed after review").
- **A legal knowledge base is a real future differentiator, not a v1 requirement.** Don't invent
  country-specific legal rules; a `legal_requirements` placeholder table (planned, not yet built)
  will only ever hold rows with a source URL and a review date.
- **AI (when introduced) produces recommendations only.** Matching, pricing, and scheduling
  suggestions must be explainable and deterministic-by-default; a human (ops/admin) makes every
  binding decision. Don't wire an LLM into a decision path that skips human confirmation.

## Data model

- **Roles are additive (`user_roles`), never a single `profiles.account_type` column.** A profile
  can be a breeder and a transport customer at once. Restricted roles (`operations`, `driver`,
  `moderator`, `admin`) can never be self-inserted by a user — only granted via
  `approve_user_verification()` (admin-gated) or directly by an admin.
- **`animals` generalizes puppies, adoption listings and private rehoming into one table**
  (`listing_category` discriminates), instead of three near-duplicate tables with duplicated RLS.
  A `not_listed` animal is just a record attached to a transport request with no public listing.
- **`organisations` (not `kennels`) is the generic entity for kennels, foundations, shelters,
  rescues, the transport company, and kennel clubs.** One RLS shape serves all of them.
  `owner_user_id` is an explicit column on the table itself (not solely derived from
  `organisation_members`) so ownership checks work even before any membership row exists — this
  matters at the exact moment `approve_user_verification()` creates the organisation and its first
  membership row together.
- **`user_verifications` is the one generic verification/application pipeline**, replacing an
  earlier bespoke `organisation_applications` table. `verification_type` covers email/phone/
  identity/breeder/organisation/animal_ownership/driver/transport_employee; `submitted_data` jsonb
  holds the type-specific payload. This was a deliberate mid-session schema redesign — the earlier
  table name was `organizations`/`organization_applications` (American spelling, bespoke
  applications table); it was fully replaced, not layered on top of, once the redesign was
  confirmed, because nothing had been deployed to a running database yet.
- **Exact addresses live only in `private_addresses` / `*_address_exact` columns**, always
  excluded from anything anon/broad-authenticated can select. A public-facing view of a
  mixed-visibility table (e.g. `public_transport_requests`) hand-picks safe columns and is
  deliberately *not* `security_invoker` — see the comment in
  `20260101002300_public_views.sql` for the exact reasoning (an invoker-rights view would need a
  base-table RLS policy granting broad row access, which would then also expose every other column
  on that row since RLS is row-level, not column-level).
- **RLS is enabled in the same migration that creates each table, no exceptions.** No table is
  ever left with default-open access "to fix later."

## Application architecture

- **Two Supabase clients, one job each.** `src/lib/supabase/browser.ts` (isomorphic, used for
  every data query — loaders and client components alike) and `src/lib/supabase/server.ts`
  (cookie-aware via `@tanstack/react-start/server`, used *only* inside `createServerFn` for
  session lookup and sign-in/up/out). Don't introduce a third pattern.
- **`src/lib/supabase/types.ts` is a hand-written stub**, covering only the tables actually
  queried so far, because this sandbox can't run `supabase start` (no Docker) to generate real
  types. It's structured to match what `supabase gen types typescript --local` outputs, so
  `npm run db:types` is a drop-in replacement once a developer runs it locally — **do not** add a
  catch-all string index signature to the `Tables` map; mixing one in with explicit keys collapses
  supabase-js's generic inference to `never` for every table (learned the hard way this session).
- **Migrations are edited in place, not layered as ALTER patches, until the project has actually
  been deployed once.** Nothing has run against a live database yet in this session (no Docker) —
  once a developer runs `supabase db reset` for the first time against real data, this stops being
  true and future schema changes should become additive migrations instead.

## Environment / tooling (specific to this sandbox — may not apply to a normal dev machine)

- **Native Linux `node`/`npm` (nvm, currently v24) are on `PATH` and work correctly** —
  `npm run build`, `npm run dev`, `tsc --noEmit`, `eslint` all run fine through it. A Windows
  `node.exe` at `/mnt/c/Program Files/nodejs/` also exists, reachable from WSL, and was the only
  documented option for a while after the incident below — but that was because native `node`/`npm`
  had broken dependencies at the time, not because they were absent from this sandbox. Confirmed
  2026-07-17 by running a real `npm run build` (clean, zero errors) and serving the output with
  `npx wrangler dev` against real requests — see `docs/MVP_TEST_REPORT.md` section 4. Prefer native
  `node`/`npm` for everything; only fall back to the Windows binary if a future session finds native
  node genuinely broken or missing again.
- **Never run `npm install` through the Windows `node.exe`.** Doing so once already wrote
  Windows-flavored optional native bindings (`rolldown`) into `package-lock.json`, which broke
  `npm run dev` in the user's real (Linux) terminal — fixed by `rm -rf node_modules
  package-lock.json && npm install` run natively by the user (which is also why native node/npm work
  correctly again now). This rule still stands regardless of which node binary is otherwise in use:
  any future dependency install must be requested from the user to run themselves, or run through
  native node/npm only, never through the Windows binary.
