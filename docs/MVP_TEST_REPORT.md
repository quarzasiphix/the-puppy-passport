# Havenpaw — MVP Integration Review

Snapshot as of 2026-07-17, after the local Supabase foundation, auth, homepage/nav, transport
request flow, operations dashboard, matching engine, pricing, marketplace-on-real-data, breeder
dashboard CRUD, adoption + private rehoming, reporting/moderation, community/notifications, driver
workspace, GDPR self-service, legal pages, buyer applications (puppy purchase), saved animals,
followed breeders, breeder/foundation profile & settings pages, activity-linked messaging
(buyer↔breeder, buyer↔foundation, transport customer↔operations), a site-wide dead-button/
fabricated-content audit, an SEO/status-translation polish pass, and — as of this update — the
foundation applications inbox plus reload-persistence fixes so "have I already applied?" survives a
page refresh instead of resetting to a blank form. This supersedes `docs/CURRENT_STATE_AUDIT.md`
for "what actually works today" — that file is a historical snapshot from mid-build and most of its
listed risks (migrations never run, Docker unavailable, breeder dashboard unwired) are now resolved.

**Note on this document's own history**: an earlier version of this file listed "breeder map,
guided search, achievements/champions" and "GDPR self-service" as not built — both were actually
completed in the same session that wrote that version, and the table just wasn't updated
afterwards. Treat this file as a living document that can itself drift from the code; when in
doubt, grep for `mock-data` imports and `NotImplemented`/`Construction` usage to see the real
current state rather than trusting any prose summary, including this one.

**Correction, 2026-07-22**: this document's "verified end-to-end" claims below for `/breeders/$slug`
(breeder profile), `/adoptions/$id` (adoption detail) and `/transport/request` (the 7-step form)
were true for the *data layer* (real Supabase queries, correct RLS) but **not for the actual
rendered page** — a routing bug (a bare `_public.breeders.tsx`/`_public.adoptions.tsx`/
`_public.transport.tsx` coexisting with its nested route without an `<Outlet/>`) meant these three
pages' real components never mounted at all; visiting them showed the *list/overview* page's
content instead, silently. Confirmed via direct HTML inspection, not assumed — this is exactly the
kind of gap this document's own note above warns about: verified data ≠ verified rendered page.
Fixed the same day (see `docs/DECISIONS.md`, "Application architecture" — layout+index route
split), verified again after the fix. Treat every "verified end-to-end" claim in this document as
covering the API/data layer specifically, not a guarantee that a page's visual component tree was
checked past its `<title>`.

## 1. What's verified end-to-end against a real local Supabase instance

Everything below was tested by directly signing in as a seeded demo account (see
`docs/LOCAL_SETUP.md`) and hitting the PostgREST API — not just "the query looks right", but
actual create/read/update/delete calls, cross-tenant access attempts confirmed to fail, and
draft→review→approval flows walked through in full.

- **Auth**: email/password sign up/in/out, session hydration, role-gated dashboard redirects.
- **Marketplace (public)**: `/find-a-dog`, `/puppies/$id`, `/breeders`, `/breeders/$slug`,
  `/planned-litters`, homepage stats — all real Supabase queries, no `mock-data.ts` left in these
  pages. Publication-category restrictions (only published + approved-org listings are public)
  enforced by RLS, not just query filters.
- **Transport**: the 7-step public request form, `/transport` service overview, `/planned-routes`,
  the operations dashboard (dispatch, quotations, routes/vehicles/drivers), the deterministic
  matching engine, transparent price estimation. Customer dashboards show real request lists with
  plain-language status (never raw internal status codes).
- **Breeder dashboard**: parent dogs, litters (with real puppy-count aggregation, not stored
  counters), fast puppy entry, reservations, transport requests linked to sold puppies.
- **Foundation dashboard**: adoption animal listings, transport requests.
- **Public adoptions**: `/adoptions` (org-published + approved private-rehoming, clearly labelled),
  `/adoptions/$id`, first-contact "express interest" via `buyer_applications`.
- **Private rehoming**: `/rehome` submission (preview → submit → "pending review" success state,
  never silently published), admin approval queue, RLS-enforced invisibility until approved.
- **Reporting & moderation**: report a listing/organisation from three public pages, admin triage
  (escalate to case / dismiss), case resolution with an internal-only decision note.
- **Community**: public post feed, like, comment.
- **Notifications**: real per-user notification list, unread badge, mark read; one real trigger
  (rehoming approval/rejection) wired end-to-end to prove the mechanism, not just UI scaffolding.
- **Legal pages**: `/terms`, `/privacy`, `/cookies` — explicitly marked draft/pending lawyer review,
  not final legal text presented as authoritative.
- **Audit logs**: admin-only real viewer over `audit_logs` (already written to by the matching
  engine and ops status-change flow).
