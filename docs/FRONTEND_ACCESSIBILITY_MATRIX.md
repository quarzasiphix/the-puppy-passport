# Frontend accessibility interaction matrix

Keyboard/screen-reader behavior for every major interactive pattern this branch touched or created.
Not a WCAG certification — a static-review checklist of what's actually implemented, cross-checked
against real component code, plus what still needs a real screen reader/browser to fully confirm
(see `docs/FRONTEND_BROWSER_QA.md` for why that hasn't been possible in this sandbox).

| Interaction | Keyboard | Enter/Space | Escape | Focus destination | Accessible name | Notes |
|---|---|---|---|---|---|---|
| Mobile nav sheet (`site-chrome.tsx`) | Radix `Sheet` traps focus | opens/activates links | closes sheet (Radix default) | first focusable element in sheet | "Open menu" on trigger | `activeProps` added this session for current-section highlight |
| Language switcher | Radix `DropdownMenu` | selects locale | closes menu | returns to trigger | "Language" aria-label | — |
| Save button (`cards.tsx`) | native `<button>` | toggles save | — | stays on button | `aria-label` "Save"/"Remove from saved" | `stopPropagation`/`preventDefault` so it never also triggers the card's own `<Link>` |
| Puppy/adoption gallery thumbnails | native `<button>` per thumbnail | switches active photo | — | stays on thumbnail | `aria-label="Photo N of M of {name}"`, `aria-pressed` | fixed this session for both puppy and adoption detail pages |
| Notification bell items | mixed: `<a>` when `link_url` set (native), `<button>` otherwise (fixed this session — was a plain `<div onClick>` with no keyboard path at all) | navigates / marks read | Radix `Popover` closes on Escape | — | visible title/body/date text serves as the accessible name | — |
| Report dialog (`report-dialog.tsx`) | Radix `Dialog` traps focus | submits | closes dialog | returns to trigger | dialog title read by screen reader on open | — |
| Follow/unfollow, join/leave group, like/unlike | native `<button>` | toggles | — | stays on button | text label or icon `aria-label` | every one already guards `disabled={...isPending}` (verified continuation-queue item D, still true) |
| Withdraw application (this session) | Radix `AlertDialog` | confirms | cancels/closes | returns to trigger | dialog title + description read on open | newly added — previously a single-click destructive action with no confirmation at all |
| Tabs (breeder/foundation profile, puppy detail) | Radix `Tabs` — arrow-key panel switching | activates tab | — | stays within tablist | `TabsTrigger` text is the accessible name | Radix default behavior, unmodified |
| Filter sheet (`find-a-dog.tsx` mobile) | Radix `Sheet` | applies filter controls | closes sheet | first control | sheet title | shared `FilterControls` component between desktop sidebar and mobile sheet |

## Known gaps, honestly listed (not fixed this session — no proof of impact beyond static review)

- Full screen-reader behavior (NVDA/VoiceOver announcement wording, live-region behavior for toast
  notifications) could not be verified — no working Chromium in this sandbox (see
  `FRONTEND_BROWSER_QA.md`), and no screen reader is available in a headless CLI environment even if
  Chromium worked.
- Toast notifications (`sonner`) are a third-party component; their own accessibility behavior
  (live-region role, auto-dismiss timing) was not independently re-verified this session — it ships
  with reasonable defaults and wasn't flagged as broken by anything checked here.
