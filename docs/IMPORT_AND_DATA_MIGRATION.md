# Import and data migration

Real-beta Phase A. Investigated whether a breeder or foundation can be onboarded without manual
SQL before building anything — per this phase's own explicit instruction not to create import
tooling merely because it was named, only after proving a real gap.

## The real answer: a full self-service path already exists

Verified against real code, not assumed:

1. **Organisation creation**: `/create-breeder` (`_public.create-breeder.tsx`) is a real,
   self-service form — no admin/SQL step required to create the organisation itself (admin
   approval is required before the org can _publish_, which is a deliberate trust gate, not a
   missing onboarding path).
2. **Team members**: `dashboard.foundation.team.tsx` has a real invite/list/revoke flow
   (`inviteOrgMember`/`listOrgInvitations`/`revokeOrgInvitation`), with a token-based acceptance
   page (`_public.invitations.$token.tsx`) — no SQL needed to add a second staff member.
3. **Animals, litters, parent dogs, achievements**: real form dialogs exist for each
   (`puppy-form-dialog.tsx`, `litter-form-dialog.tsx`, `parent-dog-form-dialog.tsx`,
   `achievement-form-dialog.tsx`, `adoption-form-dialog.tsx` for foundations) — a breeder or
   foundation can add every one of these record types through the dashboard UI, one at a time,
   with no database access.

The underlying RLS insert policies these forms rely on are already extensively covered by this
session's own test suite (organisation/animal/litter/achievement insert paths are exercised across
many `tests/db/*.test.ts` files as part of testing the ownership, verification, and ownership-
transfer workflows built around them) — this isn't an unverified, theoretical capability.

## What's genuinely absent: bulk import

There is no CSV/spreadsheet bulk-import feature — a breeder joining with an existing kennel of,
say, 20 dogs would need to add each one individually through the form dialogs above. This is a
real, plausible friction point for a pilot onboarding (matching `docs/PILOT_ONBOARDING.md`'s own
scope), but it is **not a blocking gap**: the one-at-a-time path is real, safe, and fully
RLS-protected today. A real breeder or foundation can be fully onboarded and start listing right
now without any backend engineer touching a database.

## Decision: not built speculatively this pass

Building a real bulk-import system properly (format validation, dry-run, tenant binding,
idempotent batch identity, duplicate detection, safe error reporting, audit trail, malicious-input
handling) is a substantial feature with real product decisions this session cannot make
unilaterally — the exact accepted file format, which fields are required vs. optional, and how a
breeder would actually deliver the file (upload? email to support? a support-mediated process for
the first few pilots?) are product/ops decisions, not implementation details. Building it
speculatively now, without a real pilot's actual data shape to design against, risks the same
"manufactured architecture" this session has repeatedly avoided elsewhere.

**Recommendation for whoever runs the first real pilot onboarding**: if a breeder genuinely has
more than a handful of existing animals, the pragmatic near-term path is support-assisted entry
(an ops/support staff member helps enter the first batch through the existing dashboard forms, or
inserts on the breeder's behalf via Supabase Studio under the admin's own audited session) rather
than blocking the pilot on building bulk-import tooling first. Revisit building a real import
feature once an actual pilot's real data volume and format are known.

See `docs/CUSTOMER_DATA_REQUIREMENTS.md` for what information a new organisation genuinely needs
to provide, regardless of whether it's entered one-by-one or (eventually) imported in bulk.
