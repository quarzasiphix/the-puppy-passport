# Animals domain

The animal-record CRUD layer: kennel/foundation profile management (despite the name — see the
`breeders` domain's own note on this overlap), litters, puppies, parent dogs, breeds, achievements,
and adoption-listing management. The largest and most load-bearing service file in the codebase
(`services/breeder.ts`, 337 lines).

## What this owns

- `organisations` (kennel-side reads/updates: `getMyKennel`, `getMyKennelProfile`, `updateKennel`,
  `markOnboardingComplete`), `organisation_members` (via `getMyActiveOrgIds()`, the private
  resolver every "my kennel" lookup goes through — "resolve 'my kennel' through
  `organisation_members` instead [of `owner_user_id`]... it already gets a row for the original
  owner at org-creation time as well", `services/breeder.ts:15-16`).
- `parent_dogs` — `listKennelParentDogs`.
- `litters` — `listKennelLitters`, `getKennelLitter`, `createLitter`, `updateLitter`.
- `animals` — `listKennelPuppies`, `listLitterPuppies`, `createPuppy`, `updatePuppy`; also the
  foundation-side `listFoundationAnimals`/`createAdoptionAnimal`/`updateAdoptionAnimal` in
  `services/foundation.ts` (adoption-category listings, `org_type in
  ('foundation','shelter','rescue')`).
- `animal_images` — via `uploadAnimalCoverPhoto`/`animalCoverPhotoUrl`.
- `breeds` — `listBreeds()` (public reference directory read).
- `achievements` — `listKennelAchievements`, `createAchievement`.

## File structure

- `index.ts` — re-exports `services/breeder`, `services/foundation`,
  `components/achievement-form-dialog`, `components/litter-form-dialog`,
  `components/parent-dog-form-dialog`, `components/puppy-form-dialog`.
- `services/breeder.ts` (337 lines, 23 exports) — kennel profile CRUD, litters, puppies, parent
  dogs, breeds, achievements. **Also home to `getMyKennel`/`getMyKennelProfile`/`updateKennel`
  despite conceptually belonging to the `breeders` domain** — re-exported from there, not moved
  here as a fix; see `breeders/AGENTS.md` and `docs/FILE_MIGRATION_MAP.md`.
- `services/foundation.ts` (66 lines, 6 exports) — the foundation/shelter/rescue equivalent of the
  kennel-profile half of `breeder.ts`, for adoption-category listings.
- `components/achievement-form-dialog.tsx`, `litter-form-dialog.tsx`, `parent-dog-form-dialog.tsx`,
  `puppy-form-dialog.tsx` — the create/edit dialogs used across the breeder dashboard for each
  record type.

## Public API

`index.ts` exports the full surface flatly.

## Known gaps

- The `animals`/`breeders` domain split is real and unresolved: org-profile concerns
  (`getMyKennel` etc.) live here, not in `breeders`, purely for historical reasons ("the
  prototype's single 'breeder.ts' data module") — don't assume file location matches conceptual
  ownership in this pair of domains.
- Did not verify in this pass whether `createPuppy`/`updatePuppy` enforce
  `organisations.verification_status = 'approved'` before allowing a listing to actually publish
  publicly (RLS on `animals`/`litters` already gates *visibility* per
  `docs/BREEDER_VERIFICATION_AND_TRUST.md`'s audit note — whether the *write* path here has its own
  separate check, or relies entirely on that downstream RLS gate, wasn't checked).

## Related docs

- `docs/FILE_MIGRATION_MAP.md` — the breeder.ts/foundation.ts split-out plan.
- `docs/BREEDER_VERIFICATION_AND_TRUST.md` — verification/publication gating this domain's writes
  ultimately feed into.

## Last significant change

2026-09-12: added `components/achievement-verification-panel.tsx` (`AchievementVerificationPanel`),
extracted from `dashboard/admin/achievement-verification.tsx` so
`dashboard/moderator/achievement-verification.tsx` can share it — reviewing evidence for a
breeder-claimed title/diploma on a specific dog. Backed by new moderator-scoped SELECT/UPDATE RLS
policies on `achievements` (no RPC needed here — no cascading side effects on approve/reject,
unlike organisation/user_verifications approval elsewhere this session).
