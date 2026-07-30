# Isolated local Supabase environment for this hardening branch

Written before running any stateful test in this branch, to resolve the ambiguity the earlier pass
correctly flagged: the shared local Supabase instance (`project_id = "the-puppy-passport"`) showed
activity that couldn't be confidently attributed to this session versus Bot 1's own certification
work (Bot 1's own confirmed handoff — `BOT1_FINAL_A_TO_Z_HANDOFF.md` in its most recent audit clone,
timestamped 2026-07-29 20:57 — states it verifies "via... the shared local Supabase database's data
via documented, disclosed reset/replay/test sequences", i.e. Bot 1 genuinely does use that instance).
Rather than guess whether it's currently safe, this branch now runs its own, completely separate
stack.

## What changed

`supabase/config.toml` (committed in this branch only — never touches the main worktree's copy):

- `project_id`: `the-puppy-passport` → `the-puppy-passport-hardening`
- Every host-exposed port shifted +1000:
  - API (Kong): `54321` → `55321`
  - DB: `54322` → `55322`
  - DB shadow: `54320` → `55320`
  - DB pooler: `54329` → `55329`
  - Studio: `54323` → `55323`
  - Inbucket (local email testing): `54324` → `55324`
  - Analytics: `54327` → `55327`

Supabase CLI derives Docker container names from `project_id`, so this alone was enough to produce
fully distinct containers (`supabase_db_the-puppy-passport-hardening` etc.) — no manual container
naming needed.

## Verified isolation, empirically, not assumed

Ran `npm run db:start` in this worktree with both the shared instance and this new one live at the
same time. `docker ps` confirms **12 container pairs, one per service, zero name overlap and zero
port overlap**:

```
supabase_db_the-puppy-passport             0.0.0.0:54322->5432/tcp
supabase_db_the-puppy-passport-hardening   0.0.0.0:55322->5432/tcp
supabase_kong_the-puppy-passport           0.0.0.0:54321->8000/tcp
supabase_kong_the-puppy-passport-hardening 0.0.0.0:55321->8000/tcp
... (same pattern for studio, inbucket, analytics, auth, storage, realtime, rest, pg_meta,
     edge_runtime, vector)
```

The shared instance's own containers were confirmed still running, unmodified, throughout.

## Local-only credentials

All keys below are the well-known, publicly-documented Supabase local-dev demo defaults — not
secrets, not valid against any real project (same disclosure already made in
`tests/db/helpers.ts`). API URL `http://127.0.0.1:55321`, DB URL
`postgresql://postgres:postgres@127.0.0.1:55322/postgres`. Full key set from `supabase status`
output, all localhost-only, none committed to any `.env` file.

## Migration/seed state

`npm run db:preflight` against this worktree's 151 migrations: clean, no unsafe patterns. All 151
applied cleanly on `db:start` against the fresh isolated instance (see raw output — every
migration filename echoed with "Applying migration..." through to
`20260101014900_achievement_self_verification_lock.sql`, then `Seeding data from
supabase/seed.sql...`, then healthy container startup).

## Cleanup

`npm run db:stop` from this worktree stops only the `-hardening`-suffixed containers — verified by
project_id scoping, does not touch the shared instance's containers. Run before ending this
session (see `docs/POST_INTEGRATION_HARDENING_STATE.md` for the final stop confirmation).

## Why this file's config.toml diff is intentionally committed, not just a local override

Supabase CLI doesn't expose a `--project-id`/`--port` override flag in the installed version
(`2.109.1`) reliable enough to trust over actually changing the config it reads — and a
silently-uncommitted local edit would make this isolation invisible to anyone else picking up this
branch later, defeating the point. Committing it here, scoped to this hardening branch only (never
touching `main`'s own `supabase/config.toml`), makes the isolation a reproducible, documented
property of the branch itself.
