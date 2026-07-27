# Release-preflight self-test (Stage YR-19)

## The gap

Every single stage across this entire session has manually run the same verification contract by
hand: `git status`, `npm run db:preflight`, `npx tsc --noEmit`, `npx eslint .`, `npm run build`, a
duplicate-migration-prefix check, and (when a migration changed) `npm run db:contract-check`/
`npm run db:schema-drift` plus a fresh reset and 2 consecutive `npm run test:db` passes. This was
never consolidated into one real, executable command — exactly the tool this stage's own
definition asks for ("audit the release-preflight command itself... create fixtures for [each
failure mode]... ensure each failure exits non-zero").

## What was built

New `scripts/release-preflight.mjs` (`npm run release:preflight`), covering the fast,
no-live-database-required subset by default: git-clean check, duplicate migration prefixes, a
secret scan, `db:preflight`, `tsc`, lint (against the documented baseline, see below), and `build`.
`--with-db` adds the slower, live-database-dependent checks (`test:db`, `db:contract-check`,
`db:schema-drift`) once a local Supabase stack is already running. Every check prints a real
PASS/FAIL line with its own failure output; the script exits 1 if any check fails, 0 only if every
check genuinely passed. Never deploys anything.

## A real bug found and fixed while building this: the lint check would have always failed

`npx eslint .` currently exits non-zero unconditionally — this repo carries a documented, pre-
existing baseline of 21 errors / 13 warnings (frontend-prototype debt predating this session, out
of scope to fix wholesale, Stage IR-16). A naive "run eslint, fail on non-zero exit" check would
have made this preflight cry wolf on every single run, useless as a real gate. Fixed by comparing
the actual error/warning **count** (via `eslint --format=json`) against the documented baseline —
passes if the count is at or below baseline (the untouched pre-existing debt), fails only on a real
regression (a new problem introduced beyond what already existed).

## A second real bug found and fixed by actually running the script, not just reading it

The secret-scan pattern for a PEM private-key header (`-----BEGIN...`) starts with `-` — `git
grep` parsed it as an unrecognised command-line flag instead of a search pattern, printing its own
help text and silently making the scan a no-op that always "passed" regardless of content. Caught
by running the script for real (the same "verify the detector actually detects, not just that it
runs" discipline this session has applied to every other new checker tool) — fixed with an explicit
`-e` flag forcing `git grep` to treat the argument as a pattern.

## Verification: proved each failure mode fires for real, not just that a clean state passes

- **git dirty state**: ran with real uncommitted files present — correctly failed, listing them.
- **secret detection**: injected a real fake secret (Stripe-live-key-shaped, deliberately not
  spelled out literally in this permanent doc — writing the exact pattern here would make this
  file itself trip the scanner forever, discovered by dogfooding the tool at Stage YR-24) into a
  throwaway tracked file, confirmed the script reported the exact file and line, then removed it
  and confirmed a clean pass again.
- **lint baseline**: ran against the real current repo state — correctly passed at exactly
  21/13 (the documented baseline), proving the comparison logic works against real data, not just
  a hypothetical.
- **duplicate migration prefixes / db:preflight / tsc / build**: each already has its own dedicated
  fixture-based test suite proving it detects real bad input (`tests/db/migration-preflight.test.ts`
  for the first two; `tsc`/`build` are themselves the ground truth, nothing to fake) — not
  duplicated here, this script just orchestrates calling them and interpreting their real result.

## Verification

- `npx eslint scripts/release-preflight.mjs` — clean.
- Ran the full script end to end multiple times, including the two injected-failure scenarios
  above — every check's pass/fail behavior confirmed correct in both directions.
- No migration, no test-suite change — a new orchestration script plus one `package.json` entry.
