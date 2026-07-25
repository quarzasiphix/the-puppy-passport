# Havenpaw — Local Setup

Havenpaw runs entirely against a **local** Supabase stack (Docker). No production Supabase
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

| Command | What it does |
|---|---|
| `npm run db:start` | Start the local Supabase stack (Docker containers). |
| `npm run db:stop` | Stop it. |
| `npm run db:reset` | Drop and recreate the local database from migrations + seed — use this any time you change a migration or want a clean slate. |
| `npm run db:status` | Show local URLs/keys again without restarting. |
| `npm run db:types` | Regenerate `src/lib/supabase/types.ts` from the running local database (replaces the hand-written stub with the real generated types). |
| `npm run dev` | Start the app (`vite dev`). |
| `npm run build` | Production build. |
| `npm run lint` | ESLint. |

A fresh clone should always be reproducible with:

```bash
npm install
cp .env.example .env      # then fill in VITE_SUPABASE_ANON_KEY from `npm run db:status`
npm run db:start
npm run db:reset          # only needed if db:start didn't already seed (it does, on first start)
npm run dev
```

## Demo accounts

Every account below uses the password **`password123`**. Passwords are obviously fake/local-only —
never reuse them anywhere real.

| Email | Persona | Role(s) |
|---|---|---|
| `customer@havenpaw.test` | Marta Zielińska — private transport customer | `customer` (active) |
| `buyer@havenpaw.test` | Julia Kowalczyk — buyer looking for a puppy | `buyer` (active) |
| `breeder1@havenpaw.test` | Anna Kowalska — owns Cichy Las Kennel (approved) | `breeder` (active) |
| `breeder2@havenpaw.test` | Tomasz Nowak — owns Wolna Dolina (approved) | `breeder` (active) |
| `breeder3-pending@havenpaw.test` | Katarzyna Wiśniewska — Srebrna Rzeka, awaiting verification | `breeder` (pending) |
| `foundation1@havenpaw.test` | Aleksandra Nowicka — owns Fundacja Ratunek dla Psów (approved) | `foundation_member` (active) |
| `foundation2-pending@havenpaw.test` | Bartłomiej Sikora — Schronisko Nadzieja, awaiting verification | `shelter_member` (pending) |
| `ops@havenpaw.test` | Kasia Woźniak — transport operations | `operations` (active) |
| `driver@havenpaw.test` | Marek Dąbrowski — driver | `driver` (active) |
| `admin@havenpaw.test` | Havenpaw Admin | `admin` (active) |

A pending breeder/foundation account can sign in and use Havenpaw as a transport customer, but
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
   - `buyer@havenpaw.test` can submit a transport request at `/transport/request` and see it at
     `/dashboard/buyer/transport`;
   - `breeder3-pending@havenpaw.test` cannot see a live kennel profile (still pending);
   - `admin@havenpaw.test` can query `user_verifications`/`organisations` directly in Studio.
4. `npm run lint` and `"node" node_modules/typescript/bin/tsc --noEmit` (or just `npx tsc
   --noEmit`) should both be clean.
