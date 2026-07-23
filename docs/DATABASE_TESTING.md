# Havenpaw — Database & API Regression Testing

Written 2026-07-22, alongside the first database/API regression suite (`tests/db/`). This
complements `docs/E2E_TESTING.md` (browser-driven Playwright) with fast, browser-free integration
tests that sign in as real seeded demo accounts and make real PostgREST/GoTrue/RPC/Storage calls
against a running local Supabase stack — the same client library (`@supabase/supabase-js`) the app
itself uses, just from Node instead of a browser. No new dependency was added: Node's built-in test
runner (`node:test`) runs the `.ts` files directly via Node 24's built-in TypeScript type-stripping.

## Why this exists

Havenpaw's RLS layer has a real history of subtle, previously-shipped bugs — missing table grants,
PII over-exposure, RLS recursion, `INSERT ... RETURNING` treated as `SELECT`, and a column-shadowing
bug that silently returned empty results instead of erroring (see `docs/MVP_TEST_REPORT.md` §3).
Every one of those was only ever caught by testing real authenticated API calls, not by reading the
policy SQL and assuming it was correct. This suite automates exactly that testing style so those
bug classes can't quietly come back, and so new ones get caught by CI instead of by a future user —
the first pass found four (see "Previously-open findings, now fixed" below), all closed out in a
follow-up security-hardening pass the same week.

## Required setup

1. Local Supabase running with seed data: `npm run db:start` (first run applies every migration in
   `supabase/migrations/` in order, then `supabase/seed.sql` — see `docs/LOCAL_SETUP.md`). If the
   stack is already running from earlier work, this suite doesn't need a fresh `db:reset` — it's
   self-cleaning (see below) and doesn't depend on any state beyond the standard seed data.
2. Nothing else. No `.env` values are required beyond the defaults already documented in
   `docs/LOCAL_SETUP.md` — the suite falls back to the well-known local Supabase demo URL/anon key
   (the same fixed values every fresh `supabase init` project gets from the default
   `supabase/config.toml` JWT secret) if `SUPABASE_URL`/`SUPABASE_ANON_KEY` aren't set in the
   environment.

## Running the suite

```bash
npm run test:db
```

This runs `node --test --test-concurrency=1 tests/db/*.test.ts`. Concurrency is deliberately
serialized to 1 — every test signs in as one of the same ten shared seeded demo accounts (cached
per persona for the whole run, see `tests/db/helpers.ts`), and several tests briefly mutate shared
rows (a role's `status`, a request's `assigned_driver_id`) before reverting them; running files in
parallel would race those mutations against each other.

