# Frontend design-system reference

What component to reach for on this branch, and the semantic contract each one carries. This is a
reference for consistency, not a rewrite of the brand — everything here reuses existing shadcn/
Radix primitives (`src/components/ui/*`) and existing design tokens (Tailwind theme colors,
spacing, radii already configured in this repo). No new colors, no new component library.

## Primitives (use these, don't rebuild them)

Full shadcn/Radix kit already in `src/components/ui/*`: `button`, `badge`, `card`, `dialog`,
`alert-dialog`, `sheet`, `tabs`, `dropdown-menu`, `select`, `input`, `textarea`, `checkbox`,
`radio-group`, `switch`, `slider`, `tooltip`, `avatar`, `separator`, `skeleton`, `form` (react-hook-
form wiring), and more. If a page needs a UI primitive, check this directory before writing raw
markup — every ad-hoc `<div>` styled to look like a button/badge/card found during this audit was
degrading consistency, not adding anything a primitive didn't already offer.

## Composite presentation components (this branch's additions)

### `<EmptyState>` — `src/components/public/empty-state.tsx`
Use whenever a list/collection genuinely has zero items (not an error, not "loading"). Props:
`icon?` (a `lucide-react` icon component), `title` (required), `description?`, `action?` (a button
or link, or a fragment of several), `className?`. Visual contract: dashed border, `bg-secondary/40`,
centered text — this is the "calm, nothing-wrong-here" treatment. Never use it for a failed query.

### `<ErrorState>` — `src/components/public/error-state.tsx`
Use whenever a query/mutation genuinely failed and that must not be confused with "no results."
Props: `title` (required), `description?`, `action?` (almost always a retry button), `compact?`
(smaller padding/text for a nested section rather than a full page), `className?`. Visual contract:
`border-destructive/30 bg-destructive/5` — deliberately never shares a border/background with
`EmptyState`, so a real failure is never visually mistakable for an honest empty result. This is the
single most important rule this file enforces: **never let `!data?.length` be the only branch** —
every list-rendering component must distinguish loading → error → empty → populated, in that order.

### `<AnimalImage>` — `src/components/marketplace/animal-image.tsx`
Use for every animal/organisation photo that comes from user-uploaded/database data (not bundled
static assets like the homepage hero). Thin `<img>` wrapper: swaps to the shared local placeholder
on `onError` (a broken/404'd stored URL), in addition to the mapper-level fallback that already
handles "no image at all" in `src/lib/queries/marketplace.ts`. Same props as `<img>` plus a required
`src`.

### `formatDate`/`formatDateTime` — `src/lib/presentation/date.ts`
### `formatNumber` — `src/lib/presentation/number.ts`
Always use these instead of raw `.toLocaleDateString()`/`.toLocaleString()` calls. Both take the
app's own `Locale` (`"en" | "pl"`) and map it to a real Intl locale tag (`DATE_LOCALE`), so output is
consistent between SSR and hydration and actually respects the visitor's chosen language — a bare
`.toLocaleString()` uses the runtime's ambient default, which silently differs between server and
browser.

## Card system (`src/components/cards.tsx`)

`PuppyCard`, `AdoptionCard`, `LitterCard`, `BreederCard`, `FoundationCard` — one file, one visual
language (rounded-2xl border, `hover:-translate-y-0.5 hover:shadow-lg`, consistent badge placement:
status top-left, save button top-right, verification/transport badges bottom-left). Don't build a
new card shape for a new listing type — extend this file. `useIsSaved()` is the one shared
save/unsave hook every card and detail page uses; don't duplicate its query-key/mutation logic
locally.

## Status/label vocabulary — never show a raw enum to a customer

Every place a backend enum reaches a customer-facing screen needs a plain-language label map next
to it, not the raw string. Existing examples to follow: `applicationStatusLabels` (`src/lib/queries/
applications.ts`), `transportMilestones` (`src/lib/queries/transport.ts`, read-only from this
branch), `foundationOrgTypeLabel` (`src/components/cards.tsx`), `statusLabels` (quotation status,
`dashboard.buyer.quotations.tsx`), `routeStatusLabels` (`_public.planned-routes.tsx`). The last two
were real bugs found and fixed this session — a raw `q.status`/`r.status` was rendered directly. If
you add a new status-bearing field to a customer-facing page, add its label map in the same commit.

## Loading/empty/error contract for any data-driven view

1. `isLoading` → a plain `<p className="text-sm text-muted-foreground">Loading…</p>` (or a
   `Skeleton` where the shape of the eventual content matters more).
2. `isError` → `<ErrorState>` with a retry action wired to `refetch()`.
3. empty (`!data?.length`) → `<EmptyState>` with copy explaining *why* it might be empty (no
   results vs. no matches vs. nothing published yet) and, where relevant, a real action.
4. populated → the actual content.

Skipping step 2 (checked directly from step 1 to step 3) was found and fixed in several places this
session (`dashboard.buyer.reservations.tsx`, `dashboard.buyer.quotations.tsx`,
`dashboard.buyer.messages.tsx`) — a genuine query failure was silently indistinguishable from "you
have none of these yet."

## What was deliberately NOT consolidated

Two shapes look superficially similar to `EmptyState`/`ErrorState` but are structurally different
and were left as page-local markup rather than forced into the shared components:

- Compact single-sentence inline-link banners (e.g. `dashboard.buyer.index.tsx`'s "No transport
  requests yet. **Request transport**" as one flowing sentence, `_public.community.groups.$slug.tsx`'s
  "Sign in and join to see and post updates in this group."). These have no title/description split
  and no icon — forcing them through `EmptyState` would either break the inline-sentence phrasing or
  require a third component purely to save a few lines, which is over-abstraction for two call
  sites.
- `dashboard.buyer.index.tsx`'s own `SectionError` — already the single canonical local pattern for
  that file's three preview sections; now internally reuses `<ErrorState compact>` rather than
  duplicating markup, without changing its call sites.
