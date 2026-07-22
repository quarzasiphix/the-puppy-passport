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
bug classes can't quietly come back, and so new ones (see "Open findings" below — this first pass
already found four) get caught by CI instead of by a future user.

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
  staff, drivers and admins.
- **`tests/db/security-regressions.test.ts`** — one test per specific historical bug from
  `docs/MVP_TEST_REPORT.md` §3 (missing table grants, profiles email/phone exposure, RLS recursion,
  `INSERT ... RETURNING`-as-`SELECT`, self-referencing conversation policies, the conversations
  column-shadowing bug, conversations created without a real relationship, plus a check that
  drivers can't see unrelated routes/fleet records) — and, separately and clearly labelled, the
  **open findings** this pass discovered (see below).
- **`tests/db/workflows.test.ts`** — ten end-to-end scenarios: buyer applies for a puppy → breeder
  reviews it; a foundation receives an adoption enquiry; private rehoming stays hidden until admin
  approval; a transport request goes from submission through a sent quotation; an unrelated
  customer can't see it; a driver only sees work once actually assigned; reporting an organisation
  creates a moderation case; and a role-suspension test that shows the difference between
  role-gated access (correctly revoked) and ownership-gated access (see open findings).
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

## Open findings (real, currently-unfixed issues this suite discovered)

Building this suite surfaced **four real, currently-open bugs** — reproduced independently via raw
`curl` with real bearer tokens before any test was written, so these are not test artifacts. Each
one has a test in `tests/db/` that asserts the *correct* behaviour and is **expected to currently
fail** — they were deliberately left in, unfixed, rather than deleted or weakened, so they stay
visible in `npm run test:db` / CI until someone fixes the underlying policy:

1. **Customers can change their own transport request's operational `status` directly.**
   `"requesters update their own transport requests"` only checks row ownership
   (`requester_profile_id = auth.uid()`), not which columns change. A signed-in customer can PATCH
   `status` (or `compliance_review_result`, `assigned_*`) to any value, bypassing the entire ops
   workflow. See `tests/db/security-regressions.test.ts`.
2. **Suspending a breeder's role does not revoke their organisation-management access.**
   `owns_org()`-gated policies (organisations, animals, litters, parent_dogs,
   buyer_applications-as-org-owner) check only `organisations.owner_user_id`, never
   `user_roles.status`. A breeder whose role is set to `suspended` keeps full control of their
   kennel. (By contrast, suspending an `operations`/`admin`/`moderator` role correctly *does* revoke
   access, since `is_ops_staff()`/`is_admin()`/`is_moderator()` do check role status — see the same
   test file for both halves of this comparison.) See `tests/db/workflows.test.ts`.
3. **An org owner notifying an applicant currently fails.**
   `20260101004900_notifications_org_owner_notify_applicants.sql` added a policy so a breeder can
   notify a buyer with a real application to their org — exactly what
   `src/lib/queries/applications.ts`'s `respondToApplication()` → `notifyUser()` calls in
   production. The policy reads correctly and matches this exact scenario, but the INSERT is
   rejected with `42501` regardless, reproduced via `curl` with a real breeder bearer token. Root
   cause not yet identified. See `tests/db/security-regressions.test.ts`.
4. **An assigned driver cannot read their job's documents in Storage — a column-shadowing bug.**
   `20260101003400_transport_documents_storage_driver_access.sql`'s policy source reads
   `(storage.foldername(name))[1]::uuid`, intending the bare `name` to mean `storage.objects.name`
   (the pattern every other storage policy correctly uses). Its subquery also joins
   `public.drivers d`, which **also** has a `name` column, and Postgres resolves the unqualified
   `name` to `d.name` (the driver's personal name) instead — confirmed live via `select policyname,
   qual from pg_policies where tablename='objects' and policyname ilike '%driver%'`, which shows
   the stored policy literally reading `storage.foldername(d.name)`. This is the exact
   "column-shadowing silently returns the wrong result" bug class already fixed once for
   `conversations`/`conversation_participants` (`20260101005200_...`), reintroduced here via a
   different pair of same-named columns and never caught until this pass. See
   `tests/db/access-control.test.ts`.

**Do not fix these by weakening the test assertions or the RLS policies' intent** — fix the
underlying policy/trigger so the *documented* behaviour actually holds, then flip each test from an
"OPEN FINDING" back to a plain regression guard (remove the "OPEN FINDING" label and the
now-resolved explanation comment).

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
- The one exception is the two intentionally-failing "OPEN FINDING" tests whose entire point is
  that a write which *should* be blocked currently isn't — those also revert the row in a `finally`
  block regardless of whether the assertion passed or failed.

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
- **CI job is expected to fail today** (see "Open findings" above) — this is intentional, not a
  broken pipeline; see the comment above the `database-tests` job in
  `.github/workflows/ci.yml`.
