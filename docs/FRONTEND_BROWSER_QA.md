# Frontend browser QA checklist

Every "needs a real browser" note scattered across `docs/MARKETPLACE_UX_AUDIT.md`'s phases,
consolidated into one checklist. **Nothing in this file has been visually verified.**

A real Chromium launch was actually attempted this session (Playwright 1.61.1 and the Chromium/
Chrome-Headless-Shell binaries are both installed at `~/.cache/ms-playwright/chromium-1228` — this
wasn't skipped or assumed blocked). It failed with a genuine, environment-level error, not a code
or configuration problem:

```
/home/krystian/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell:
error while loading shared libraries: libglib-2.0.so.0: cannot open shared object file: No such file or directory
```

The sandbox is missing a system shared library (`libglib-2.0.so.0`) that Chromium's binary links
against — not fixable from inside this session without system package installation, which is
outside a frontend session's scope and (per the session's own instructions) not worth repeatedly
retrying. This was tried exactly once, the exact error recorded here, and not reattempted.

Separately, no reachable local Supabase instance exists in this worktree — starting one was
deliberately avoided even though the CLI is installed, since doing so risked colliding with the
parallel backend session's live database work in the main worktree (shared Docker/port state),
which the session's own instructions listed as a reason to stop and not proceed.

Given both blockers, every fix referenced below was verified by reading the actual rendered
Tailwind classes/markup, and in a few cases by a request-level smoke check (`curl` against a
running `vite dev` process with no `.env`/no reachable Supabase — see `docs/MARKETPLACE_UX_AUDIT.md`
Phase 1) that confirms error-propagation behaviour, not real visual layout or real data
correctness. Nothing below is claimed as a real browser pass.

## Suggested viewports

320px, 360px, 390px (representative narrow phones), 768px (tablet), and desktop, per route below.

## Routes to check, with what specifically needs eyes on it

### `/foundations` and `/foundations/$slug`
- Grid wrapping and card layout on the directory page at 320–375px.
- Hero action-button row wrapping (Follow + "View animals available for adoption"), now fixed to
  use `flex-wrap` — confirm it actually wraps cleanly rather than just not overflowing.
- `TabsList` overflow with the fullest realistic tab set (Verified badge + org-type badge + a long
  organisation name + Updates tab all present at once).
- Cover-image aspect ratio and logo placement on very narrow phones.

### `/breeders` and `/breeders/$slug`
- New search box on `/breeders` — confirm typing actually filters visually (logic verified by
  reading code, not by typing into a real rendered input).
- Same hero action-button row and `TabsList` overflow check as foundations (the two profile pages
  share the same layout pattern).
- New "Updates" tab with 0, 1, and several posts — confirm spacing/empty-state look right.

### `/find-a-dog`
- **Highest-priority visual check this session produced**: the new mobile filter `Sheet` — does it
  open/close correctly, does the active-filter-count badge update live, does "Show N results"
  actually return focus to the (now-filtered) results rather than leaving the sheet open or
  scrolling somewhere unexpected?
- Results-toolbar wrapping (sort dropdown + view-mode buttons) at 320–375px, now fixed with
  `flex-wrap` — confirm the wrap point looks intentional, not awkward.
- List-view row layout at 320px (image + text + price stacking).
- Price slider behaviour when `priceBounds[0] === priceBounds[1]` (the disabled edge case for a
  database with 0 or 1 puppies at the same price) — does the disabled slider look reasonable, or
  should it hide entirely in that case?

### `/find-your-dog`
- All four guided-search steps, especially the transport step now at `grid-cols-1 sm:grid-cols-2` —
  confirm the two full-sentence options are comfortably readable at 320px and that switching to
  `sm:grid-cols-2` at the tablet breakpoint doesn't look premature.
- The new error state (failed `puppiesQuery`/`breedSizesQuery`) — force a failure and confirm the
  "Try again" button actually re-fetches and recovers into the normal results view.

### `/adoptions/$id`
- New "Transport" sidebar card — confirm it renders correctly alongside the existing interest/apply
  card, and that the honest sequencing copy doesn't overflow on narrow phones.
- Image gallery + sidebar stacking order at narrow widths (the `lg:grid-cols-[1.3fr_1fr]` split
  collapsing to one column).
- Private-rehoming vs. foundation-adoption wording switch (rehoming fee vs. adoption fee, "Ask about
  rehoming" vs. "I'm interested in adopting") — confirm both real code paths render as expected with
  actual private-rehoming and actual foundation-adoption test data.

### `/profile/$profileId`
- New "Report this profile" button next to Follow — confirm it doesn't crowd the header at narrow
  widths, and that it's correctly absent on your own profile.
- Kennel vs. foundation professional-profile link (`Dog` vs. `HeartHandshake` icon) — needs a real
  profile owning each organisation type to click-test both branches.

### `/community` (main feed)
- Organisation-authored post author links (kennel → breeder profile, foundation → foundation
  profile) — needs a real post authored by an organisation in seed/dev data to click-test; this
  session could not confirm one exists.
- New report control on each post, new `aria-label`s on like/comment/send buttons — confirm with a
  screen reader or at minimum the browser's accessibility inspector, not just code review.
- Locale-aware timestamps — switch to Polish and confirm the date renders with Polish month
  abbreviations while the rest of the post stays in English (documented as an intentional, narrow
  exception, but worth an eyeball to confirm it doesn't read as broken).
- New error state on the main post feed — force a failure and confirm "Try again" recovers.

### `/community/groups` and `/community/groups/$slug`
- New empty/error states on the groups directory and the group post list — force both and confirm
  they look distinct from each other and from a real loading state.
- Group post composer's new `aria-label` — confirm with an accessibility inspector.

### `dashboard/buyer/saved` and `dashboard/buyer/followed`
- The two/three-section layout (Puppies / Dogs for adoption / Private rehoming; Breeders /
  Foundations & rescues) with real signed-in data — this session could not authenticate against a
  running local Supabase instance, so none of this has been seen rendered with real rows.
- Tile grid at 320px with a genuinely long real kennel/foundation/animal name — confirm the
  `min-w-0`/`break-words`/`shrink-0` guards added this session actually prevent overflow rather than
  just not causing a build error.

### `/rehome` and `/create-breeder`
- New `id`/`htmlFor`/`aria-labelledby` pairings on `/rehome`'s 8 fields — confirm with a screen
  reader that each field announces its label correctly, not just that the attributes are present in
  markup.
- `/create-breeder`'s new error state (failed verification-status check) — force a failure and
  confirm it correctly blocks the form and that "Try again" recovers into either the form or the
  correct status view.

### Polish locale, generally
- Switch the language selector to Polish on every route above and scan for: text overflow from
  longer Polish strings, any page that ends up showing a mix of Polish and English (should not
  happen per the Phase 12 audit, but only a real render confirms it), and the `pluralCategory`-driven
  count sentences (foundations directory count, `FoundationCard`'s "N dogs for adoption") at counts
  0, 1, 2, 4, 5, 12, and 22 — the specific values this session's unit tests cover mathematically,
  worth confirming they *read* correctly too.

## What would unblock this checklist

A working `npx playwright test` run (or manual `npm run dev` + a real browser) against a real,
seeded local Supabase instance (`npm run db:start` + existing seed data) would resolve every item
above. Neither was attempted from this worktree during this session, specifically to avoid
colliding with the parallel backend session's own live database/migration work in the main
worktree — this was a deliberate scope boundary, not an oversight.
