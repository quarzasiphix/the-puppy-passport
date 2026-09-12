# Breeders domain

Kennel/foundation public-profile surface: site configuration (theme, sections, brand color, plan
capabilities), profile stats, the shared dashboard panel UI kit, and the first-visit welcome modal.
"A kennel IS the existing `public.organisations` row... this domain does not introduce a parallel
entity" (`types.ts:3-5`).

## What this owns

- `organisation_site_configurations` — `getKennelSiteConfiguration`/`updateKennelSiteConfiguration`
  (`services/kennel-site.ts`). Falls back to `defaultKennelSiteConfiguration()` (pure function, no
  Supabase import, deliberately unit-testable) when no row exists yet — "never an error, never a
  blank page" (`types.ts:71-76`).
- Breeder profile stats (`services/breeder-stats.ts`) — derived counts only, no fabricated numbers,
  reading `animals`, `litters`, `parent_dogs`, `reservations`, `countFollowers()` (from the `social`
  domain), and `public_kennel_owner_identity_verification` (for `identityVerified` — note this is a
  *view*, not `user_verifications` directly).
- **Does not own** `getMyKennel`/`getMyKennelProfile`/`updateKennel`/`getMyFoundation` etc. — those
  live in `../animals/services/breeder.ts`/`foundation.ts` and are only re-exported here (see
  `index.ts:3-9` — a known, deliberate, not-yet-fixed structural overlap: "those two files were the
  prototype's single 'breeder.ts' data module and mix org-profile concerns with animal-record
  concerns... tracked as follow-up work in `docs/FILE_MIGRATION_MAP.md`").
- `services/brand-color.ts` — the curated brand-color palette (`BREEDER_BRAND_PALETTE`) and
  `getAccentCssVars`/`accentBorderStyle` helpers that apply `organisation_site_configurations
  .primary_color`/`organisations` accent color across the dashboard shell and public profile. As of
  2026-09-12 includes a "magenta" swatch (`#E22F99`) added for a real breeder's (GRYFIN YORK) brand.

## File structure

- `index.ts` — re-exports `../animals/services/breeder`, `../animals/services/foundation`,
  `./types`, `./services/kennel-site`, `./services/breeder-stats`, `./services/brand-color`,
  `./components/panel-ui`, `./components/welcome-modal`.
- `types.ts` — `KennelSiteConfiguration`, `KENNEL_SECTIONS`/`KENNEL_SECTION_LABELS` (hardcoded
  English, not i18n'd), `KennelDomain` (schema exists, no DNS/routing infra yet — "see
  `docs/SOCIAL_DOMAIN.md` 'Future subdomains and custom domains' and `docs/DEFERRED_BACKEND.md`"),
  and the plan/capability model `KennelPlan`/`KennelCapabilities`/`getKennelCapabilities()` —
  "nothing here is enforced by billing, because no payment provider exists yet... honest boundaries
  a future billing integration will gate, not a fake paywall" (`types.ts:109-113`).
- `services/kennel-site.ts` — site config CRUD, described above.
- `services/breeder-stats.ts` — `BreederStats` + `getBreederStats()`.
- `services/brand-color.ts` — palette + CSS-var accent helpers (see "What this owns").
- `components/panel-ui.tsx` — shared dashboard building blocks: `QuickActionTile`, `BigStat`,
  `ParentAvatarPair`, and the `PanelTone` (`primary`/`accent`/`success`/`warning`) system that lets
  a kennel's brand color reach dashboard tiles without per-component overrides.
- `components/welcome-modal.tsx` — first-visit breeder-panel modal, gated on
  `organisations.onboarding_completed_at == null`.

## Public API

`index.ts` exports the full surface flatly, including the two re-exported `animals`-domain files.

## Known gaps

- The `animals`/`breeders` split described above is real and acknowledged in-code, not fixed in
  this pass. Anyone editing kennel-profile CRUD should know it currently lives in `animals`, not
  here, despite being conceptually a `breeders` concern.
- `KENNEL_SECTION_LABELS` (`types.ts:27-41`) is hardcoded English.
- `KennelDomain`/custom-domain support has a data model but no working routing — don't assume a
  configured domain actually resolves.

## Related docs

- `docs/SOCIAL_DOMAIN.md` — "Core entity distinctions", future subdomains/custom domains.
- `docs/FILE_MIGRATION_MAP.md` — the tracked breeders/animals split follow-up.
- `docs/DEFERRED_BACKEND.md` — billing/domain-routing deferrals.

## Last significant change

2026-09-12 (this session): added a "magenta" `BREEDER_BRAND_PALETTE` entry and applied it to a real
kennel's brand color; separately, the "Contact breeder" button on the public profile
(`src/routes/_public/-components/breeder-profile/identity-card.tsx`, not in this domain) was
changed to actually use the org's accent color instead of always rendering the site default.
