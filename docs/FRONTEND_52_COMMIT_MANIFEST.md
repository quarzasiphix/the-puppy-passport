# Frontend 52-commit manifest

Derived from the real repository, not assumed: `git merge-base main ux-marketplace-frontend-pass`
→ `02e64163d2162024968bf0e79d6aa999af57ac63`. `git log --oneline main..ux-marketplace-frontend-pass`
returns exactly **52 commits**, matching the expected count.

- **Oldest commit**: `1444e35` — "Real foundation directory/profiles, fix breeder/foundation
  cross-type leaks in saved/followed" (2026-07-23 08:08)
- **Newest commit**: `727d551` — "Final verification checkpoint: overnight final report + progress
  log close-out" (2026-07-23 23:06) — matches the frozen frontend's own recorded HEAD exactly.
- **Frozen frontend branch**: `ux-marketplace-frontend-pass`
- **Frozen frontend worktree** (read-only reference, never modified):
  `/p/the-puppy-passport-ux/.claude/worktrees/marketplace-ux-pass`

## Chronological order (oldest → newest)

| # | Commit | Date | Subject |
|---|---|---|---|
| 1 | `1444e35` | 2026-07-23 08:08 | Real foundation directory/profiles, fix breeder/foundation cross-type leaks in saved/followed |
| 2 | `851b216` | 2026-07-23 11:02 | Harden foundations/saved/followed: fix N+1, cache staleness, and misleading UI from 1444e35 |
| 3 | `e2dad52` | 2026-07-23 13:00 | Realign primary navigation with the product's actual priority hierarchy |
| 4 | `dd3b20f` | 2026-07-23 13:05 | find-a-dog: honest, data-derived filters + mobile filter drawer; fix fake-empty search error |
| 5 | `ba6b32a` | 2026-07-23 13:10 | LitterCard: fix "View litter" always linking to the same generic index page |
| 6 | `d2ffebc` | 2026-07-23 13:17 | Adoption detail: correct org-type wording and honest private-rehoming copy |
| 7 | `b83d7ac` | 2026-07-23 13:21 | Fix fake search on /breeders, add kennel Updates tab to breeder profiles |
| 8 | `f3f1e5d` | 2026-07-23 13:23 | Foundation profiles: add Updates tab, clarify adoption-then-transport sequencing |
| 9 | `db43be5` | 2026-07-23 13:25 | Public profile: add missing report-user entry point |
| 10 | `9e5a79d` | 2026-07-23 13:27 | Community feed: add missing post-report control and button accessible names |
| 11 | `8001e1e` | 2026-07-23 13:29 | Community groups: fix query failures silently reading as "no groups"/"no posts" |
| 12 | `f1dc31f` | 2026-07-23 13:34 | Fix applications pages linking adoption/rehoming rows to the puppy detail route |
| 13 | `c894020` | 2026-07-23 13:37 | Localisation audit: verify no partial EN/PL mixing, add dedicated i18n:check script |
| 14 | `941fd9f` | 2026-07-23 13:44 | Accessibility pass: label every unlabelled control, fix a heading-order skip |
| 15 | `5a27159` | 2026-07-23 13:51 | Mobile pass: fix non-wrapping rows, cramped transport step, and one more misleading "Contact breeder" button |
| 16 | `7bda665` | 2026-07-23 13:54 | Community feed: fix primary post query silently reading a failure as "no posts" |
| 17 | `2d011c7` | 2026-07-23 13:58 | Fix N+1 queries for breeder counts and litter counts (deferred from Phases 1 and 4) |
| 18 | `0a2ab4d` | 2026-07-23 14:02 | Fix unpublished-listing metadata exposure, add missing SEO description tags |
| 19 | `0ce7c21` | 2026-07-23 14:05 | Route/action integrity audit: add missing sign-in explanation on one button |
| 20 | `2f5e45c` | 2026-07-23 14:12 | Extract pluralCategory and foundation-org-type logic into testable pure modules |
| 21 | `e4835ec` | 2026-07-23 14:14 | Add autonomous-session progress tracker and consolidated backend-gaps doc |
| 22 | `0e94d18` | 2026-07-23 14:18 | Onboarding UX: fix unlabelled rehome form fields, add duplicate-submission guard |
| 23 | `c3c641e` | 2026-07-23 14:21 | Add transport handoff doc; fix adoption detail's missing transport CTA |
| 24 | `47373fb` | 2026-07-23 14:23 | Placeholder/dead-code scan and design-consistency check (both clean) |
| 25 | `769d205` | 2026-07-23 14:25 | Branch self-review: full diff re-checked as a PR, boundary compliance confirmed |
| 26 | `bb93596` | 2026-07-23 14:28 | Add consolidated browser QA checklist; record genuine Chromium launch failure |
| 27 | `ffa6d3e` | 2026-07-23 21:39 | Add final integration readiness report |
| 28 | `64c2b2c` | 2026-07-23 21:42 | Final verification: full 24-point checklist run fresh, all clean |
| 29 | `af4a729` | 2026-07-23 21:45 | Add real photo gallery to adoption detail; fix gallery thumbnail accessibility |
| 30 | `7a0ccc3` | 2026-07-23 21:51 | Complete FRONTEND_INTEGRATION_REPORT.md for continuation-queue commits |
| 31 | `54f95da` | 2026-07-23 21:52 | Continuation queue item F: final clean checkpoint |
| 32 | `0573acf` | 2026-07-23 22:18 | PR review + presentation core: fix owner-preview leak, add locale-aware dates |
| 33 | `78c0685` | 2026-07-23 22:19 | Progress log: overnight session 2, phase 1+2 entry |
| 34 | `6b30cbf` | 2026-07-23 22:21 | Phase 3: fix partial-translation violation in site footer, add mobile active-nav state |
| 35 | `7b84742` | 2026-07-23 22:23 | Phase 4/22: fix stale transport-first root meta contradicting product vision |
| 36 | `30a395f` | 2026-07-23 22:23 | Progress log: phases 3-4/22 entries |
| 37 | `c19c271` | 2026-07-23 22:26 | Phase 11: fix followed-profile cache-key inconsistency |
| 38 | `4b438c8` | 2026-07-23 22:30 | Phase 6/20/continuation-C: implement image-load-failure fallback |
| 39 | `501120e` | 2026-07-23 22:31 | Progress log: phases 11, 6/20/C entries |
| 40 | `dacd24a` | 2026-07-23 22:37 | Fix raw quotation-status enum shown to buyers + locale-aware number formatting |
| 41 | `5163613` | 2026-07-23 22:39 | Fix raw route-status enum shown on public planned-routes page |
| 42 | `a5e5efb` | 2026-07-23 22:39 | Progress log: number formatting + raw-enum fixes, supplemental queue start |
| 43 | `b863613` | 2026-07-23 22:49 | Supplemental stage A/D: consolidate duplicated empty/error states |
| 44 | `6dc9c90` | 2026-07-23 22:50 | Supplemental stage A: add FRONTEND_DESIGN_SYSTEM.md reference doc |
| 45 | `98c95a2` | 2026-07-23 22:50 | Progress log: supplemental stage A/D entry |
| 46 | `990b63a` | 2026-07-23 22:52 | Supplemental stage Z/EL: fix two raw-database-error exposures |
| 47 | `761a6a6` | 2026-07-23 22:54 | Supplemental stage O: respect prefers-reduced-motion globally |
| 48 | `31a28ea` | 2026-07-23 22:56 | Supplemental stage K/DP: notification center locale + keyboard accessibility |
| 49 | `a32121c` | 2026-07-23 22:58 | Supplemental stages AC/AG/R/S: query cache map, merge-conflict plan, observability and analytics contracts |
| 50 | `0157baf` | 2026-07-23 23:00 | Supplemental stage M/AB: add missing confirmation before withdrawing an application |
| 51 | `93f57bb` | 2026-07-23 23:01 | Supplemental stages DC/DP/EI/X: user journeys, accessibility matrix, manual QA checklist, performance budget |
| 52 | `727d551` | 2026-07-23 23:06 | Final verification checkpoint: overnight final report + progress log close-out |

