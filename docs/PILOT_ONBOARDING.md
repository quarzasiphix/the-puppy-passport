# Pilot onboarding

Practical checklists for onboarding a real pilot participant, grounded in the real capabilities
verified across this session's work (`docs/FEATURE_LAUNCH_MATRIX.md`, `docs/BETA_SCOPE.md`,
`docs/IMPORT_AND_DATA_MIGRATION.md`). No step below promises a capability that doesn't exist.

## Breeder pilot

1. Account: sign up at `/signup`, choosing "Publish as a breeder."
2. Organisation: complete `/create-breeder` (name, org type — see
   `docs/CUSTOMER_DATA_REQUIREMENTS.md` for exactly what's required vs. optional).
3. Verification: an admin reviews and approves via `dashboard.admin.breeder-verification.tsx`
   before the kennel can publish — this is a real, enforced gate, not a formality.
4. Documents: any verification documents requested by the reviewing admin, uploaded via the
   breeder's own dashboard (private Storage, signed-URL access only).
5. Team: invite additional kennel staff via `dashboard.breeder.profile.tsx`'s team section if
   needed (real invite/accept flow, token-based).
6. Data entry: add parent dogs, litters, and puppies one at a time through the dashboard forms
   (`docs/IMPORT_AND_DATA_MIGRATION.md` — bulk import isn't built; for an existing kennel with many
   dogs, plan for support-assisted entry for the first batch).
7. Beta limitations disclosure: tell the pilot breeder plainly that fundraising, payments, and
   analytics don't exist yet (see `docs/BETA_SCOPE.md`), and that `/terms`/`/privacy` text is still
   draft pending legal review.
8. Training: a short walkthrough of the dashboard (applications, messages, transport requests).
9. Support contact: who to reach for questions during the pilot (see `docs/SUPPORT_RUNBOOK.md`).
10. Acceptance: the breeder confirms they understand the beta scope and limitations before going
    live publicly.

## Foundation pilot

Same shape as the breeder pilot, substituting `dashboard.admin.foundation-verification.tsx` for
verification, and using the adoption/rehoming animal forms
(`adoption-form-dialog.tsx`/`dashboard.foundation.animals.tsx`) instead of puppy listings.
Foundations additionally have the fundraising feature available in the schema but **disabled**
(`docs/BETA_SCOPE.md`) — do not present fundraising as available during a pilot.

## Buyer pilot

Lower friction: `/signup` choosing "Find a dog," no verification gate. Disclose the same beta
limitations (no payments, draft legal text) before treating any pilot buyer as a real customer
whose money or legal commitments are at stake — none currently are, since no payment provider
exists.

## Transport operator / driver pilot

1. Account: sign up, request "Manage transport operations" (`operations` role) — this specific
   role requires **admin approval** (unlike breeder/buyer, which are self-service), matching the
   signup form's own documented intent.
2. Driver-specific: the operations team creates the driver record and vehicle assignment via
   `dashboard.operations.drivers.tsx`/`dashboard.operations.vehicles.tsx` — drivers don't
   self-register.
3. Documents: license/insurance documents uploaded via `dashboard.operations.documents.tsx`,
   reviewed by ops staff.
4. Training: dispatch/route/incident-reporting walkthrough, matching
   `docs/TRANSPORT_INCIDENT_RUNBOOK.md`.
5. Support and incident contact: see `docs/TRANSPORT_INCIDENT_RUNBOOK.md` for the real escalation
   path.

## What every pilot needs told plainly, regardless of persona

- This is a beta: fundraising/payments/analytics/CRM/email/SMS don't exist yet (verified, not
  assumed — see `docs/FEATURE_LAUNCH_MATRIX.md`).
- `/terms`/`/privacy` are real and versioned (`docs/CONSENT_AND_COMMUNICATION_MODEL.md`) but the
  underlying legal text is still draft, pending lawyer review.
- No production backups exist yet (`docs/BACKUP_AND_RESTORE_REQUIREMENTS.md`) — local/demo data
  only until real infrastructure is stood up.
