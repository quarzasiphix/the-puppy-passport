# Frontend manual QA master checklist

Checkbox-ready list for a future session (or human) with a working browser and local Supabase
instance — neither was available in this sandbox this session (see `docs/FRONTEND_BROWSER_QA.md`
for the exact, genuinely-attempted Chromium failure). Every item below is marked with its real
current status, not assumed complete.

Legend: **[code]** verified by reading code only · **[blocked]** needs a real browser/backend ·
**[n/a]** feature doesn't exist yet, nothing to test.

## Desktop, English, signed out

- [code] Homepage loads, real counts, all CTAs resolve to real routes.
- [code] `/find-a-dog` filters narrow results; clearing filters/search resets correctly.
- [code] Puppy detail: gallery, tabs, transport estimate tool, sign-in prompt before applying.
- [code] `/breeders`, `/breeders/$slug`: search works, tabs render, follow prompts sign-in.
- [code] `/foundations`, `/foundations/$slug`: same shape as breeders, correct terminology.
- [code] `/adoptions`, `/adoptions/$id`: private rehoming visually distinct from org adoption.
- [code] `/community`, `/community/groups`: sign-in prompts before posting/joining.
- [blocked] Actual pixel layout, hover states, animation smoothness.

## Desktop, Polish, signed out

- [code] Every page confirmed on the i18n path (homepage hero, foundations, site header/footer)
  shows zero English fragments (Phase 12 audit + this session's footer-link-label fix).
- [code] Pages *not* on the i18n path (breeders, adoptions, community, most dashboards) render fully
  in English regardless of locale — an intentional, documented state, not a bug.
- [code] Date/number formatting uses `pl-PL` conventions when Polish is selected (this session's
  `formatDate`/`formatNumber` rollout).
- [blocked] Real visual check that Polish text (generally longer) doesn't overflow any container.

## Mobile (390px), English and Polish

- [code] Mobile nav sheet opens, closes on navigation, highlights current section (fixed this
  session).
- [code] Filter sheet on `/find-a-dog` shares the same `FilterControls` as desktop.
- [code] Gallery thumbnails wrap/scroll rather than overflow.
- [blocked] Real touch-target size measurement, real on-device rendering.

## Keyboard-only

- [code] See `docs/FRONTEND_ACCESSIBILITY_MATRIX.md` for the full interaction-by-interaction table.
- [blocked] Full tab-order walk-through of a complete page in a real browser.

## Reduced motion

- [code] Global `prefers-reduced-motion` override added this session
  (`src/styles.css`) — neutralizes all transition/animation durations.
- [blocked] Visual confirmation in a browser with the OS setting enabled.

## Slow network / signed in (buyer)

- [code] Every buyer dashboard page distinguishes loading → error → empty → populated (this
  session's empty/error-state consolidation, plus 3 real `isError`-missing bugs found and fixed:
  reservations, quotations, messages).
- [n/a] Real sign-in flow — no local Supabase instance reachable this session to create a session
  and exercise this as a signed-in user.
- [blocked] Real slow-3G throttling test.

## Backend-dependent, not testable from this branch alone

- [n/a] Real breeder/foundation verification approval round-trip.
- [n/a] Real transport quotation → acceptance → scheduling flow.
- [n/a] Real moderation/report review outcome.
- [n/a] Production Supabase — none configured, per `docs/PRODUCTION_SETUP.md`.

## How to actually run the `[blocked]` items

Once a browser is available: `npm run build && npx wrangler dev` (or `npm run dev`), then work
through this checklist route by route at 320/360/390/768/1280px, in both `en` and `pl` (language
switcher, top right), toggling the OS reduced-motion setting once. Update each `[blocked]` line to
`[verified ...]` or `[failed — description]` as you go, per file, don't leave this document stale.
