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

- No live keyboard-only walkthrough, no color-contrast measurement, no screen-reader (VoiceOver/
  NVDA) session, and no automated axe-core/Lighthouse run — all would need a live app against a
  live database, deferred to Phase 26/27 once safe relative to Bot 1's certification work.
- Focus-trap/focus-return behavior in dialogs was not independently re-verified here — the app
  uses Radix's `Dialog`/`AlertDialog` primitives throughout, which handle this correctly by
  default; no custom dialog implementation was found that would bypass it.
- `prefers-reduced-motion` support (commit `761a6a6`, already landed in the frontend branch) was
  not re-audited; no changes found that would regress it.

## Severity classification of what was found

All 3 icon-button and 7 label/textarea issues found were **functional accessibility defects**
(a screen-reader user could not determine a control's purpose or associate a label with its
field) — none were launch-blockers (every affected control is inside an authenticated internal
dashboard, not a public unauthenticated flow), but all were real and worth fixing regardless.
