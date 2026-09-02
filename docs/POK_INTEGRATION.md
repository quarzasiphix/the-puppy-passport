# POK integration boundary

Status: **documentation only — no integration exists.** This defines the boundary a future
integration must respect; nothing here is wired to a live POK system.

## Authority split

POK remains the authority for its own internal records: members, applications, litter
registrations, pedigree issuance, documents, office decisions, verification actions. Anemalo never
becomes a second source of truth for any of that, and never gets direct access to POK's production
database.

## What Anemalo may receive

An **approved public projection** per registered dog:

- registered dog identity, registration number, breed, sex, birth date
- kennel
- sire and dam
- approved public titles
- registry verification source (`"POK"`) and a synchronization timestamp

This maps directly onto `domains/pedigrees` (`docs/DEFERRED_BACKEND.md` — no pedigree table exists
yet): a POK-sourced fact becomes a `PedigreeAssertion` with `source: "kennel_club_record"` and
`verificationLevel: "registry_verified"` (both values already exist in
`domains/pedigrees/types.ts`, added ahead of any real registry integration for exactly this).

## What Anemalo must never import

Private addresses, personal phone numbers/emails, signatures, identity documents, payment
information, internal office notes, disciplinary information, private ownership documents,
unredacted source documents. If a future sync pipeline receives any of these from POK, they are
dropped before anything reaches `public` schema tables — never stored "just in case."

## Conflict handling

A community submission (a user- or breeder-entered pedigree fact) must never silently overwrite a
registry-sourced assertion. Two rows with different sources for the same field become a reviewable
conflict — the same shape `PedigreeCorrectionProposal` already models for any correction proposal,
registry-sourced or not.

## Display contract

A registry-confirmed relationship should always be attributable, e.g.:

> Pedigree relationship confirmed by POK
> Source: POK registry
> Last synchronized: [date]

Never rendered as an unattributed "Verified" badge — the verification level and its source travel
together (`PedigreeVerificationLevel` + `PedigreeAssertionSource` on the same assertion row).

## Next step when POK integration actually begins

1. Agree the exact projection schema/format with POK (their export, not a scrape of their UI).
2. Build the pedigree data model (`domains/pedigrees` is currently types + throwing stubs only —
   see `docs/DEFERRED_BACKEND.md`).
3. Build a server-side (never browser-side) import job that writes `PedigreeAssertion` rows with
   `source = 'kennel_club_record'`, never a raw table copy.
4. Surface conflicts for moderator/breeder review before any registry claim can be disputed or
   overridden.
