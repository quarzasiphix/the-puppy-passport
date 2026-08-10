# Anemalo

Anemalo is a dedicated European animal ecosystem — animal discovery/marketplace, breeder and
foundation profiles, community, adoption/handover, and (once a purchase or adoption is agreed)
professional animal transport. See `docs/PRODUCT_VISION.md` for what Anemalo is and isn't, and the
priority hierarchy behind product decisions.

## Stack

- [TanStack Start](https://tanstack.com/start) (React 19, SSR, file-based routing via
  `@tanstack/react-router`), built with Vite.
- [Supabase](https://supabase.com) (Postgres, RLS, Auth, Storage) — local-only today, see
  `docs/PRODUCTION_SETUP.md` for standing up a production project.
- Deployed as a Cloudflare Worker (`nitro` `cloudflare-module` preset).
- shadcn/Radix UI, Tailwind CSS.

## Getting started

```bash
git clone <this repo>
cd anemalo
npm install
cp .env.example .env
npm run db:start   # local Supabase via Docker — see docs/LOCAL_SETUP.md
npm run dev
```

Full setup, demo accounts, and troubleshooting: `docs/LOCAL_SETUP.md`.

## Useful commands

```bash
npm run dev              # start the dev server
npm run build             # production build
npm run lint               # eslint
npx tsc --noEmit            # typecheck
npm run test:db              # database/API test suite (needs local Supabase running)
npm run test:e2e              # Playwright end-to-end suite
npm run release:preflight      # typecheck + lint + build + migration/route sanity checks
```

## Where to look next

- `docs/PRODUCT_VISION.md` — product scope and priorities.
- `docs/DOMAIN_MODEL.md` — data model and entity relationships.
- `docs/LOCAL_SETUP.md` — local dev environment and demo logins.
- `docs/PRODUCTION_READINESS_REPORT.md` — current launch-readiness status and known gaps.
- `docs/DEPLOYMENT_CHECKLIST.md` — Cloudflare Worker build/deploy procedure.
- `CLAUDE.md` / `AGENTS.md` — engineering conventions for this repo.

## Status

Pre-launch. Core marketplace, transport, moderation, and messaging flows are built and tested
(see `docs/PRODUCTION_READINESS_REPORT.md`). No production Supabase project or Cloudflare
deployment exists yet, and commercial pricing/entitlements are not implemented.
