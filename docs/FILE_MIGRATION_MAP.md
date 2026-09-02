# File migration map

Tracks the move from the flat prototype layout to domain-oriented modules
(`docs/FRONTEND_ARCHITECTURE.md`). Status: **structural migration complete** — every file has a
new home; `tsc`, `eslint`, unit tests and `vite build` all pass. Two items remain follow-up work,
called out below.

## Routes (`src/routes/*`)

Routes are now grouped in folders by workspace (TanStack Router folders ≡ dots — file-based
routing, URLs unchanged, `routeTree.gen.ts` regenerates from the new layout):

```
src/routes/
  __root.tsx
  _public.tsx                 public site layout
  _public/                    marketing, discovery, auth, community, fundraising, transport-public
  dashboard/
    buyer.tsx        buyer.*/
    breeder.tsx       breeder/*
    foundation.tsx    foundation/*
    operations.tsx    operations/*
    admin.tsx         admin/*
    driver.tsx        driver/*
```

Every route file renders a page component imported from a domain barrel (or, for pages not yet
extracted into a dedicated `pages/` module, keeps its existing inline JSX — that JSX now imports
domain services through the barrel instead of `@/lib/queries/*`). Extracting every remaining
route body into `domains/<d>/pages/*.tsx` (as done for `reservations`) is follow-up work, not
required for the domain boundary to exist and be enforced.

## Data layer (`src/lib/queries/*` → `src/domains/<d>/services/`)

| Old module | New home |
|---|---|
| `queries/reservations.ts` | `domains/reservations/services/reservations.ts` (moved earlier; old path kept as a **shim** re-exporting the barrel — 2 remaining importers, safe to delete once they move to `pages/`) |
| `queries/profile.ts`, `privacy.ts`, `organisations.ts`, `team.ts` | `domains/identity/services/` |
| `queries/breeder.ts`, `foundation.ts` | `domains/animals/services/` — see note below |
| `queries/marketplace.ts`, `applications.ts`, `buyer-activity.ts`, `rehoming.ts` | `domains/marketplace/services/` |
| `queries/messaging.ts`, `notifications.ts` | `domains/messaging/services/` |
| `queries/transport.ts`, `routes.ts`, `dispatch.ts`, `driver.ts`, `fleet.ts`, `matching.ts`, `calendar.ts`, `pricing.ts`, `welfare.ts` | `domains/transport/services/` |
| `queries/moderation.ts` | `domains/trust/services/` |
| `queries/operations.ts`, `markets.ts`, `maintenance.ts` | `domains/operations/services/` |
| `queries/community.ts`, `groups.ts` | `domains/community/services/` |
| `queries/fundraising.ts` | `domains/fundraising/services/` |
| `lib/notification-templates.ts` | `domains/messaging/services/notification-templates.ts` |
| `lib/fundraising-flag.ts` | `domains/fundraising/services/fundraising-flag.ts` |
| `lib/auth/guards.ts`, `session.ts`, `actions.ts` | `domains/identity/services/` |
| `hooks/use-auth.ts` | `domains/identity/hooks/use-auth.ts` |