- **Breeder map, guided search ("find your dog"), achievements/champions**: `/breeder-map`,
  `/find-your-dog`, kennel achievements + verified-champion profiles — all real Supabase queries.
- **GDPR self-service**: real data export (RPC-backed, RLS-scoped to the caller) and account
  deletion request queue, with an admin-only processing view that deliberately never exposes email.
- **Driver workspace**: active route + jobs, status progression, incident reporting.
- **Buyer applications (puppy purchase)**: `ApplyDialog` on `/puppies/$id` is a real multi-step
  form (household, experience, purpose, collection preference, message) with a preview step and a
  specific success screen, writing a real `buyer_applications` row. Breeder inbox
  (`dashboard.breeder.applications.tsx`) lets the org owner approve/reject/request info/invite to a
  call/waitlist, each writing `status` + `breeder_response` and notifying the buyer. Buyer-side
  lists (`dashboard.buyer.applications.tsx`, and the applications section of
  `dashboard.buyer.index.tsx`) show real status with plain-language labels, and buyers can withdraw
  an application.
- **Saved animals**: heart/save toggle on puppy & adoption cards and the puppy detail page (shared
  `useIsSaved` hook, backed by `saved_animals`), buyer dashboard "Saved puppies" list.
- **Followed breeders**: follow/unfollow on a kennel's public profile (`follows` table), buyer
  dashboard "Followed breeders" list with unfollow.
- **Breeder/foundation profile & settings**: real edit form for the organisation's public profile
  (description, images, location, association, response time) with a live preview panel, plus an
  account settings page (phone edit via `profiles`, email shown read-only since it's intentionally
  locked out of self-service per the PII-lockdown decision below).
