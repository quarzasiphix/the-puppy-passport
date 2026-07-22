# Havenpaw — Production Supabase Setup Guide

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
   (Havenpaw targets EU transport routes; an EU region avoids unnecessary latency and keeps data
   in-region, relevant given cross-border personal data like exact pickup addresses).
2. `supabase link --project-ref <ref>` locally (or in CI) to associate this repo with the project
   **without** switching local dev away from the Docker stack — `link` only matters for `db push`.
3. Do **not** run `supabase db reset` against production — that command is for the local stack
   only (it wipes and reseeds). Production gets migrations via `supabase db push`.

## 3. Migration order and rollback risk

- 54 migration files exist, timestamp-ordered (`supabase/migrations/2026...sql`), applied in
  filename order by both `db reset` (local) and `db push` (remote).
- **No down-migrations exist anywhere in this repo.** Every migration is forward-only. Before the
  first `db push` to a real production project:
  - Review the full migration set once for anything genuinely destructive (`drop table`, `drop
    column`) — a scan at the time of writing found none; all 54 files are additive
    (create table/column/function/policy). Re-confirm this hasn't changed before the actual push.
  - Because there's no rollback path, the practical safety net is: push to **staging first**, run
    the same manual verification pass documented in `docs/MVP_TEST_REPORT.md` §4 against staging,
    and only push to production after that passes.
- `supabase db push` applies migrations transactionally per-file in modern Supabase CLI versions,
  but a hand-written policy/function bug (this project has already found several — see
  `MVP_TEST_REPORT.md` §3) could still land and need a *new forward migration* to fix, not a revert.
  Plan for "fix forward," not "roll back."

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
