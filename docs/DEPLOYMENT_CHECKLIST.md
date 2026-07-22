# Havenpaw — Cloudflare Deployment Checklist

Written 2026-07-17. Verified by actually running `npm run build` and inspecting the real output —
nothing here is guessed. No production deploy has happened; this is the checklist to follow when
one is explicitly approved.

## 1. How the build/deploy mechanism actually works (confirmed)

- `npm run build` runs `vite build`, which (via `@lovable.dev/vite-tanstack-config`'s bundled nitro
  step, preset `cloudflare-module`) produces `.output/` — already gitignored, never commit it.
- Nitro **auto-generates** `.output/server/wrangler.json` on every build: compatibility date set to
  the build date, `nodejs_compat` flag, static-asset binding pointing at `.output/public`, and an
  auto-derived worker name (currently `quarzasiphix-the-puppy-passport`, derived from repo/user —
  override with `--name` at deploy time if a different name is wanted).
- Deploy command (confirmed working against the local build): `npx nitro deploy --prebuilt` or,
  equivalently, `npx wrangler --cwd .output/server deploy`.
- **No hand-written root `wrangler.toml` is required** for a basic deploy — the generated config is
  complete and correct. Don't add one speculatively; it would need to be kept in sync with nitro's
  generated version and risks drifting. Only add one if a specific need arises that nitro's
  generated config can't express (see custom domains below).

## 2. Staging vs. production — no runtime env switching, so use two builds

As covered in `docs/PRODUCTION_SETUP.md` §1, `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are
baked in at build time. There is no single deployed Worker that can serve both staging and
production traffic against different Supabase projects. Practical flow:

```bash
# Staging
cp .env.staging .env && npm run build
npx wrangler --cwd .output/server deploy --name havenpaw-staging

# Production (separate step, explicit)
cp .env.production .env && npm run build
npx wrangler --cwd .output/server deploy --name havenpaw
```

Never deploy production automatically on every commit — require the explicit `--name havenpaw`
production step as a deliberate, separate action (see also `docs/PRODUCTION_READINESS_REPORT.md`,
which flags "no CI pipeline" as a launch blocker; when CI is added, gate the production deploy
step behind manual approval, auto-deploy staging only).

## 3. Custom domain

Two supported paths — pick one when a real domain exists:
- **Cloudflare dashboard** (Workers & Pages → the deployed worker → Triggers → Custom Domains) —
  simplest, survives redeploys since it's configured server-side, not in this repo.
- **`routes` in a hand-written `wrangler.toml`** — only needed if domain config must be
  version-controlled; if added, keep it minimal (just `routes`) so it doesn't fight nitro's
  auto-generated config for the fields nitro already owns (`main`, `compatibility_date`, `assets`).

## 4. Secrets and bindings

Confirmed by reading `src/server.ts` and both Supabase client files: **this app has no Workers
runtime secrets today.** The only Supabase credentials used (`VITE_SUPABASE_URL`/
`VITE_SUPABASE_ANON_KEY`) are Vite build-time values, and the anon key is designed to be
public-safe (RLS is the actual access boundary — verified extensively, see
`MVP_TEST_REPORT.md` §3). No `service_role` key or other elevated credential exists anywhere in
the runtime code. If a future feature needs a true server-side secret (e.g. an SMS/email provider
API key called from an Edge Function rather than the Worker itself), use
`supabase secrets set` for Edge Functions or `wrangler secret put` for a Worker-side one — neither
is needed yet.

## 5. Auth callback URLs

Set on the **Supabase project side** (dashboard → Authentication → URL Configuration), not in this
repo — see `docs/PRODUCTION_SETUP.md` §7. Must point at the real production domain before OAuth or
email-confirmation redirects will work.

## 6. Asset and image handling

- Static assets under `.output/public` are served via the Worker's `ASSETS` binding; nitro already
  emits `.output/public/_headers` with a `public, max-age=31536000, immutable` cache rule for
  `/assets/*` (hashed filenames — safe to cache forever). No change needed.
- No image-optimization/transformation pipeline exists yet (no Cloudflare Images, no on-the-fly
  resizing) — all animal/listing photos are served as uploaded. Out of scope for this deployment
  pass; flag as a future performance item if photo sizes become a problem.

## 7. Cache rules

Beyond the asset `_headers` rule above, no page-level cache rules exist — SSR responses are not
cached (correct default, since most pages are personalized/dashboard content or need fresh
marketplace data). Don't add page caching without deliberately auditing which routes are safe to
cache (nothing public-marketplace-only should be assumed safe to cache without checking for
per-user state first).

## 8. Security headers

Added this pass (`src/server.ts`, `withSecurityHeaders`): `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a minimal
`Permissions-Policy`. Applied to every response — normal pages, the h3-swallowed-error
normalization path, and the catch-all 500 fallback alike, since all three flow through the same
wrapper.

**Deliberately not added**: a Content-Security-Policy. A wrong CSP fails silently (blocks a script
or style with no visible error to the developer, just a broken page for the user) and needs
per-page verification against a real running build — not something to guess blind. Do this as a
dedicated follow-up: build a real CSP from the actual script/style/connect sources this app uses
(Supabase URL, any font/analytics origins), then click through every major flow against a real
deploy before trusting it.

## 9. Error pages

Already handled, not rebuilt this pass — `src/lib/error-capture.ts` + `src/lib/error-page.ts`
provide a real branded fallback for both a caught `fetch` exception and an h3-swallowed SSR error
(the `normalizeCatastrophicSsrResponse` check in `src/server.ts`). Cloudflare's own default error
page is never shown for application errors. (Route-level React error boundaries are a separate,
smaller gap — only one route currently defines `errorComponent`; see
`docs/PRODUCTION_READINESS_REPORT.md`.)

## 10. Pre-deploy verification (every environment, every time)

1. `npm run build` — must complete with zero errors.
2. Serve the real built worker and hit it — confirmed working procedure (wrangler 4.112.0):
   ```bash
   rm -f .wrangler/deploy/config.json   # nitro also emits this at repo root; wrangler refuses to
                                         # start if both it and .output/server/wrangler.json exist
                                         # ("Found both a user configuration file... and a deploy
                                         # configuration file... not clear which should be used")
   cd .output/server && npx wrangler dev --port 8799
   ```
   Then hit `/`, one marketplace page (`/find-a-dog`), `/signin`, and an unknown path (expect 404)
   — confirmed this pass: all return correct status codes, real Supabase-backed content on
   `/find-a-dog`, and the security headers from §8 present on every response including the 404.
   (`npx wrangler --cwd .output/server dev` from the repo root hits the same config conflict —
   `cd` into the directory first, or delete the stray root-level `.wrangler/deploy/config.json`
   before using `--cwd`.)
3. Confirm the `.env`/`.env.staging`/`.env.production` file used for the build points at the
   intended Supabase project — the single easiest mistake in this setup (per §2) is building with
   the wrong `.env` and deploying real user traffic against staging data, or vice versa.
