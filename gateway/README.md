# anemalo-gateway

The public API Worker that will serve **`api.anemalo.com`** — a thin, org-scoped, read-mostly
gateway in front of the ONE shared Anemalo Supabase project (`pgzvkkybqrhxedjoyjzy`).

It generalises Gryfin's single `get-site-content` edge function so every breeder public site can
be a template app with **zero `@supabase/supabase-js` dependency of its own** (mirrors
`/p/grif/p`'s posture). Full design + rationale:
[`../docs/API_GATEWAY_AND_MULTI_TENANT_BREEDERS.md`](../docs/API_GATEWAY_AND_MULTI_TENANT_BREEDERS.md).

## Status: NOT DEPLOYED

Nothing here is live. No `wrangler deploy` has been run, no `api.anemalo.com` custom domain is
bound, no Supabase migration has been applied. This is a boot-tested skeleton only.

## Trust boundary

**Anon key only.** RLS is the access-control boundary, exactly as in the main app
(`../docs/DEPLOYMENT_CHECKLIST.md` §4). Every table this Worker reads has an `anon`-role `SELECT`
policy that already restricts rows to *published + approved + public* content — verified against
the live project 2026-09-10. The Worker holds **no service-role key** and must never be given one
without a per-endpoint justification recorded in the plan doc.

## Endpoints (v1)

| Method + path | What it does | State |
|---|---|---|
| `GET /health` | Liveness + a real Supabase reachability probe (`head` count on `organisation_site_configurations`). | Working |
| `GET /v1/site-content?org=<slug\|id>` | One aggregated anon-safe JSON payload for an org's public site: the `organisations` row, `organisation_site_configurations`, `public_dogs`, published `litters`, published `animals` (puppies), their `animal_images`, and `achievements`. `testimonials`/`posts` are returned as `notImplemented` (no Anemalo table yet). 404 if the org is not publicly visible (unapproved / suspended / unknown are indistinguishable on purpose). | Working |
| `GET /v1/resolve-domain?host=<hostname>` | Maps a `Host` header to an org slug for the breeder-site fork. Calls the `resolve_org_by_hostname(text)` SECURITY DEFINER RPC. | **Honest 501** until that RPC is created (roadmap P6) — the handler is real, the DB object is not. |
| `POST /v1/enquiry` | Lead capture. Validates `{ org, name, email, message, phone?, interest? }`. | **Honest 501** — Anemalo has no per-org enquiry table yet (see plan §2). No fake success (`../CLAUDE.md` rule 12). |

CORS: `access-control-allow-origin: *` for every response. Acceptable for a public read API over
already-public data. `Env.ALLOWED_ORIGINS` (comma-separated) switches to a per-origin allowlist +
`Vary: Origin` — intended to be fed from `organisation_domains` in roadmap P6.

## Run locally

```bash
npm install
npm run typecheck        # tsc --noEmit
npx wrangler dev --port 8811 --local
curl "http://127.0.0.1:8811/health"
curl "http://127.0.0.1:8811/v1/site-content?org=cichy-las"
```

If `wrangler dev`/`deploy` complains *"Found both a user configuration file … and a deploy
configuration file"*, a stale `../.wrangler/deploy/config.json` from the main app's last build is
shadowing this dir. Move it aside for the run (it regenerates on the next `npm run build` in the
main repo) — same gotcha documented in `../docs/DEPLOYMENT_CHECKLIST.md` §10.

## Deploy (later, deliberately)

```bash
npm run deploy:dry       # wrangler deploy --dry-run  (build check only)
npm run deploy           # wrangler deploy            # DO NOT run until the checklist below is done
```

Before the first real deploy:

1. **Custom domain** — add `api.anemalo.com` (Workers & Pages → `anemalo-gateway` → Settings →
   Domains), or uncomment the `[[routes]]` block in `wrangler.toml`.
2. **CORS review** — confirm `*` is acceptable, or set `ALLOWED_ORIGINS`.
3. **Rate limiting** — `enforce_rate_limit()` in Postgres is a no-op for anonymous callers, so
   throttling must be added here (Cloudflare Rate Limiting binding / KV counter / Durable Object)
   before this is exposed publicly. See plan doc §2.
4. **Supabase Auth redirect / allowed origins** — no auth flows through this Worker today, but if
   that changes, update the Supabase project's URL config.

## Layout

```
src/
  index.ts          fetch entry + router; /health, /v1/resolve-domain, /v1/enquiry handlers
  site-content.ts   the /v1/site-content aggregation + anon-safe row shapes
  lib.ts            Env, anon Supabase client factory, CORS + JSON helpers
```