## Known pre-identified conflicts (from Bot 1's own pre-integration analysis)

Per `docs/BOT1_FRONTEND_INTEGRATION_VERIFICATION.md` in the Bot 1 overnight audit clone
(read-only reference, not copied wholesale):

1. **`markDeletionRequestProcessed()` signature mismatch** — the frozen frontend's
   `dashboard.admin.users.tsx` calls the old 3-argument form
   (`markDeletionRequestProcessed(id, status, userId)`); current backend main removed the 3rd
   argument entirely (HF-1 fix, server-stamps the actor now). Needs updating to the 2-arg call,
   dropping the now-unused `useAuth`/`userId` plumbing to match.
2. **Generated Supabase types are stale** — the frozen frontend's own `src/lib/supabase/types.ts`
   predates 151 migrations' worth of schema evolution. Must be regenerated against the integrated
   result, never hand-merged.
3. **HF-4 (`respondToQuotation`) and HF-3 (`updateModerationCase`) legacy call shapes** — Bot 1
   independently checked both against current backend and found them still functionally
   compatible; no breaking change expected for either.
4. **HF-2/HF-5 have zero frontend integration surface** — neither
   `create_notification_if_enabled()`'s authorization change nor the achievement
   self-verification lock is called from any frozen-frontend file; no conflict expected.
