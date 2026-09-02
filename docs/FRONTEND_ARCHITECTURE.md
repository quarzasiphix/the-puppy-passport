# Frontend architecture

Status: **structural migration complete.** Every component and data module moved from the flat
`src/components` / `src/lib/queries` prototype layout into the domain-oriented structure below;
`tsc`, `eslint`, unit tests and `vite build` all pass. `docs/FILE_MIGRATION_MAP.md` has the
per-file record and the two pieces of real follow-up work (splitting `breeder.ts`/`foundation.ts`
by concern, converting the dialog-wizard components to dedicated pages).

## Why

The prototype dumped every feature component into `src/components` and every data function into
`src/lib/queries`. As Anemalo grows (public pedigrees, reservations + Stripe payments, richer
messaging, verification, transport, moderation) that flat layout stops scaling: unclear
ownership, giant files, business logic living in presentational components, raw status-string
comparisons everywhere, and route modules being imported as if they were libraries.

## Layout

```
src/
  app/                     framework wiring — router, providers, layouts, route-path constants,
                           navigation config. No business logic.
  domains/<domain>/        one folder per business domain. Owns its own:
    components/               domain-specific components
    pages/                    page-level views rendered by route shells
    hooks/                    domain-specific hooks
    services/                 data access (Supabase queries / RPC wrappers) — the repository layer
    schemas/                  zod schemas for this domain's forms and boundaries
    status.ts                centralized, typed status vocabularies + transition rules
    types.ts                 domain types / view models
    index.ts                 the domain's PUBLIC API — the only thing other code may import
  shared/                  truly generic primitives used across domains:
    ui/                      design-system components (shadcn) + generic layout primitives
    forms/ hooks/ lib/ validation/ utilities/ types/
  routes/                  TanStack Router file-based routes, grouped in folders by workspace
                           (_public/, dashboard/breeder/, dashboard/buyer/, …). Folders ≡ dots in
                           TanStack's file-based router — URLs are unchanged. THIN SHELLS (see below).
  lib/supabase/            generated types + browser/server clients (unchanged location).
  assets/
```

Domains (present or planned): `identity`, `breeders`, `animals`, `pedigrees`, `marketplace`,
`reservations`, `payments`, `messaging`, `transport`, `trust`, `operations`, plus small
`community` / `fundraising`.

## Rules (enforced by `eslint.config.js`)

1. **Import a domain only through its barrel.** `import { X } from "@/domains/reservations"` —
   never `@/domains/reservations/services/...`. Files *inside* a domain use relative imports for
   their own siblings.
2. **`shared/` never imports a domain or `app/`.** It is the dependency floor.
3. **Route modules are not import targets.** `src/routes/*.tsx` files are shells:
   `createFileRoute` + `beforeLoad` guard + render one page component from a domain. No queries,
   no business JSX. Shared code goes to `@/shared/*` or the owning domain. (The router is
   file-based and `routeTree.gen.ts` is generated, so route files must physically stay in
   `src/routes/` with their current names — URLs never change during the migration.)
4. **No cross-domain deep imports, no circular deps.** If two domains need the same thing and it
   is genuinely generic, it goes in `shared/`. "Two files use it" is not enough — it must be
   domain-agnostic.
5. **Status values are centralized and typed** in each domain's `status.ts` (union derived from
   the DB enum, transition map, guard functions, display labels). No raw status-string
   comparisons in components.
6. **Validate at boundaries** — zod schemas for every form and every external input, in the
   domain's `schemas/`.
7. **Permissions ≠ UI visibility.** Route `beforeLoad` role checks and any client permission
   helpers are UX only. RLS and server-side RPC checks are the real boundary (see the DB tests).
8. **No `any` to paper over architecture.** Derive types from `Database` in
   `src/lib/supabase/types.ts` rather than duplicating server shapes.

## How to add a feature

1. Decide which domain owns it (or create a new `domains/<name>/` with the standard subfolders —
   only the ones you actually need).
2. Data access → `services/`. Types / view models → `types.ts`. Status vocab → `status.ts`.
   Forms → `schemas/` + `components/`. Page views → `pages/`.
3. Export the public surface from `index.ts`.
4. If it needs a route, add/keep a thin shell in `src/routes/` that renders your page component.
5. `tsc --noEmit`, `eslint .`, `tsx --test tests/unit/*.test.ts`, `vite build` — all green
   before moving on. Add focused unit tests for extracted domain logic (state machines,
   permission rules, mappers).

## Backend-dependent surfaces

Some domains (`payments`, parts of `pedigrees`, the widened `reservations` states) describe
contracts the database does not implement yet. Those service modules are typed interfaces with
clearly-marked stubs (`// BACKEND: not wired`) and their UI states say so honestly — never a fake
success. Tracked in `docs/DEFERRED_BACKEND.md`.