- **Messaging**: real conversations backed by `conversations`/`conversation_participants`/`messages`
  (previously dead schema with no working insert path — see bugs #6 and #7 below). Two
  `SECURITY DEFINER` RPCs gate creation so only people with an actual relationship can start a
  thread: `start_application_conversation(animal_id, buyer_id?)` (buyer↔breeder/foundation, requires
  a real `buyer_applications` row) and `start_transport_conversation(transport_request_id)`
  (customer↔ops; ops staff see every transport conversation via their existing blanket policy
  without needing an explicit participant row). Wired into `/puppies/$id` ("Ask breeder"),
  `/adoptions/$id` (after expressing interest), buyer/breeder applications lists ("Message
  breeder"/"Message buyer"), buyer transport requests, and the ops request detail page. Internal
  notes stay on the separate status-history internal-note field, not this customer-visible thread.
- **Dead-button / fabricated-content audit**: swept every route and component for buttons that
  render as clickable but do nothing, and for placeholder pages presenting invented data as real.
  Fixed: two decorative header bell icons replaced with the real `NotificationBell`; a dead "Reset"
  filter button and an entire decorative filter/search panel on `/find-a-dog` now actually filter
  and sort the real puppy list; a "Map view" button that toggled nothing now links to the real
  `/breeder-map`; "Contact breeder"/"Send message" on a kennel profile now route to the puppies tab
  (messaging is scoped per-application, not generic); a "Join waiting list" button with no backing
  feature is now honestly disabled with an explanatory tooltip; `dashboard.breeder.documents.tsx`
  and `dashboard.buyer.documents.tsx` were entirely fabricated data (fake filenames, a fake
  "Reservation for Bella — Srebrna Rzeka" always shown regardless of the signed-in user) — replaced
  with honest `NotImplemented` placeholders rather than either feature.
- **Status-translation fix**: `dashboard.buyer.index.tsx` was showing raw `transport_requests.status`
  enum values (only underscore-to-space replaced) directly to the buyer, bypassing the
  plain-language milestone system already used on the full transport page — fixed to reuse
  `milestoneIndexForStatus`/`isOnHold`/`isClosed`/`transportMilestones` consistently.
- **SEO**: `/puppies/$id` and `/breeders/$slug` — the two most-shared page types — had no `head()`
  meta at all (generic app title, no description); both now set a real per-listing title/description
  from loader data.
- **Foundation applications inbox**: `dashboard.foundation.applications.tsx` mirrors the breeder
  inbox exactly (same `listApplicationsForOrg`/`respondToApplication` query layer, since it's
  already generic across org types) — approve/reject/request-info/call/waitlist, each notifying the
  applicant and letting the foundation message them directly. The foundation overview page also
  gained a real "Applications awaiting reply" KPI card. Verified end-to-end with a real adoption
  application (approve → notify → message → cross-tenant negative test with an unrelated foundation
  account) — all correct, test data cleaned up afterward.
- **Reload-persistence fix**: `/adoptions/$id` and `/puppies/$id` tracked "have you applied?" only
  in local component state — refreshing the page reset it to a blank form, so a returning applicant
  could unknowingly re-fill a 6-step form only to hit a duplicate-key error at the very end. Both
  pages now check the real `buyer_applications` table on load and show "Application sent — \<status\>"
  (linking to the applications dashboard) instead of the form whenever a live application already
  exists — verified against real seed data (an animal with an existing approved application shows
  the status; one with none shows the normal form).

## 2. What's still mock or explicitly deferred

Honest inventory — nothing here is presented as working in the UI beyond what it actually does.

| Area | State | Where |
|---|---|---|
| Group posts | Not built | `group_members` table unused by any UI |
| Per-notification-type preferences | Not built — honest "coming soon" placeholder, not fake toggles | `dashboard.breeder.settings.tsx`, `dashboard.foundation.settings.tsx` |
| Full applications questionnaire (housing, experience, etc.) for adoption/rehoming first contact | Simplified to a first-contact message (puppy *purchase* applications now use the full questionnaire — see above) | by design, see task #13 notes |
| Legal text finalization (real entity, lawyer review) | Not built — placeholders only | task #41 |
| Operations calendar view | Not built — honest placeholder | `dashboard.operations.calendar.tsx` |
| Breeder/buyer document library & per-reservation checklist | Not built — honest placeholder (was fabricated data before this pass) | `dashboard.breeder.documents.tsx`, `dashboard.buyer.documents.tsx` |
| Welfare-urgent flag for foundation animals | Not built — honest placeholder (would need a new schema field) | `dashboard.foundation.urgent.tsx` |

## 3. Real bugs found and fixed during this review pass (and the sessions building up to it)

Worth reading in full — these were all caught by testing actual API calls, not by reading code.

1. **Missing table-level GRANTs after a Supabase CLI default change.** `auto_expose_new_tables`
   now defaults to `false`; every table had correct RLS policies but zero table-level privileges,
   so *everything* returned `permission denied` regardless of what RLS would have allowed. Fixed
   with grants matching each table's own policy intent (public tables get anon SELECT, private
   tables stay anon-inaccessible even at the grant level).
2. **`profiles` PII over-exposure.** Any authenticated user could bulk-read every other user's
   email and phone number via a raw REST call. Fixed with column-level grants (safe columns only
   for cross-user reads) plus a `SECURITY DEFINER` `get_my_profile()` escape hatch for the owner.
3. **RLS recursion between `animals` and `rehoming_reviews`.** Two tables' policies queried each
   other directly, which Postgres refuses to evaluate (`42P17`) regardless of actual recursion
   depth. Fixed by routing both checks through `SECURITY DEFINER` helper functions, matching the
   existing `owns_org()` pattern.
4. **`INSERT ... RETURNING` is treated like `SELECT` for RLS**, twice: a moderator creating a
   notification for someone else, and ops staff writing an audit log entry, both failed the moment
   anything requested the row back — because the only SELECT policy was "your own rows only" and
   staff were writing *other people's* rows. Neither had surfaced as a user-facing bug yet (today's
   app code doesn't request the row back), but both were fixed properly (staff visibility added)
   rather than left as traps for the next feature that does need it.

5. **Same `INSERT` bug class, a third time, caught before shipping.** Building the breeder
   applications inbox, `respondToApplication()` has the breeder's own session write a notification
   row for the *buyer* (`profile_id = buyer_id`, not the caller). The only pre-existing insert
   policy for notifying another user was moderator/admin-only — a real breeder approving an
   application would have hit `42501`. Caught during verification (not by a user report) by
   deliberately testing the write as `breeder1@havenpaw.test` before considering the feature done,
   and fixed with a narrowly-scoped policy: an org owner may notify a profile only if that profile
   has an actual `buyer_applications` row against their organisation (migration
   `20260101004900_notifications_org_owner_notify_applicants.sql`). Also negative-tested that a
   breeder still can't notify an unrelated user (e.g. an ops staff account that never applied) —
   confirmed blocked with `42501`.

6. **`conversation_participants`'s own SELECT policy was self-referential.** It subqueried
   `conversation_participants` from within its own policy — the exact recursion shape already fixed
   once for `animals`/`rehoming_reviews` — causing `42P17` on every read the instant messaging was
   actually exercised for the first time (this table existed since early in the build but had never
   been queried by any UI). Fixed with a `SECURITY DEFINER` helper (`is_conversation_participant()`),
   same pattern as `owns_org()`.
7. **`conversations`'s SELECT policy had a column-shadowing bug, not a permissions bug.** The
   original migration wrote a correlated subquery as `where cp.conversation_id = id`, but because
   `conversation_participants` (aliased `cp`) *also* has an `id` column, Postgres resolved the bare
   `id` to the subquery's own table instead of the outer `conversations` row. The condition became
   "does a participant row exist whose `conversation_id` equals its own `id`" — never true. This
   didn't error; it silently returned `[]` for every read, including for the row's own participants,
   which is a worse failure mode than a 403 because it looks like "no data" rather than "broken
   query." Only caught by testing an actual read immediately after a successful insert and getting
   nothing back. Fixed by qualifying the outer reference explicitly (`cp.conversation_id =
   conversations.id`).
8. **The messaging schema had no working insert path for regular users at all.** Only
   moderator/admin-equivalent "manage all" policies could create a conversation; a buyer or breeder
   had a SELECT policy for conversations they're *already* a participant of, but no way to become a
   participant in the first place — a chicken-and-egg gap that would have blocked messaging
   entirely. Fixed with two narrow `SECURITY DEFINER` RPCs (see section 1) rather than broad INSERT
   policies, so every conversation still requires a verifiable relationship (an application, or
   requester/ops-staff status on a transport request) rather than just "any authenticated user."

All eight were found by testing the actual write *and read* paths with real seeded accounts and
cross-account access attempts, not by reading the SQL and assuming it was correct — several
(especially #7, which fails silently rather than erroring) would not have been caught by code
review alone, only by checking that a successful write could actually be read back.

## 4. Verification methodology (since there's no automated test suite yet)

- `tsc --noEmit` and `eslint` clean on every file touched, every pass.
- Every new feature verified with direct `curl` calls against the local PostgREST API, signed in
  as the relevant seeded demo account(s) — not just "happy path succeeds" but explicit cross-tenant
  negative tests (does an unrelated user get `[]` back, does a non-staff account get `403`).
- **`npm run build` now confirmed working** (2026-07-17) — this had been flagged as the single
  largest unverified risk in the project across many prior sessions, on the assumption that only
  the Windows node binary was available in this sandbox (which does fail on a
  `file://wsl.localhost/...` path-resolution issue). That assumption was wrong: native `node`/`npm`
  (nvm, v24) are on `PATH` here, and `npm run build` completes with zero errors or warnings,
  producing a Cloudflare Worker bundle (`nitro` preset `cloudflare-module` — this project deploys
  to Cloudflare, not a plain Node server). Verified further by actually serving the built worker
  with `npx wrangler dev` and hitting it with real HTTP requests: `/` (200, correct `<title>`/OG
  meta, full real nav), `/find-a-dog` and `/breeders` (200, real Supabase-backed content —
  breed names, prices, kennel names all present, confirming the Workers runtime can reach the local
  Supabase instance for SSR data), `/signin` (200), and an unknown path (404, correct). No runtime
  errors or warnings in the wrangler log across any of these requests. `CLAUDE.md` has been
  corrected to stop telling future sessions native node isn't available.
- RLS coverage swept schema-wide this pass: every table in `public` has `rowsecurity = true`, and
  every RLS-enabled table has at least one policy (no silent "enabled but no policies" tables).
- Swept every `INSERT`-specific (non-`FOR ALL`) policy against its matching `SELECT` policy for the
  same actor, to catch more instances of bug class #4 above. One latent gap remains in `comments`
  (currently unreachable — the community feed only ever shows public posts, no comment-posting UI
  exists yet) — documented, not fixed, since fixing speculative RLS for unbuilt UI risks getting the
  policy shape wrong. The equivalent gap in `messages` was resolved as part of building real
  messaging this pass (see bugs #6–#8) rather than left speculative, since that UI now exists.

## 5. No automated test suite

Everything above is manual verification. For a project this size, worth prioritizing before adding
much more surface area:
- Unit tests for pure logic that's easy to get subtly wrong and hard to eyeball-verify:
  `calculateEstimate`/pricing, the matching engine's scoring, `milestoneIndexForStatus` and the
  other status-translation maps (a wrong index silently shows the wrong customer-facing step).
- An RLS test harness (even a script wrapping the `curl`-based pattern used throughout this report)
  so the negative-access tests don't have to be re-run by hand every time.

## 6. Recommended order for what's next

1. **Actual deployment** (Cloudflare account, custom domain, secrets/env vars for a real Supabase
   project instead of local, DNS) — this is account/business setup, not a code task, but it's the
   only thing left between "builds and runs correctly" and "live on the internet." The build itself
   is no longer a blocker (see section 4).
2. Legal text finalization needs real business input (registered entity, lawyer) before more code
   work there is useful — not a technical blocker.
3. Operations calendar view, per-notification-type preferences, group posts, a document
   library/reservation checklist, welfare-urgent flag for foundation animals — smaller, non-blocking
   gaps, none of which block a complete end-to-end loop for any of the product's pillars.
4. An automated test suite (see section 5) and a real production Supabase project (this one is
   entirely local-only by design so far — no migrations have ever run anywhere but the local Docker
   stack) before real user data is at stake.
