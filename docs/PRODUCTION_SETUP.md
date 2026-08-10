# Anemalo — Production Supabase Setup Guide

Written 2026-07-17, before any production Supabase project exists. This is preparation only — no
production project has been created and no credentials are configured. Do not follow the "go live"
steps below until a real project has been created and explicitly approved.

## 1. Environments — what "local / staging / production" actually means here

This repo only ever talks to Supabase through two env vars, both read at **build time** (Vite
inlines `VITE_*` vars into the bundle — they are not runtime-switchable inside a single deployed
Worker):

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

(`src/lib/supabase/browser.ts`, `src/lib/supabase/server.ts`.) Consequence: **each environment
needs its own `npm run build`**, not one build deployed everywhere with different runtime config.
Concretely:

| Environment | Supabase project | `.env` file used at build time | Deployed as |
|---|---|---|---|
| Local dev | local Docker stack (`supabase start`) | `.env` (copied from `.env.example`, values from `supabase status`) | `npm run dev` |
| Staging | a **separate** hosted Supabase project | `.env.staging` (create when staging project exists) | a separate Worker (see `DEPLOYMENT_CHECKLIST.md`) |
| Production | a **separate** hosted Supabase project | `.env.production` | the production Worker |

Never point staging or production at the local stack, and never let staging and production share
one Supabase project — cross-contaminating demo/test writes with real user data is exactly the
mistake this separation prevents.

## 2. Creating the production project (when approved)

1. `supabase projects create` (or via dashboard) — pick region close to the actual user base
   (Anemalo targets EU transport routes; an EU region avoids unnecessary latency and keeps data
   in-region, relevant given cross-border personal data like exact pickup addresses).
2. `supabase link --project-ref <ref>` locally (or in CI) to associate this repo with the project
   **without** switching local dev away from the Docker stack — `link` only matters for `db push`.
3. Do **not** run `supabase db reset` against production — that command is for the local stack
   only (it wipes and reseeds). Production gets migrations via `supabase db push`.

## 3. Migration order and rollback risk

- 96 migration files exist as of the Stage AL migration-quality pass (2026-07-24; re-verify the
  count before pushing, it grows every session — `ls supabase/migrations/*.sql | wc -l`),
  timestamp-ordered (`supabase/migrations/2026...sql`), applied in filename order by both
  `db reset` (local) and `db push` (remote).
- **No down-migrations exist anywhere in this repo.** Every migration is forward-only. Before the
  first `db push` to a real production project:
  - Review the full migration set once for anything genuinely destructive (`drop table`, `drop
    column`) — re-scanned at Stage AL, still none; every file is additive (create table/column/
    function/policy) or a non-destructive `drop policy`/`drop trigger`/`drop function` immediately
    followed by `create` in the same file (the "redefine a policy" pattern used throughout this
    session — never a data-destroying drop). Re-confirm this hasn't changed before the actual push.
  - Every `add column ... not null` across all 96 files was re-checked at Stage AL and always
    pairs with a `default` — the safe pattern for adding a required column to a table that might
    already have rows. An `add column ... not null` with no default would fail outright against
    any existing production data; there are currently zero such migrations.
  - Every `alter type ... add value` (there are two: `org_member_role`,
    `buyer_application_status`) was re-checked at Stage AL to confirm the new enum value is never
    referenced elsewhere in the *same* migration file — Postgres forbids using a newly-added enum
    value within the transaction that added it, so this would otherwise fail loudly at push time,
    not silently.
  - Because there's no rollback path, the practical safety net is: push to **staging first**, run
    the same manual verification pass documented in `docs/MVP_TEST_REPORT.md` §4 against staging,
    and only push to production after that passes.
- `supabase db push` applies migrations transactionally per-file in modern Supabase CLI versions,
  but a hand-written policy/function bug (this project has already found several — see
  `MVP_TEST_REPORT.md` §3) could still land and need a *new forward migration* to fix, not a revert.
  Plan for "fix forward," not "roll back."