To type-check the suite itself (it's intentionally excluded from the main `tsconfig.json`, same
treatment as `tests/e2e/`, since it needs Node types rather than the app's browser/DOM lib target):

```bash
npx tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --strict --types node --allowImportingTsExtensions tests/db/*.ts
```

`npm run lint` already covers `tests/db/` normally (no special invocation needed there).

## What's covered

- **`tests/db/access-control.test.ts`** — positive/negative access across every major resource
  area (profiles/contact data, organisations, animal listings, buyer/adoption applications,
  transport requests, quotations, saved animals/follows, moderation cases, audit logs, private
  documents in Storage) for anonymous visitors, buyers, breeders, foundation members, operations
  staff, drivers and admins — including a five-part assigned-driver document-access suite (finding
  #4 below): the assigned driver can read it, an unrelated driver cannot, an unrelated customer
  cannot, and access disappears/returns exactly when the assignment does.
- **`tests/db/security-regressions.test.ts`** — one test per specific historical bug from
  `docs/MVP_TEST_REPORT.md` §3 (missing table grants, profiles email/phone exposure, RLS recursion,
  `INSERT ... RETURNING`-as-`SELECT`, self-referencing conversation policies, the conversations
  column-shadowing bug, conversations created without a real relationship, plus a check that
  drivers can't see unrelated routes/fleet records), plus comprehensive multi-part coverage for two
  of the four now-fixed findings below: transport-request operational-field locking (every allowed
  customer transition and every forbidden one, tested separately — not one broad assertion) and the
  org-owner-notifies-applicant scope (allowed, blocked-when-unrelated, no sender-side inbox leak,
  correct recipient/third-party visibility).
- **`tests/db/workflows.test.ts`** — ten end-to-end scenarios: buyer applies for a puppy → breeder
  reviews it; a foundation receives an adoption enquiry; private rehoming stays hidden until admin
  approval; a transport request goes from submission through a sent quotation; an unrelated
  customer can't see it; a driver only sees work once actually assigned; reporting an organisation
  creates a moderation case; and a role-suspension suite covering both role-gated access
  (ops/admin — always correctly revoked) and ownership-gated access (kennel/foundation/shelter/
  rescue organisations — see finding #2 below), plus that a non-owner org member's access and an
  admin's access are both unaffected by another user's role suspension.
- **`tests/db/fundraising.test.ts`** — verified-organisation fundraising
  (`docs/FUNDRAISING_POLICY.md`, `20260101005600_fundraising.sql`): only an approved foundation/
  shelter/rescue can create a campaign (a kennel is rejected); a campaign can't be backed by a
  purchase-type application, an unaccepted quotation, or a duplicate quotation already in use;
  draft campaigns are invisible to anon and to other orgs; an org can't self-approve/activate/
  complete their own campaign; once admin activates it, it's publicly visible; only a real
  `is_simulated = true` contribution to an active campaign is accepted; an anonymous contribution
  is excluded from the public per-row list but still counts toward the public total; and the
  campaign's animal/transport/quotation/organisation is locked once a completed contribution
  exists. Two real bugs surfaced while writing these tests, both fixed the same session (see
  `docs/IMPLEMENTATION_PLAN.md` phase 13): the public campaign query originally failed outright for
  anonymous visitors (`permission denied for table transport_requests` / `fundraising_contributions`
  — reproduced against the real API before fixing), and organisations turned out to have no DELETE
  policy on their own campaigns at all (by design, but the test fixtures had to be updated to clean
  up via admin instead of the org account).

## Previously-open findings, now fixed

Building this suite surfaced **four real bugs**, each reproduced independently via raw `curl` (or,
for #1, direct `psql` against the local database) with real bearer tokens/roles before any test was
written, so these were never test artifacts. Each one was left in as a deliberately-failing
"OPEN FINDING" test for one pass, then fixed in a dedicated security-hardening pass
(migrations `20260101006000`–`20260101006300`), with the tests rewritten into comprehensive
allowed/forbidden coverage rather than a single broad assertion. All four are now fixed and green;
this section is kept as the historical record of what was wrong and how it was closed.

1. **Customers could change their own transport request's operational `status` directly.**
   `"requesters update their own transport requests"` only checked row ownership
   (`requester_profile_id = auth.uid()`), not which columns changed — a signed-in customer could
   PATCH `status` (or `compliance_review_result`, `visibility`, `assigned_*`) to any value,
   bypassing the entire ops workflow. RLS is row-level, not column-level, so
   **`20260101006000_lock_transport_request_operational_fields.sql`** adds a `BEFORE UPDATE`
   trigger (`prevent_non_staff_operational_field_changes`) that blocks any change to those columns
   unless the actor is ops staff/admin or the specific driver already assigned to that request.
   Two customer-initiated transitions stay legitimately allowed: submitting their own draft
   (`draft -> submitted`) and self-cancelling (`-> cancelled_by_customer`) — found necessary by
   re-running the full workflow suite against a first version of the trigger that blocked
   everything and broke the real "customer submits a transport request" flow. Every allowed and
   forbidden transition now has its own test in `tests/db/security-regressions.test.ts` (submit,
   cancel, arbitrary status, `compliance_review_result`, `visibility`, `assigned_*`, ops staff
   retaining access, an unrelated driver having none).
2. **Suspending a breeder's role did not revoke their organisation-management access.**
   `owns_org()`-gated policies (organisations, animals, litters, parent_dogs,
   buyer_applications-as-org-owner) checked only `organisations.owner_user_id`, never
   `user_roles.status` — a breeder whose role was `suspended` kept full control of their kennel.
   **`20260101006100_owns_org_checks_active_role.sql`** adds `owner_role_for_org_type()`, mirroring
   `approve_user_verification()`'s own creation-time role mapping (`kennel` → `breeder`, `shelter` →
   `shelter_member`, `foundation`/`rescue` → `foundation_member`), and `owns_org()` now also
   requires that role to still be `active` for org types where one applies (org types with no
   role mapping, e.g. `transport_company`/`kennel_club`/`other`, are unaffected — pure ownership,
   same as before). `tests/db/workflows.test.ts` now covers all four role-mapped org types
   (kennel/foundation seeded; shelter/rescue built as ad-hoc fixtures since none are seeded),
   confirms a non-owner member's read access is unaffected, and confirms an admin's access never
   depends on `owns_org()` at all.
3. **An org owner notifying an applicant failed with `42501` despite the policy reading correctly.**
   `20260101004900_notifications_org_owner_notify_applicants.sql`'s INSERT policy always evaluated
   correctly — the row went in every time. The failure only appeared when the caller also asked for
   the row back (PostgREST's default `.insert(...).select(...)`, or `Prefer: return=representation`)
   because Postgres treats `INSERT ... RETURNING` like a `SELECT`, and `notifications` had no
   `SELECT` policy letting an org owner see a row filed under the *applicant's* `profile_id` — only
   "your own rows" and moderator/admin existed. Confirmed by reproducing the exact insert directly
   against the database with and without `RETURNING`.
   **`20260101006200_notifications_actor_visibility.sql`** adds a real `actor_profile_id` column
   (auto-stamped by a trigger, mirroring the existing `audit_logs.actor_profile_id` convention) and
   a `SELECT` policy scoped to "you can see notifications you personally sent" — deliberately
   narrower than "you can see everything your applicant ever received", which would leak
   notifications sent by ops/admin/other unrelated senders. `tests/db/security-regressions.test.ts`
   now covers the real relationship succeeding, an unrelated org being blocked, the sender being
   unable to list the recipient's other notifications, the recipient seeing their own notification,
   and a third party seeing neither.
4. **An assigned driver could not read their job's documents in Storage — a column-shadowing bug.**
   `20260101003400_transport_documents_storage_driver_access.sql`'s policy source read
   `(storage.foldername(name))[1]::uuid`, intending the bare `name` to mean `storage.objects.name`
   (the pattern every other storage policy correctly uses). Its subquery also joined
   `public.drivers d`, which **also** has a `name` column, and Postgres resolved the unqualified
   `name` to `d.name` (the driver's personal name) instead — confirmed live via `select policyname,
   qual from pg_policies where tablename='objects' and policyname ilike '%driver%'`, which showed
   the stored policy literally reading `storage.foldername(d.name)`. The exact
   "column-shadowing silently returns the wrong result" bug class already fixed once for
   `conversations`/`conversation_participants` (`20260101005200_...`), reintroduced via a different
   pair of same-named columns. **`20260101006300_fix_driver_storage_column_shadowing.sql`**
   qualifies the reference explicitly (`storage.foldername(objects.name)`) — re-confirmed live
   against the fixed policy's stored `qual`, not just the migration source.
   `tests/db/access-control.test.ts` now covers the assigned driver reading it, an unrelated driver
   being blocked, an unrelated customer being blocked, and access disappearing/returning exactly
   when the assignment does.

Every fix was verified against a clean `supabase db reset` and the full suite run twice in a row
without a reset in between (confirming test fixtures actually restore shared seed state), not just
against the specific previously-failing assertion.

## How test data is reset / isolated

The suite never runs `supabase db reset` itself (same rule as `tests/e2e/` — that would wipe demo
data other tests and developers rely on). Instead every test that creates data cleans up after
itself, using the same RLS-governed access a real user would have:

- Rows a persona can delete themselves (their own `buyer_applications`, `follows`, animals they
  own, draft transport requests) are deleted via that persona's own client in a `finally` block.
- Rows only privileged roles can delete (`rehoming_reviews`, `moderation_cases`, `reports`,
  `quotations`, `audit_logs`, storage objects in `transport-documents`) are cleaned up via the
  admin/ops/moderator demo account's own authenticated session — **never** via the Postgres
  `service_role` key. That key was tried first while building this suite and turned out to have no
  table-level grants in this local stack (`service_role=Dxtm/...` — no `SELECT`/`INSERT`/`UPDATE`/
  `DELETE`), so every fixture and every cleanup in this suite goes through a real authenticated
  role's own RLS-governed access instead, which also means the suite never needs (or has) any
  RLS-bypassing credential.
- Tests that temporarily mutate a *shared seed row* (a role's `status`, a request's `status`/
  `assigned_driver_id`) always restore the original value in a `finally` block, and this pass
  verified afterward (via direct API queries) that every seed count and mutated field was back to
  its original state.
- Ad-hoc fixtures built for org types with no seeded example (a temporary `shelter`/`rescue`
  organisation and a temporary active role grant, used by the suspended-role-owner tests in
  `tests/db/workflows.test.ts`) are created and deleted within the same test, verified by running
  the full suite twice in a row without a `db reset` in between.

## Known environment limitations

- **Requires Docker.** Like the rest of local development (`docs/LOCAL_SETUP.md`), there's no way
  to run this suite without the local Supabase/Docker stack running.
- **No transaction-per-test rollback.** Unlike some test frameworks, this suite doesn't wrap each
  test in a transaction it rolls back — it does real commits and real (RLS-governed) deletes. This
  is deliberate: testing through the real PostgREST/GoTrue/Storage HTTP layer (not a direct DB
  connection) is the whole point, and PostgREST doesn't expose a way to keep a test's transaction
  open across multiple HTTP requests.
- **`--test-concurrency=1` makes the suite slower than it could be** (a few seconds total as of
  this writing) in exchange for determinism against shared seed accounts. Worth revisiting only if
  the suite grows enough that this becomes a real bottleneck.
- **CI job (`database-tests` in `.github/workflows/ci.yml`) is expected to be green.** It ran red
  for one pass while the four findings above were deliberately left open and documented; all four
  are now fixed and the job should pass — a red result now is a real regression, not the suite
  doing its job.
