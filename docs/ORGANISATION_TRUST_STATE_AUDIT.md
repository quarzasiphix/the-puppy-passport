# Organisation trust-state consistency (Stage YR-8)

## Already correct: public visibility

Cross-referenced every public-facing table against `organisations.verification_status` (by grep,
not assumed): `animals`, `litters`, `parent_dogs`, `welfare_cases`, `fundraising`, and
`achievements` all already correctly require `verification_status = 'approved'` before showing
anything belonging to that organisation. A suspended organisation's listings already vanish from
every public/browse view immediately — no gap there, confirmed with a direct new test rather than
just trusting the policy text.

## Already correct: no owner self-verification

`prevent_org_owner_transfer_by_non_admin()` (Stage CJM) already locks `verification_status`,
`is_featured`, and `owner_user_id` to admin-only changes, with a real audit_logs entry on every
admin change — closed in an earlier session, re-verified here with new tests proving both that the
org's own owner and an unrelated org owner are each rejected.

## The real gap found and fixed: suspension didn't stop new applications

`buyer_applications`' own INSERT policy ("buyers manage their own applications", a `for all`
policy) never checked the target animal's organisation at all — only `buyer_id = auth.uid()`. A
buyer who already knew an animal's id (a `saved_animals` entry made before the organisation was
suspended, or any other stale reference) could still submit a brand-new application against it via
a direct insert, completely bypassing the suspension. Suspension is meant to stop an organisation
operating; receiving new applications is exactly the kind of privileged workflow that should stop
too.

Fixed in `20260101013700_suspended_org_application_lock.sql`: split the single `for all` policy so
only INSERT gets the new check (`organization_id is null or that organisation is currently
approved`) — an existing application a buyer already has (made before suspension) remains fully
visible and withdrawable; only *creating a new one* against a currently-suspended/pending/rejected
org is blocked. Private-rehoming/direct-owner applications (`organization_id is null`, gated by
their own separate `rehoming_reviews` workflow) are correctly unaffected.

## "Restoration does not bypass reverification" — checked, already correct

Restoring an organisation (`verification_status: 'suspended' → 'approved'`) is a plain admin-only
update through the same trigger-protected column — there is no separate "re-verification" workflow
in this app to bypass (organisations only ever go through `approve_user_verification()` once, at
initial creation; restoration afterward is a direct admin decision, not a second review pipeline).
Nothing to fix here; the premise doesn't describe a real gap in this app's actual workflow.

## Verification

- `npx tsc --noEmit` — clean (no app code changed, migration + tests only).
- New `tests/db/organisation-trust-state-consistency.test.ts`: 16/16 passing — public-visibility
  suspension, the new application-lock fix (blocked while suspended, succeeds once restored,
  existing applications remain visible/withdrawable throughout), and the owner/cross-owner role
  matrix.
- Full `npm run test:db`: **982/982** (+16 from YR-7's 966), verified on a fresh reset plus one
  more run without reset.
- `npm run build`, `npm run db:preflight` (139 migrations, no unsafe patterns), `npm run
  db:contract-check` (no drift — this is an RLS policy change, not an RPC signature change) — all
  clean. No duplicate migration prefixes.
