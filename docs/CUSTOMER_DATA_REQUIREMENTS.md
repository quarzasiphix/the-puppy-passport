# Customer data requirements

What a new organisation genuinely needs to provide to onboard onto Havenpaw, derived from real
required (`NOT NULL`) columns and the real onboarding form (`_public.create-breeder.tsx`) — not a
speculative checklist.

## To create an organisation (breeder or foundation)

Required at creation time (matches the real form and the `organisations` table's own `NOT NULL`
columns): organisation type, name, and an owner account (the person creating it, authenticated
first). A `slug` is derived automatically, not asked of the user.

Everything else — public description, exact address, transport availability, verification
documents — is progressive: collected later, before publication, not blocking account creation.
This matches this project's own stated UX principle (progressive disclosure, ask only what's
needed right now).

## Before an organisation can publish (verification)

Admin-gated (`verification_status = 'approved'`), reviewed by staff — see
`dashboard.admin.breeder-verification.tsx`/`foundation-verification.tsx`. Not a self-service step,
deliberately: this is the trust gate that makes "verified breeder/foundation" mean something.

## To add an animal

Required by the real form + schema: name, sex, listing category, and organisation ownership
(implicit — inherited from the creating user's own org). Breed, litter, price, description,
temperament, and media are all real fields but not blocking — an animal can be saved as an
unpublished draft and completed incrementally, matching the same progressive-disclosure principle.

## What's explicitly NOT required to get started

- Exact address (only approximate area is ever public; exact address is operational-only, entered
  when relevant to a real transport request, not at onboarding).
- Payment information (no payment provider exists in this codebase yet).
- Bulk historical records — see `docs/IMPORT_AND_DATA_MIGRATION.md` for why this isn't a blocker.

## Data Havenpaw never asks for at onboarding

Anything that would only matter once a real transaction (application, transport, handover) is in
progress: buyer housing details, medical history beyond what a listing itself needs, or documents
beyond what verification specifically requires.
