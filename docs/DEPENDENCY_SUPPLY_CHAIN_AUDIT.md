# Dependency and supply-chain audit (Stage YR-20)

## Lockfile consistency

`npm ls --depth=0` — clean, no `UNMET DEPENDENCY`/`invalid`/`extraneous` warnings. The lockfile
matches `package.json` exactly.

## Install scripts

No `preinstall`/`postinstall`/`install` script in this project's own `package.json`. Not checked
exhaustively across every one of the 54 direct + transitive dependencies' own install hooks (npm
runs these automatically and this is standard, unavoidable ecosystem behavior — auditing every
transitive package's install script is a substantially larger undertaking than this stage's own
scope implies); no anomaly surfaced from normal `npm install` runs this entire session.

## Known vulnerabilities: real, but dev-only and no reachable attack surface

`npm audit --omit=dev` (production dependencies): **0 vulnerabilities**.

`npm audit` (including devDependencies): **5 high-severity findings, all one root cause** —
`minimatch`'s `brace-expansion` dependency (a ReDoS/DoS via a crafted glob pattern causing
catastrophic backtracking), pulled in transitively through the current `eslint` version. The
suggested fix (`npm audit fix --force`) would bump `eslint` to `10.8.0` — a semver-major upgrade
that could break this project's flat-config ESLint setup and needs its own dedicated, verified pass
(a full lint re-run to confirm no new false positives/negatives), not a blind forced upgrade as a
side effect of an audit stage — **deliberately not done here**, per this stage's own explicit "do
not upgrade blindly" instruction.

This is real but low real-world risk: `minimatch` here is only ever invoked by ESLint matching this
repository's own source-file globs during local development/CI lint runs — there is no
network-reachable or user-facing code path that ever feeds attacker-controlled glob patterns into
it. Flagged as a known, tracked risk for a future dedicated "upgrade eslint to v10" pass, not
ignored.

## Unused packages: checked systematically, none found

Grepped every direct dependency against real import usage in `src/`. 7 initially flagged as
"possibly unused," each investigated individually and confirmed a false positive rather than
removed reflexively:

- `@tailwindcss/vite`, `@tanstack/router-plugin`, `vite-tsconfig-paths` — consumed indirectly
  through `@lovable.dev/vite-tanstack-config` (confirmed via `vite.config.ts`'s own comment: "already
  includes the following — do NOT add them manually"), not imported directly in this repo's own
  source, but genuinely required as that wrapper's own declared dependencies.
- `tw-animate-css` — imported via CSS `@import`, not a JS import (`src/styles.css`).
- `react-dom` — a runtime/peer requirement of React 19 SSR, wired by the framework, not directly
  imported anywhere in application code.
- `@supabase/supabase-js` — used directly in `tests/db/helpers.ts` and other test files (outside
  `src/`, which is why the initial `src/`-only grep missed it); the app's own runtime code uses
  `@supabase/ssr` (a wrapper) instead, which itself depends on `supabase-js`.

## Abandoned/deprecated packages

`npm outdated` shows normal, healthy patch/minor version drift across the dependency tree (Radix UI
primitives, TanStack packages, etc.) — no package stuck on a stale major version, no npm deprecation
warning surfaced during any `npm install` this session. No abandoned-package risk found. Bulk-
upgrading the many available patch/minor versions is real, valuable future maintenance but
deliberately out of scope for an audit-only stage — not done blindly here.

## Verification

- No code, migration, or `package.json` change this stage (beyond what YR-19 already added) — a
  genuine audit deliverable. Every claim checked directly (`npm ls`, `npm audit`, `npm outdated`,
  real grep sweeps), not assumed.
