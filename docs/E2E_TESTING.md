# Havenpaw — End-to-End Testing

Written 2026-07-22, alongside the first Playwright spec (`tests/e2e/auth.spec.ts`). This is the
only automated test coverage in the repo so far — see `docs/MVP_TEST_REPORT.md` §4 for how
everything else has been verified (manual `curl` calls against the local PostgREST API).

## What exists today

- `playwright.config.ts` — single `chromium` project, `testDir: ./tests/e2e`, `fullyParallel:
  false` and `workers: 1` (several specs sign in as the same shared seeded demo accounts, so
  parallel runs would race each other's session cookies against one dev server).
- `tests/e2e/auth.spec.ts` — three specs against real Supabase auth: a brand-new visitor can
  register and land on `/dashboard/buyer`, a seeded demo account (`buyer@havenpaw.test`) can sign
  in, and a wrong password is rejected with a real error rather than a silent redirect.

## Prerequisites

1. Local Supabase stack running with seed data: `npm run db:start` (see `docs/LOCAL_SETUP.md` for
   demo account credentials — the suite assumes `buyer@havenpaw.test` / `password123` exists).
2. Playwright's browser binaries installed: `npx playwright install chromium` (plus, on Linux,
   `npx playwright install-deps chromium` for OS-level shared libraries — see "Known sandbox gap"
   below if that command itself can't reach a package mirror).

## Running the suite

```bash
npm run test:e2e
```

This starts `npm run dev` automatically if `E2E_BASE_URL` isn't set (`webServer.reuseExistingServer:
true`, so an already-running `npm run dev` on port 8080 is reused instead of starting a second
one). To run against a server you're already driving manually, or a deployed preview, set
`E2E_BASE_URL` explicitly:

```bash
E2E_BASE_URL=http://127.0.0.1:8080 npm run test:e2e
```

Tests do **not** start, reset, or seed the database themselves — that would wipe demo accounts
other developers/tests rely on. Run `npm run db:reset` yourself first if you need a known-clean
seed state.

## Known sandbox gap (not a code defect)

In this project's development sandbox, Playwright's headless Chromium fails to launch
(`error while loading shared libraries: libglib-2.0.so.0`), and `npx playwright install-deps`
cannot fix it because the sandbox's `apt` sources include an unrelated broken third-party
repository (`cli.github.com`) that 404s and aborts the whole `apt-get update`. This blocks running
the suite *in this specific sandbox* — it is not something to work around by editing system package
sources as part of an application change. Verify on a normal Linux/CI machine (or this sandbox once
its package sources are fixed) before trusting a red/green result from here.
