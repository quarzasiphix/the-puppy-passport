# Accessibility hardening report

Source-level audit performed while the shared local Supabase instance was potentially in use by
Bot 1's integration certification (no live browser/AT testing against real app state was possible
during this pass — see `docs/POST_INTEGRATION_HARDENING_STATE.md`). This audit builds on, and does
not duplicate, the frontend branch's own earlier pass (commit `941fd9f`, "label every unlabelled
control"), which was explicitly scoped to "all 18 files touched across this branch" — i.e. the
frontend-only files. This pass specifically targeted files **outside** that scope: the
operations/admin/driver dashboards, which predate the frontend branch and were never covered by
that pass.

## Method

- Grepped every `size="icon"` Button usage across `src/` for a missing `aria-label` (11 total
  instances found; 4 already correct via existing `aria-label` or `sr-only` text; 3 confirmed fine
  on inspection — `ui/calendar.tsx`'s day cells use the visible day number as their own accessible
  name, `ui/sidebar.tsx`'s trigger has an `sr-only` label).
- Grepped every `<Input`/`<Textarea`/`<Select` in the operations/admin route files for missing
  `<Label>`/`<FormLabel>`/`aria-label` association, then manually inspected each candidate (most
  false positives were `FormField`/`FormLabel` shadcn form patterns my initial grep didn't match).

## Fixed (commits `64abebf`, `2a7a831`)

1. **Notification bell button** (`notification-bell.tsx`) — icon-only, zero accessible name at
   all; a screen reader user had no way to know what this control does. Added a dynamic
   `aria-label` (includes the unread count) and marked the decorative count badge `aria-hidden`
   (its number is now conveyed once, correctly, via the label).
2. **Featured-organisation toggle** (`dashboard.admin.organisations.tsx`) — icon-only star toggle
   with no accessible name; state was conveyed only by fill color. Added `aria-label` (dynamic on
   current state) and `aria-pressed`.
3. **Calendar prev/next navigation** (`dashboard.operations.calendar.tsx`) — two icon-only
   chevron buttons, zero accessible name. Added context-aware `aria-label`s ("Previous
   week"/"Previous day" etc., matching the active view mode).
4. **Unassociated note labels** (`dashboard.operations.requests.$id.tsx`) — two `<label>` elements
   with visible text but no `htmlFor`/`id` link to their `<Textarea>` siblings (not nested, so no
   implicit association either). Added matching `id`/`htmlFor` pairs.
5. **Placeholder-only textareas** (`dashboard.operations.welfare-cases.tsx`,
   `dashboard.admin.achievement-verification.tsx`, `dashboard.admin.listings.tsx`,
   `dashboard.admin.moderation.tsx` — 5 fields total) — relying on `placeholder` alone as the only
   accessible name is the exact anti-pattern commit `941fd9f` already flagged and fixed elsewhere;
   applied the same fix here (explicit `aria-label` alongside the existing placeholder).

## Not flagged as bugs

- `Select` triggers whose accessible name comes from a rendered `SelectValue` placeholder (e.g.
  `dashboard.operations.routes.$id.tsx`'s request picker) — Radix's `Select` exposes the trigger's
  rendered content as its accessible name, which is the same mechanism a native `<select>` uses;
  left as-is.
- Internal ops/admin dashboards were **not** audited for translation/i18n — per this project's own
  documented rule ("Internal dashboards (ops/admin) can and should stay precise and technical — the
  translation only has to happen at the customer-facing edge"), that's correct as-is, not a gap.

## Not done in this pass (documented, not silently skipped)

- No live keyboard-only walkthrough, no screen-reader (VoiceOver/NVDA) session — still needs a
  human session, not something an automated tool run substitutes for.
- Focus-trap/focus-return behavior in dialogs was not independently re-verified here — the app
  uses Radix's `Dialog`/`AlertDialog` primitives throughout, which handle this correctly by
  default; no custom dialog implementation was found that would bypass it.
- `prefers-reduced-motion` support (commit `761a6a6`, already landed in the frontend branch) was
  not re-audited; no changes found that would regress it.

## Later session: automated axe-core pass (fills the color-contrast/automated-scan gap above)

Added `@axe-core/playwright` and `tests/e2e/accessibility.spec.ts` (`@a11y` tag, `wcag2a`/`wcag2aa`
rule sets) — real, running WCAG-level checks against a live dev server + isolated DB, closing the
"no automated axe-core run" gap named above. Six representative pages tested (one per distinct
layout family, not every route): homepage, find-a-dog listing, breeder detail, sign-in form, buyer
dashboard, operations dashboard.

**2 real bugs found and fixed:**

1. **Critical: an unlabeled `Select` trigger.** `_public.find-a-dog.tsx`'s sort-order dropdown had
   no accessible name at all (a screen reader announces nothing useful for it) — unlike the two
   sibling filter `Select`s in the same file (breed, country), which already correctly had
   `aria-label`. Fixed by adding `aria-label="Sort by"`, matching the existing sibling pattern
   exactly.
2. **Serious: 3 inline links distinguished only by color.** `_public.find-a-dog.tsx`'s guided-search
   link and `dashboard.buyer.index.tsx`'s two empty-state links (`Request transport`, `Find a
   puppy`) used `hover:underline` only — no visual cue for a user who can't perceive the color
   difference until they hover. Fixed by making the underline permanent (`underline` instead of
   `hover:underline`) on all three.

**1 real gap found, deliberately not fixed — needs a design decision, not a code fix:**

- **The `--accent` brand color token (`oklch(0.72 0.14 55)`, `src/styles.css:73` — renders as
  `#e78a45`, the orange used for "eyebrow" section labels, status badges, and avatar-initial
  circles across the whole app) fails WCAG AA contrast (4.5:1) at the small text sizes it's
  actually used at** — measured 2.27-2.58:1 against light backgrounds, 2.43:1 for
  `text-accent-foreground` on `bg-accent` avatar circles. This is a single shared design token used
  in dozens of places (homepage eyebrows, dashboard badges/avatars, ops dashboard) — darkening it
  would be a real, visible brand-color change across the whole product, not a scoped code fix, and
  not something to decide unilaterally the same way `docs/SEO_HARDENING_REPORT.md` deliberately
  didn't guess a production domain. Flagged here as a real, named, unresolved WCAG AA gap requiring
  a deliberate yes/no on a darker `--accent` value (or restricting the light orange to large/bold
  text, where the AA threshold is only 3:1) — not silently left undocumented.
- Because of this, 3 of the 6 `accessibility.spec.ts` tests currently fail
  (`homepage`, `buyer dashboard`, `operations dashboard` — the 3 pages that render the `--accent`
  token) and will continue to fail until that design decision is made. This is intentional, honest
  reporting, not a bug in the test: the same accepted-and-documented-failure pattern this branch
  already uses for `db:schema-drift` in the quality gate. `npm run test:e2e:a11y` currently reports
  3/6 for this reason — tracked here, not hidden.

## Severity classification of what was found

All 3 icon-button and 7 label/textarea issues found were **functional accessibility defects**
(a screen-reader user could not determine a control's purpose or associate a label with its
field) — none were launch-blockers (every affected control is inside an authenticated internal
dashboard, not a public unauthenticated flow), but all were real and worth fixing regardless.