**Follow-up, not done in this pass:** `breeder.ts` and `foundation.ts` are the prototype's single
data module for a kennel/foundation and mix org-profile concerns (`getMyKennel`, `updateKennel`)
with animal-record CRUD (litters, puppies, parent dogs, breeds, achievements). They were moved as
whole files into `domains/animals/services/`, and `domains/breeders/index.ts` re-exports their
profile-shaped surface — correct behaviourally, but the domain boundary is currently a re-export,
not a real split. Splitting them into a real `breeders` profile service and an `animals` record
service is the next real refactor step (see docs/FRONTEND_ARCHITECTURE.md's "next step").
`queries/transport.ts` (originally 1057 lines) and `marketplace.ts` (712 lines) were similarly
moved whole rather than split by sub-concern — real files, real domain ownership, just still large.

## Components (`src/components/*` → domain `components/`, or `shared/`, or `app/`)

| Old file | New home |
|---|---|
| `dashboard-shell.tsx` | `app/layouts/dashboard-shell.tsx` |
| `site-chrome.tsx` | `app/layouts/site-chrome.tsx` |
| `action-launcher.tsx` | `app/components/action-launcher.tsx` (depends on identity + 4 other domains — an app-shell composition, not a generic primitive) |
| `not-implemented.tsx`, `legal-notice.tsx` | `shared/ui/` |
| `account-privacy-card.tsx` | `domains/identity/components/` |
| `achievement-form-dialog.tsx`, `litter-form-dialog.tsx`, `puppy-form-dialog.tsx`, `parent-dog-form-dialog.tsx` | `domains/animals/components/` |
| `apply-dialog.tsx`, `adoption-form-dialog.tsx`, `cards.tsx` | `domains/marketplace/components/` |
| `chat-thread.tsx`, `notification-bell.tsx`, `notification-preferences.tsx` | `domains/messaging/components/` |
| `transport-document-checklist.tsx`, `transport-timeline.tsx`, `review-transport-dialog.tsx`, `report-incident-dialog.tsx`, `ops-request-table.tsx` | `domains/transport/components/` |
| `report-dialog.tsx`, `verification-review-list.tsx` | `domains/trust/components/` |
| `fundraising-disabled-notice.tsx` | `domains/fundraising/components/` |
| `components/ui/*` (46 shadcn primitives) | `shared/ui/*` |

**Follow-up, not done in this pass:** the dialog-wizard components (`apply-dialog`,
`adoption-form-dialog`, `litter-form-dialog`, `puppy-form-dialog`, `parent-dog-form-dialog`,
`achievement-form-dialog`) still render as `<Dialog>` modals. The brief asks for dedicated
pages/panels for multi-step flows, reserving dialogs for short actions — converting these is a
UI-behaviour change, deliberately kept out of this structural migration so page behaviour stayed
identical throughout. Tracked as the next real UI work.

## `src/lib/*`

| Old | New | Status |
|---|---|---|
| `lib/mock-data.ts` | stays at `src/lib/mock-data.ts` | still used by `marketplace.ts` + `cards.tsx` for `Puppy`/`Litter`/`Breeder` **types**; deleting it means replacing those types with real row-derived ones — follow-up work |
| `lib/errors.ts`, `lib/utils.ts` | `shared/lib/` | done |
| `lib/i18n/` | `shared/i18n/` | done |
| `lib/error-page.ts`, `maintenance-page.ts`, `error-capture.ts`, `lovable-error-reporting.ts` | `app/` | done |
| `lib/supabase/*` | unchanged (`browser.ts`, `server.ts`, generated `types.ts`, hand-written `enums.ts`) | kept in place per architecture doc |
| `hooks/use-mobile.tsx`, `use-hydrated.ts` | `shared/hooks/` | done |

## New domains (no prototype equivalent)

`domains/pedigrees/` and `domains/payments/` — type contracts + explicitly-throwing service
stubs (`// BACKEND: not wired`) only. See `docs/DEFERRED_BACKEND.md`.

`domains/social/` (new) — built directly on the prototype's already-existing but never-wired
`posts`/`comments`/`reactions`/`follows`/`groups` tables (`20260101001900_community.sql`),
widened in `supabase/migrations/20260903000100`–`20260903000600`. `services/posts.ts`,
`comments.ts`, `reactions.ts`, `follows.ts`, `types.ts`, `index.ts`. See
`docs/SOCIAL_DOMAIN.md`.

`domains/breeders/` gained `types.ts` (`KennelSiteConfiguration`, `KennelDomain`,
`KennelCapabilities`/`getKennelCapabilities`) and `services/kennel-site.ts`
(`get`/`updateKennelSiteConfiguration`), backed by new tables
`organisation_site_configurations` / `organisation_domains` and the new
`organisations.plan` column.

**Follow-up, not done in this pass:** consolidate `domains/marketplace/services/buyer-activity.ts`'s
`followOrg`/`unfollowOrg`/`listFollowedOrgIds` onto `domains/social`'s generic
`followTarget`/`unfollowTarget`/`listFollowedIds` (both work today against the same `follows`
table; not merged to avoid touching 3 working call sites in this pass).
