# Marketplace domain

The buyer-facing browse/search layer, buyer applications (purchase/adoption/rehoming inquiries),
saved/followed activity, and private rehoming. Largest service file in the codebase after
`animals/services/breeder.ts`: `services/marketplace.ts` at 754 lines.

## What this owns

- `animals`, `litters`, `organisations` (public browse/search reads) — `listPublishedPuppies`,
  `countPublishedPuppies`, `getPuppyById`, `listPublishedLitters`, `listApprovedKennels`,
  `getKennelBySlug` (`services/marketplace.ts`). Comment: "Maps real Supabase rows onto the
  already-built [prototype] `mock-data.ts` shapes" — `mapAnimalToPuppy`/`mapOrgToBreeder` are the
  adapter functions; the mock-data types are still the view-model shape used by UI components even
  though the data is real.
- `buyer_applications` — `submitApplication`, `listMyApplications`, `withdrawApplication`,
  `listApplicationsForOrg`, `respondToApplication` (`services/applications.ts`). Owns
  `ApplicationStatus` and, as of 2026-09-12, `getApplicationStatusLabels(t)` — converted from a
  hardcoded `Record` to a `t()`-based function this session (matches the pattern documented in the
  repo-root `TODO.md`'s "shared status-label helpers" item).
- `saved_animals`, follows (via the `social` domain) — `services/buyer-activity.ts`: saved-puppy
  bookmarking and followed-breeder lists.
- `animals` (`listing_category = 'private_rehoming'`) + `rehoming_reviews` —
  `services/rehoming.ts`: "Private rehoming is a separate moderated workflow (CLAUDE.md rule #5): a
  `private_rehoming` animal only becomes publicly visible once an admin approves the corresponding
  `rehoming_reviews` row (enforced by RLS on `animals`, not just by hiding UI...)". This is the
  **existing, working path for a non-breeder to list their own dog** — `submitRehomingRequest`
  requires only sign-in, no role.

## File structure

- `index.ts` — re-exports `services/applications`, `services/buyer-activity`,
  `services/marketplace`, `services/rehoming`, `components/adoption-form-dialog`,
  `components/apply-dialog`, `components/cards`.
- `services/marketplace.ts` — public browse/search + the mock-data adapter functions described
  above; also a server-side notification-payload label map
  (`NOTIFICATION_STATUS_LABELS_EN`, added 2026-09-12 in `services/applications.ts` — see that
  file's own comment on why it's English-only: no React `t()` context in a background job, no
  recipient-locale lookup).
- `services/applications.ts` — buyer application lifecycle both sides (buyer submit/withdraw,
  org list/respond).
- `services/buyer-activity.ts` — saved puppies + followed breeders.
- `services/rehoming.ts` — private rehoming submit + admin review actions
  (`listRehomingReviews`/`approveRehomingReview`/`rejectRehomingReview`).
- `components/adoption-form-dialog.tsx`, `apply-dialog.tsx`, `cards.tsx` — the buyer-facing
  application dialogs and the shared puppy/breeder card components used across list pages.

## Public API

`index.ts` exports the full surface flatly.

## Known gaps

- `mock-data.ts` (outside this domain, `src/lib/mock-data.ts`) is still the type-definition source
  for `Puppy`/`Breeder`/etc. shapes — real data is mapped onto it, not the other way around; a
  schema change on the real tables needs a matching update to the mapper functions here, not just
  the DB.
- Server-side notification labels (`NOTIFICATION_STATUS_LABELS_EN` in `services/applications.ts`)
  are English-only — tracked in the repo-root `TODO.md`.

## Related docs

- `docs/BREEDER_VERIFICATION_AND_TRUST.md` — confirms the private-rehoming path already answers
  "how does a non-breeder list their own dog" without needing new schema.
- CLAUDE.md rule #5 ("Private rehoming requires a separate moderated workflow") — the rule this
  domain's `rehoming.ts` implements.

## Last significant change

2026-09-12: `applicationStatusLabels` converted from a hardcoded English `Record` to
`getApplicationStatusLabels(t)` (5 call sites across buyer/breeder/foundation dashboards and the
public puppy detail page updated to match); the notification-payload label map was kept
English-only and separated out explicitly rather than silently reusing the new translated function
in a context where no `t()` exists. Same day, later: added `components/rehoming-reviews-panel.tsx`
(`RehomingReviewsPanel`), extracted from `dashboard/admin/listings.tsx` for the moderator panel;
`rejectRehomingReview()` in `services/rehoming.ts` switched from a plain client UPDATE to the new
`reject_rehoming_review` RPC (the old path relied on an `is_admin()`-only RLS policy, unreachable
for a moderator — mirrors `approve_rehoming_review`, which was already an RPC and just needed its
`is_admin()` check widened to `is_moderator()`).
