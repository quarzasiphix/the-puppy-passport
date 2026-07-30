# Post-integration hardening — state

**Hardening worktree**: `/p/the-puppy-passport-post-integration-hardening`
**Hardening branch**: `hardening/post-integration-qa`
**Base (integration HEAD at branch creation)**: `9c516618a22fe38df0eb9f0701e3dfe21d4cb043`

**Backend main HEAD (at time of branching)**: `54846e0036c117eec5078cfa41ffb95dc6e803bf` — verified
clean and unchanged.

**Frozen frontend HEAD (at time of branching)**: `727d551b8306cf6bd5ce8a2b542ac118b1c4f417`
(`ux-marketplace-frontend-pass`, worktree
`/p/the-puppy-passport-ux/.claude/worktrees/marketplace-ux-pass`) — verified clean and unchanged.

**Completed integration worktree** (`/p/the-puppy-passport-integration`, branch
`integration/frontend-backend-rc`) — verified clean, no merge/cherry-pick/rebase in progress, at
the time this hardening branch was cut. **Currently under independent Bot 1 certification —
never modified from this branch.**

## Isolation rules for this branch

- Never modify `/p/the-puppy-passport` (backend main).
- Never modify `/p/the-puppy-passport-ux/.claude/worktrees/marketplace-ux-pass` (frozen frontend).
- Never modify `/p/the-puppy-passport-integration` (the snapshot Bot 1 is certifying).
- All implementation happens only in this worktree, on `hardening/post-integration-qa`.
- No push, no deploy, no merge back into any of the above branches from this session.

## Shared local Supabase constraint

Bot 1 may be actively using the local Supabase instance for destructive/stateful certification of
the integration snapshot. Until Bot 1's work is confirmed finished:

- no `db:reset`, no destructive/stateful DB test runs, no stateful browser journeys that mutate
  shared DB state from this branch;
- static analysis, test-writing (without running destructive phases), TypeScript, lint, build,
  route generation, and read-only/non-mutating browser checks are safe to run.

Full isolated DB verification for this branch is deferred to its own phase, using a distinct local
Supabase project/ports once safe to do so — never pointed at Bot 1's certification database.

## Isolated Supabase environment (established mid-pass)

This branch runs its own local Supabase stack: `project_id = "the-puppy-passport-hardening"`,
every port shifted +1000 (API 55321, DB 55322, Studio 55323, Inbucket 55324, analytics 55327,
pooler 55329, shadow 55320). Verified running alongside the shared instance with zero container-
name/port collision. `supabase stop`/`start` alone does not recreate the Docker volume — use
`docker volume rm supabase_db_the-puppy-passport-hardening supabase_edge_runtime_the-puppy-passport-hardening
supabase_storage_the-puppy-passport-hardening` before `db:start` for a genuinely fresh database.
Full detail: `docs/HARDENING_ISOLATED_DB_ENVIRONMENT.md`,
`docs/HARDENING_ISOLATED_DB_VERIFICATION.md`.

## Status: complete

All phases done. Final hardening HEAD: `5344687` (27 commits on `e925089`..HEAD). See
`docs/POST_INTEGRATION_HARDENING_REPORT.md` for the complete final report — isolated DB (1062/1062
× 3 clean), Playwright E2E (34/34 on desktop + mobile), accessibility/i18n/query-bounding fixes,
lint 0/14, and a real cross-worktree isolation bug found and fixed in this repo's own DB test
tooling.

Stopped cleanly: dev server and this branch's isolated Supabase containers stopped, working tree
clean, `main`/frozen-frontend/integration snapshots confirmed untouched, nothing pushed or
deployed.
