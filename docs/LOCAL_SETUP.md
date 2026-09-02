# Anemalo — Local Setup

Anemalo runs entirely against a **local** Supabase stack (Docker). No production Supabase
project is used or referenced anywhere in this repo.

## Prerequisites

- Docker Desktop (with WSL integration enabled, if you're on Windows/WSL) or Docker Engine.
- Node.js 20+ and npm.
- The Supabase CLI (`supabase --version` should work — see
  [supabase.com/docs/guides/cli](https://supabase.com/docs/guides/local-development/cli/getting-started)
  if you need to install it).

## First-time setup

```bash
git clone <this repo>
cd the-puppy-passport
npm install
cp .env.example .env
```

Start the local Supabase stack (this runs every file in `supabase/migrations/` in order, then
`supabase/seed.sql`):

```bash
npm run db:start
```

The first run prints a block like:

```
API URL: http://127.0.0.1:54321
anon key: ey...
service_role key: ey...
Studio URL: http://127.0.0.1:54323
```

Copy the **anon key** into `.env` as `VITE_SUPABASE_ANON_KEY` (the URL in `.env.example` already
matches the default local API URL — leave it unless you changed `supabase/config.toml`). Never
copy the **service_role key** anywhere in this app — nothing in `src/` should ever use it.

Run `npm run config:check` any time to verify `.env` is filled in correctly (it only reports
which variables are set, never their values, and warns if `VITE_SUPABASE_URL` doesn't look like a
local instance — a safeguard against accidentally pointing the app at a real Supabase project,
since none is configured for this repo).

Then start the app:

```bash
npm run dev
```

Open Supabase Studio at `http://127.0.0.1:54323` to browse the database directly if you want to.

## Everyday commands

| Command             | What it does                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run db:start`  | Start the local Supabase stack (Docker containers).                                                                                    |
| `npm run db:stop`   | Stop it.                                                                                                                               |
| `npm run db:reset`  | Drop and recreate the local database from migrations + seed — use this any time you change a migration or want a clean slate.          |
| `npm run db:status` | Show local URLs/keys again without restarting.                                                                                         |
| `npm run db:types`  | Regenerate `src/lib/supabase/types.ts` from the running local database (replaces the hand-written stub with the real generated types). |
| `npm run dev`       | Start the app (`vite dev`).                                                                                                            |
| `npm run build`     | Production build.                                                                                                                      |
| `npm run lint`      | ESLint.                                                                                                                                |

A fresh clone should always be reproducible with:

```bash
npm install
cp .env.example .env      # then fill in VITE_SUPABASE_ANON_KEY from `npm run db:status`
npm run db:start
npm run db:reset          # only needed if db:start didn't already seed (it does, on first start)
npm run dev
```

### Troubleshooting: `npm run db:reset` fails with `exit 139` / `LegacyGoChildExitError`

Confirmed real, container-orchestration-level failure (not an app/migration defect — the same
committed migration files replay cleanly by hand) that can occur, particularly against a
freshly-created container set: the Supabase CLI's own "Initialising schema" step crashes,
partway through — after dropping the previous `public` schema but before finishing the reset —
leaving the database in a partial state and the `storage`/`auth` extension schemas (which those
services bootstrap themselves, separate from this repo's own migrations) incomplete.

**Simplest recovery, confirmed to work**: just retry `npm run db:reset` — it is a normal, safe CLI
command with no destructive side effect beyond its own intended one, and the failure has been
reported as intermittent (container-orchestration timing), not deterministic on every attempt.

If it fails repeatedly and you need a manual fallback, the general shape (verified independently by
an audit pass working from a disposable clone, not merely a suggestion) is: drop and recreate the
`public` schema, then replay every file in `supabase/migrations/` in filename order via `psql`
against the local database container, then `supabase/seed.sql`, then restart the
`supabase_storage_the-puppy-passport`/`supabase_auth_the-puppy-passport` containers so those
services re-bootstrap their own (non-`public`) extension schemas. **One real complication found
while double-checking this locally**: a `drop schema public cascade` does _not_ remove policies
that migrations created on tables living in the `storage` schema (`storage.objects`) — replaying a
migration that re-creates one of those policies fails with `policy "..." for table "objects"
already exists`, since the prior policy is still there. If you hit that, drop the storage-schema
policies for the affected bucket first (`select policyname from pg_policies where schemaname =
'storage'` to find them) before replaying, or restart the storage container _before_ the migration
replay rather than after. Given the added complexity and unverified edge cases in the fully manual
path, prefer just retrying `npm run db:reset` first — it succeeds far more often than not.

## Demo accounts

Every account below uses the password **`password123`**. Passwords are obviously fake/local-only —
never reuse them anywhere real.

| Email                               | Persona                                                        | Role(s)                      |
| ----------------------------------- | -------------------------------------------------------------- | ---------------------------- |
| `customer@anemalo.test`            | Marta Zielińska — private transport customer                   | `customer` (active)          |
| `buyer@anemalo.test`               | Julia Kowalczyk — buyer looking for a puppy                    | `buyer` (active)             |
| `breeder1@anemalo.test`            | Anna Kowalska — owns Cichy Las Kennel (approved)               | `breeder` (active)           |
| `breeder2@anemalo.test`            | Tomasz Nowak — owns Wolna Dolina (approved)                    | `breeder` (active)           |
| `breeder3-pending@anemalo.test`    | Katarzyna Wiśniewska — Srebrna Rzeka, awaiting verification    | `breeder` (pending)          |
| `foundation1@anemalo.test`         | Aleksandra Nowicka — owns Fundacja Ratunek dla Psów (approved) | `foundation_member` (active) |
| `foundation2-pending@anemalo.test` | Bartłomiej Sikora — Schronisko Nadzieja, awaiting verification | `shelter_member` (pending)   |
| `ops@anemalo.test`                 | Kasia Woźniak — transport operations                           | `operations` (active)        |
| `driver@anemalo.test`              | Marek Dąbrowski — driver                                       | `driver` (active)            |
| `admin@anemalo.test`               | Anemalo Admin                                                 | `admin` (active)             |

A pending breeder/foundation account can sign in and use Anemalo as a transport customer, but
cannot publish listings — their organisation doesn't exist yet (only a `user_verifications` row
with `status = 'pending'`). Approve it as the admin account via
`select public.approve_user_verification('<verification id>')` in Studio's SQL editor (a proper
admin UI for this is a later phase — see `docs/IMPLEMENTATION_PLAN.md`).

## Social login (Google / Facebook)

Disabled by default. See `docs/SOCIAL_AUTH_SETUP.md` once that's written (tracked in the
implementation plan) for how to configure real OAuth credentials for local testing. Until then, the
sign-in buttons show a clear "not configured" message instead of a fake success state — this is
intentional, not a bug.

## Manual verification checklist

Docker isn't available in every environment this project might be worked on in — if you're picking
up work where migrations were authored without ever running them, walk this list once before
trusting the schema:

1. `npm run db:start` — should complete without errors and print the local URLs/keys.
2. `npm run db:reset` — re-applies every migration from scratch and reloads the seed data; this is
   the strongest signal that the migration files are internally consistent (FK targets exist,
   enums declared before use, no leftover references to renamed tables).
3. `npm run dev`, then sign in as each demo account above and confirm:
   - the homepage stat counts are non-zero and plausible (not fake/rounded numbers);
   - `buyer@anemalo.test` can submit a transport request at `/transport/request` and see it at
     `/dashboard/buyer/transport`;
   - `breeder3-pending@anemalo.test` cannot see a live kennel profile (still pending);
   - `admin@anemalo.test` can query `user_verifications`/`organisations` directly in Studio.
4. `npm run lint` and `"node" node_modules/typescript/bin/tsc --noEmit` (or just `npx tsc
--noEmit`) should both be clean.
