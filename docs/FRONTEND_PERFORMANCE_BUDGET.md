# Frontend performance budget

Reasonable development budgets, checked against real `npm run build` output on this branch (not
aspirational numbers).

## Current build output (representative, from this session's final build)

- Largest route chunk: `_public.transport.request-*.mjs` (~56 kB gzipped ~11 kB) — a long
  multi-step form, expected to be the heaviest single route.
- Second largest: `_public.puppies.$id-*.mjs` (~50 kB gzipped ~10 kB) — detail page with gallery,
  tabs, application dialog, transport estimate calculator.
- Largest shared chunk: `@tanstack/react-router` (~658 kB unminified, ~139 kB gzipped) — the
  framework itself, not something to budget against.
- No single public-facing route chunk exceeds ~60 kB gzipped — reasonable for a content-heavy
  marketplace app, no action needed.

## Budgets (targets for future work, not enforced by tooling)

| Metric | Budget | Current status |
|---|---|---|
| Public route chunk (gzipped) | < 80 kB | All under, largest ~11 kB |
| Cards rendered per page (no pagination yet) | soft target < 60 | `/find-a-dog`, `/breeders`, `/foundations`, `/adoptions` all render their full result set client-side — fine at today's seed-data volume, flagged as a real scaling gap in `docs/FRONTEND_BACKEND_GAPS.md` ("No pagination on public list pages") |
| Duplicate network requests per page load | 0 | N+1 patterns for breeder/foundation/litter counts were found and fixed earlier this branch (batched via `.in()` + Map bucketing) |
| Layout shift from images | 0 | Cards/galleries use fixed `aspect-*` container classes, not intrinsic-size-dependent layout |

## Safe improvements applied

- Below-the-fold images (`transportImg` on homepage, adoption/puppy gallery thumbnails) use
  `loading="lazy"`; the above-the-fold hero image correctly does not (verified, not changed, in an
  earlier phase).
- N+1 query batching for breeder/foundation directory counts and litter counts (earlier this
  branch).
- `<AnimalImage>` (this session) doesn't add a network request — it's a client-side `onError`
  fallback, zero performance cost.

## Explicitly not done (no evidence of a real problem)

- No route-level code-splitting changes — TanStack Start's file-based routing already produces
  one chunk per route by default; nothing observed in the build output suggested a route was pulling
  in unnecessary heavy code from another route.
- No image CDN/resizing service added — out of scope (would require a backend/infrastructure
  decision, not a frontend-only change) and no evidence of oversized images being served today (seed
  data uses local bundled placeholder assets).
- No virtualization added to any list — none of today's lists are long enough (tens of items, not
  thousands) to justify the complexity.