- **`CREATE INDEX CONCURRENTLY` is not usable here.** Every migration in this repo runs inside a
  transaction (both `db reset` and `db push`), and Postgres refuses `CREATE INDEX CONCURRENTLY`
  inside a transaction — this repo's several plain `CREATE INDEX` statements (Stages N and W of
  the autonomous backend session, indexing hot marketplace-query columns) are correspondingly
  full-table-locking for their duration. Against the *empty* database `db push` targets on day
  one, or against any of these tables' current small local-dev row counts, this is not a real
  concern. It becomes one only for a **future** migration adding an index to a table that by then
  holds real production rows at meaningful volume — at that point, either accept a short lock
  window during a low-traffic deploy, or apply that specific index manually via `CONCURRENTLY`
  outside the normal migration flow (documented here so it isn't rediscovered mid-incident).

## 3b. Bounded query readiness (Stage AN, autonomous backend session)

Audited every ops/admin/moderation list query (`listOpsTransportRequests()`, `listReports()`,
`listModerationCases()`, and similar functions in `src/lib/queries/operations.ts`/`moderation.ts`)
for the obvious "this will return the entire table as data grows" risk — none of them call
`.limit()` explicitly. **They are not actually unbounded**: `supabase/config.toml`'s
`api.max_rows = 1000` caps every PostgREST response at 1000 rows platform-wide, regardless of
application code, and all of these queries are already ordered by `created_at desc` (most-recent-
first), so the cap degrades gracefully rather than returning an arbitrary slice. Confirmed by
reading the config directly, not assumed.

**This is a `supabase/config.toml` setting — it does not automatically carry over to a hosted
production project.** A real Supabase project's PostgREST `max-rows` setting is configured through
the Supabase dashboard (Project Settings → API), separately from this repo's local `config.toml`.
Before going live: confirm the production project has an equivalent row cap configured (Supabase's
own hosted default is also 1000, but this should be verified against the actual project settings
at creation time, not assumed to match local).

Marketplace-facing (not ops/admin) list queries have the same implicit 1000-row cap, but that's a
much less adequate safety net for public browse pages at real scale — see the known gap already
documented in Stage W (`listPublishedPuppies()` fetches the full result set and filters client-
side, with no real pagination), which is a frontend-owned page outside this session's scope.

## 4. Seed data — must never touch production

- `supabase/seed.sql` (449 lines) contains demo accounts, sample animals/litters/transport
  requests — this is local-dev-only fixture data (`[db.seed] enabled = true` in
  `supabase/config.toml`, which only applies to `supabase db reset`, a local-stack command).
- `db push` does **not** run seed data — only migrations. Production starts empty by design; no
  action needed to keep seed data out, just don't ever run `psql`/manual `seed.sql` execution
  against the production connection string.
- If a small amount of real reference data is needed in production on day one (e.g. legal document
  version rows, platform config defaults once `docs/PRODUCTION_READINESS_REPORT.md`'s "admin
  configuration area" gap is closed), write that as its own migration, not by reusing `seed.sql`.

## 5. Storage buckets — verified this pass

Two buckets, defined in `20260101002200_storage.sql` /
`20260101003400_transport_documents_storage_driver_access.sql`: `kennel-media` (public) and
`transport-documents` (private). Verified against the local stack with real authenticated API
calls (uploaded a real object, then tested anon read, cross-tenant read/write, ops-staff read,
anon write into the public bucket) — see `docs/PRODUCTION_READINESS_REPORT.md` "Ready" section for
the full result list. All behaved correctly: private documents return `404` (no existence leak) to
both anonymous and unrelated authenticated users, `403` on an unrelated user's write attempt, `200`
for the owner and for ops staff; the public bucket allows reads but rejects an anonymous write into
an arbitrary org's folder. One design note surfaced, not a bug: the uploading customer has no
self-delete/update storage policy on `transport-documents` — only ops staff can remove/replace a
submitted document. Worth a deliberate decision when the document-upload UI is actually built
(still a `NotImplemented` placeholder today) rather than assuming either way.

Still outstanding before production, unrelated to the access-control verification above:
- File-size/MIME-type restrictions: local config caps at `50MiB` overall in `[storage]`;
  per-bucket `allowed_mime_types` is currently commented out in `supabase/config.toml` — decide
  real limits per bucket type (e.g. images only for `kennel-media`, PDF/image for
  `transport-documents`) before production, since local-only testing doesn't need it but a public
  upload surface does.

## 6. RLS policies

Already the most heavily verified part of this project — eight real bugs found and fixed via actual
authenticated `curl` calls and cross-tenant negative tests (`MVP_TEST_REPORT.md` §3). Before
production:
- Re-run the same `db reset`-then-manual-verification pass against **staging** (not just local) at
  least once, since `auto_expose_new_tables` and GRANT behavior have already bitten this project
  once from a Supabase CLI default change — confirm the hosted project's defaults match what local
  assumes.
- No new policy work is needed unless new tables ship first.

## 7. Auth — redirects, email, providers

- `supabase/config.toml`'s `[auth] site_url` / `additional_redirect_urls` (currently
  `127.0.0.1:3000`/`localhost:3000`) **only affects the local stack**. A hosted project's redirect
  allow-list is configured separately, via the Supabase dashboard (Authentication → URL
  Configuration) or `supabase config push` — set it to the real production domain before enabling
  sign-in against that project, or every auth redirect will fail.
- **Email**: `[local_smtp]` (port 54324) is a local dev-only mail catcher — no real emails are ever
  sent locally. Production needs a real SMTP provider configured
  (`[auth.email.smtp]` block in a project-linked config, or dashboard equivalent) before signup
  confirmation / password reset emails can actually be delivered. This is currently unconfigured
  anywhere in the repo — needs a real provider decision (e.g. SendGrid, Postmark) plus API key as a
  Supabase project secret, never committed to this repo.
- **Google/Facebook OAuth**: `enabled = false` for both, by design, until real credentials exist
  (`docs/SOCIAL_AUTH_SETUP.md`). When enabling for production, the redirect URI registered with
  Google/Meta must point at the production Supabase project's `/auth/v1/callback`, not local.

## 8. Database functions

No production-specific changes needed — all `SECURITY DEFINER` functions (`owns_org()`,
`is_conversation_participant()`, `start_application_conversation()`, etc.) are schema-level and
migrate identically to any environment. Verified already per `MVP_TEST_REPORT.md`.

## 9. Backups

Automatic backup frequency and point-in-time recovery depend on the Supabase plan tier chosen at
project-creation time — decide this when creating the production project (business decision, not a
code task). Document the chosen tier and recovery window here once decided.

## 10. Environment variable summary (production)

Required at build time, per environment, never committed:

```
VITE_SUPABASE_URL=<production project URL>
VITE_SUPABASE_ANON_KEY=<production anon key — safe to expose client-side by design, still keep out of git>
```

Optional (only if enabling the corresponding provider for that environment):
```
SUPABASE_AUTH_GOOGLE_CLIENT_ID / SUPABASE_AUTH_GOOGLE_SECRET
SUPABASE_AUTH_FACEBOOK_CLIENT_ID / SUPABASE_AUTH_FACEBOOK_SECRET
```

No `service_role` key or other elevated credential is used anywhere in this app's runtime code
(confirmed — only the anon key, client- and server-side, relying entirely on RLS). Nothing here
needs to be a Cloudflare Worker *secret* today; see `docs/DEPLOYMENT_CHECKLIST.md` for why.
