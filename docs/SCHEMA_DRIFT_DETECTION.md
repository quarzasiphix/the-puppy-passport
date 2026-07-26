# Schema/migration drift detection (Stage XR-20)

## The gap

Two related, narrower checks already existed before this stage:

- `scripts/migration-preflight.mjs` (`npm run db:preflight`) — a static text scan over migration
  *files*, no live database involved. Catches unsafe patterns (missing RLS, unsafe NOT NULL, etc.)
  but has no idea what the real database currently looks like.
- `scripts/contract-drift-check.mjs` (`npm run db:contract-check`, Stage XR-18) — live-DB-dependent,
  but scoped to exactly one surface: table grants and RPC signatures.

Neither one catches the case this stage names: the live database and the committed migration files
disagree, full stop — a real table, column, constraint, or index that exists in one but not the
other. That can happen from a manual `ALTER TABLE` run directly against the database, a migration
that was edited or reordered after being applied elsewhere, or any other out-of-band change. Since
`supabase/migrations/*.sql` is supposed to be the single source of truth for schema state (per
`CLAUDE.md`'s "never hand-edit... never rewrite committed migrations" rule), silent drift from that
source of truth is exactly the failure mode a rule like that exists to prevent, and nothing in this
repo was actually checking for it.

## What was built

`supabase db diff --local` already performs the real comparison: it builds a disposable shadow
database from the committed migration files and diffs it against the actual local database,
returning a JSON object with a `diff` field. Confirmed by reading the CLI's own `--help` output and
testing it directly — no new diffing logic needed, this stage just needed a way to use it as a real
pass/fail check.

`scripts/schema-drift-check.mjs` (`npm run db:schema-drift`) is a thin wrapper: run the diff, parse
the JSON summary line, and turn a nonempty `diff` into a real `process.exit(1)` with the actual
drift SQL printed — the CLI itself exits 0 unconditionally, which makes it useless as a written
check on its own.

## Verification: proved it actually detects drift, not just that it runs

The same discipline Stage XR-18 used for its own drift scanner, applied here:

1. Ran `npm run db:schema-drift` against the untouched repository — reported "No schema drift" and
   exited 0.
2. Created a real table directly via `psql` inside the running container, deliberately bypassing
   migrations entirely (`create table public._xr20_drift_test (id int);`).
3. Ran `npm run db:schema-drift` again — correctly reported the drift with the exact `CREATE TABLE`
   and `GRANT` statements needed to reconcile it, and exited 1.
4. Dropped the test table, ran a third time — back to "No schema drift", exit 0.

## Scope note

Like `contract-drift-check.mjs`, this needs a live database and is not wired into a fast no-Docker
CI job — run manually or in the same job that already runs `test:db`. `db:contract-check` and
`db:schema-drift` are complementary, not redundant: the former is a curated, human-reviewed
baseline of the *public API surface* (grants/RPC signatures) that's meant to flag deliberate
contract changes for review; this one is a full structural diff meant to catch *any* drift at all,
deliberate or not, since there is no "committed baseline" to review against here — the migration
files themselves are the baseline.

## Verification

- `npx tsc --noEmit` — clean.
- `npx eslint scripts/schema-drift-check.mjs` — clean.
- Live-tested against both a clean state and injected real drift (above) — correct in both cases.
- `npm run build` and `npm run test:db` — unaffected (no app/schema code changed, no migration this
  stage).
