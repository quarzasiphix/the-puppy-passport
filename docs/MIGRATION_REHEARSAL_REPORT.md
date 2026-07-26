# Migration rehearsal report

Stage IR-13 (integration-readiness queue). A full clean-slate rehearsal of applying every
migration in `supabase/migrations/` to an empty database, seeding it, and verifying the resulting
schema/RLS/grants/types/build/tests — the same checklist a fresh environment (a new contributor's
machine, or eventually a first production push) would go through. Not a deploy; local Supabase
only, no remote project touched.

## Result: pass, with one real security gap found and fixed during the rehearsal itself

Rehearsing the process surfaced a genuine finding rather than just confirming a clean bill of
health — see "What the rehearsal found" below. The fix is included in this same stage
(`20260101012600_has_role_execute_lock.sql`), and every check in this report was re-run after it.

## Checklist

| Check | Result |
|---|---|
| Fresh `supabase db reset` (empty database → all migrations → seed) | Clean. 128 migration files, zero errors, ~50s. |
| Duplicate migration prefixes | None. `find supabase/migrations -maxdepth 1 -name '*.sql' \| sed -E 's#.*/([0-9]+)_.*#\1#' \| sort \| uniq -d` returns empty. |
| Seed data (`supabase/seed.sql`) | Applies cleanly after every migration, every rehearsal run this session. |
| RLS enabled on every `public` table | Verified directly via `pg_class.relrowsecurity` — zero tables in `public` have RLS disabled. |
| Every RLS-enabled table has at least one policy | Verified via `pg_policies` — zero tables are RLS-enabled with no policy (which would silently deny all non-superuser access). |
| `SECURITY DEFINER` functions have a pinned `search_path` | Verified via `pg_proc.proconfig` — all 76 `SECURITY DEFINER` functions in `public` have an explicit `search_path=...` entry. Re-verified after this stage's own new function (`is_active_driver()`) — still zero missing. |
| Storage buckets match the schema's own inserts | All 5 buckets present (`kennel-media` public; `transport-documents`, `transport-evidence`, `message-attachments`, `welfare-case-documents` private), matching their `insert into storage.buckets` statements. |
| Generated Supabase types (`npm run db:types`) match checked-in `src/lib/supabase/types.ts` | Regenerated and diffed against the pre-rehearsal checked-in file: the only difference is the new `is_active_driver` RPC this stage itself added — no undetected drift from any earlier stage. |
| `npx tsc --noEmit` | Clean. |
| `npm run build` | Clean (`vite build` + Cloudflare Worker `nitro` output). |
| `npm run test:db` (full suite) | 816/816, run three times consecutively with no reset between runs 2 and 3 (this stage changes `SECURITY DEFINER` grants and an RLS policy, so the standing third-run rule for security/trigger-touching stages applies). |

## What the rehearsal found

Auditing every `SECURITY DEFINER` function's grants (not just its `search_path`, which was already
clean — see the table above) found `has_role(p_user_id uuid, p_role platform_role)` had never been
explicitly revoked from `PUBLIC`. Every other role-check helper in this schema
(`is_admin()`, `is_moderator()`, `owns_org()`, `is_org_member()`, ...) either takes no argument or
a resource id, and only ever answers "does the calling user (`auth.uid()`) have this relationship" —
`has_role()` uniquely accepts an arbitrary `p_user_id`. Since every new PostgreSQL function is
`PUBLIC`-executable by default unless explicitly revoked, this meant any caller — including an
unauthenticated one, via PostgREST's automatically-exposed `/rpc/has_role` endpoint — could pass in
any real profile id and learn whether that specific person currently holds any given platform role
(`admin`, `moderator`, `operations`, `driver`, `breeder`, `foundation_member`, ...): a direct
role-membership enumeration oracle over arbitrary users, useful for identifying and targeting staff
accounts. This had gone unnoticed through every earlier grant-hygiene pass this session (Stage BR
and others) because those passes focused on the actively-used RPC surface, not on this internal
helper.

**The first fix attempt was itself caught wrong by the rehearsal's own test-suite step** — a real
demonstration of why "run the full suite before committing" matters even for a change that looks
obviously safe. The first draft assumed every real call site routes through another `SECURITY
DEFINER` wrapper function (which executes under that wrapper's own owner privileges, so a bare
`PUBLIC` revoke on `has_role()` would be invisible to it) and that `has_role()` was never called
directly from an RLS policy body. Running `npm run test:db` immediately surfaced two real failures:
two policies added in `20260101009800_driver_id_checks_active_role.sql` (`transport_documents`'
"assigned drivers view documents for their active jobs" and the matching `storage.objects` policy
for the `transport-documents` bucket) call `public.has_role(auth.uid(), 'driver')` **directly**
inline in their `using()` clause, not through a wrapper. RLS policy bodies evaluate as the real
querying role (`authenticated`), never under any `SECURITY DEFINER` elevation, so revoking `PUBLIC`
alone broke both real driver-access paths.

**Real, verified fix**: added `is_active_driver()` — a no-argument `SECURITY DEFINER` wrapper, the
exact same shape as `is_admin()`/`is_moderator()`/`is_ops_staff()`, only ever answering "is the
calling user currently an active driver" — and pointed both policies at it instead of calling
`has_role()` directly. `has_role(uuid, platform_role)` itself stays fully revoked from `PUBLIC`;
nothing legitimate ever needs to call it with anything other than `auth.uid()` again. New
`tests/db/has-role-execute-lock.test.ts` proves: an anonymous caller cannot call `has_role`
directly; an ordinary authenticated caller cannot use it to probe another real user's role either
(not just narrowed to `authenticated`, fully closed); `is_admin()`/`is_active_driver()` (the
internal callers) still work correctly for both a real holder and a non-holder of the role. The
pre-existing `tests/db/access-control.test.ts` "assigned-driver document access" test — the one
that caught the first-draft regression — is unchanged and passing, proving the real fix restores
the exact behaviour that broke.

## No production deploy

This rehearsal is entirely local (`supabase db reset` against the local Docker stack). No remote
Supabase project exists for this app yet (confirmed current as of this stage — see
`docs/PRODUCTION_SETUP.md`), and nothing here was pushed or deployed.
