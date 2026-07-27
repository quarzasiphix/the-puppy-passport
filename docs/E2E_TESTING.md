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

## Update 2026-07-27: the Chromium launch gap is resolved; a different, real failure was found

The `libglib-2.0.so.0`/broken-`apt`-mirror launch gap described below (as of 2026-07-22) no longer
reproduces in this sandbox — `npx playwright test tests/e2e/auth.spec.ts` now launches headless
Chromium and drives real browser interactions against a real `npm run dev` server and the real
local Supabase auth stack.

All 3 specs in `auth.spec.ts` now fail, but not on a launch/environment problem — on what looks
like a genuine SSR-hydration race in `src/routes/_public.signin.tsx`/`_public.signup.tsx`: the
failing sign-in spec's URL after clicking "Sign in" was
`http://127.0.0.1:8080/signin?email=buyer%40havenpaw.test&password=password123` — a plain HTML
form GET submission with credentials in the query string, not the expected client-side
`form.handleSubmit(onSubmit)` (react-hook-form) call. That only happens if the browser's native
form submission fires because React hasn't finished attaching its `onSubmit` handler yet when
Playwright's `.click()` lands — a real hydration-timing race, worse under this sandbox's
constrained CPU than it would likely be on a normal dev machine, but not something to dismiss as
sandbox-only without checking on a normal machine too.

**Not fixed here**: this whole multi-hour session operated under an explicit "backend-only, Bot 2
is the sole backend writer" mandate — investigating and documenting this is in scope, but changing
frontend hydration/submit-handling behavior is not, without separate explicit authorization. Flag
this to whoever owns frontend work next; a first thing to check is whether TanStack Start's
`extractedFn`/hydration is genuinely slower than the button's clickable state, and whether the
sign-in/sign-up forms should disable the submit button (or otherwise block native fallback
submission) until hydration completes — matching the existing `disabled={form.formState.isSubmitting}`
pattern already on this exact button, just gated on hydration-readiness instead.

## Known sandbox gap (not a code defect) — historical, as of 2026-07-22, superseded above

In this project's development sandbox, Playwright's headless Chromium fails to launch
(`error while loading shared libraries: libglib-2.0.so.0`), and `npx playwright install-deps`
cannot fix it because the sandbox's `apt` sources include an unrelated broken third-party
repository (`cli.github.com`) that 404s and aborts the whole `apt-get update`. This blocks running
the suite *in this specific sandbox* — it is not something to work around by editing system package
sources as part of an application change. Verify on a normal Linux/CI machine (or this sandbox once
its package sources are fixed) before trusting a red/green result from here.
