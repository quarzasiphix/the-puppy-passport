# Fundraising publication control (Stage FA-3)

## The real gap found: organisations could self-publish a campaign with zero admin review

"Eligible org owners update their own non-terminal campaigns" (Stage AA,
`20260101009100_fundraising_outcome_status_lock.sql`) already correctly excludes `approved` from
the set of statuses an org can self-set — but never actually required the campaign to have
**passed through** `approved` before letting the org self-set `active`, which is exactly the
status that makes a campaign publicly visible (`"public reads active/successful campaigns of
public, approved organisations"`). An eligible organisation could go straight from creating a
draft campaign to a fully public, donation-soliciting page — with no admin review step ever
happening — contradicting this feature's own stated design principle
(`docs/FUNDRAISING_POLICY.md`: "no state may be skipped in a way that lets money move").

**Confirmed genuinely reachable, not hypothetical**: this file's own pre-existing test fixture
(`tests/db/fundraising.test.ts`, the "org cannot self-declare target_reached" test's own setup
step) did exactly this — insert a draft, self-update straight to `active` — without ever
questioning it, since that test's actual focus was a later, different transition. The bug had been
sitting in the test suite's own fixture, unquestioned, since Stage AA.

## What changed

New migration `20260101014000_fundraising_self_publish_lock.sql`: a `BEFORE UPDATE` trigger
(`prevent_fundraising_self_publish()`), the same pattern this schema already uses for every other
"specific transition, not just specific values" restriction
(`prevent_non_staff_operational_field_changes()`, `prevent_fundraising_purpose_change_after_payment()`)
— a bare RLS `WITH CHECK` can only see the new row, not compare it against the old one, so a
trigger is the correct mechanism here. Admins remain completely unconstrained (they're the trusted
actor this whole gate exists to require); an organisation can still freely move between every
other RLS-permitted status, only the specific `→ active` transition now requires the campaign to
already be `approved`.

## The other 4 named concerns, checked

- **"Feature-disabled state enforced server-side"**: checked — `FUNDRAISING_ENABLED`
  (`src/lib/fundraising-flag.ts`) is a pure `import.meta.env.VITE_...` client-side flag with zero
  database-layer awareness, meaning a raw API call from an eligible, verified org can create and
  manage a real fundraising campaign regardless of the frontend flag's value — the same shape
  `docs/MAINTENANCE_DEGRADATION_AUDIT.md` (Stage YR-18) already found and reasoned through for
  maintenance mode. **Not built here either**, and for a stronger reason than maintenance mode: no
  real payment can ever move regardless (`fundraising_contributions.is_simulated` is forced `true`
  by RLS on every insert, already documented, unaffected by this flag) — the actual worst case of
  this gap was the self-publication bypass just fixed above, not a financial risk. Flagged, not
  built speculatively, for the same "no real second consumer to protect against yet" reasoning as
  YR-18.
- **"Approval state distinct from editable campaign content"**: already true —
  `fundraising_campaign_links_are_valid()` and the outcome-status-lock policy operate on `status`
  independently of the campaign's own editable fields (`title`, `target_amount`, `currency`), and
  `prevent_fundraising_purpose_change_after_payment()` separately locks the *purpose* fields once
  real money has moved. No gap.
- **"Authorised administrative publication is audited"**: checked — no `audit_logs` entry is
  written when an admin approves a campaign. A real, smaller gap, but lower priority than the
  self-publication bypass just closed; not fixed in this same migration to keep this stage's
  change minimal and focused — flagged as a natural, small follow-up (matching the exact shape of
  Stage YR-7's own admin-command-audit-coverage work) for whoever picks it up next.
- **"Ordinary campaign editing still works where intended"**: verified directly — the full
  existing test suite (22/22 in this file, including all pre-existing coverage) still passes
  unmodified except the one fixture that needed the new required approval step added.

## Verification

- `npx tsc --noEmit` — clean (no app code changed, migration + tests only).
- `npx eslint tests/db/fundraising.test.ts` — clean.
- New test proves the fix directly: self-activation from draft rejected, self-activation from
  `organisation_review` still rejected, self-activation succeeds once admin sets `approved`, admin
  can always activate directly. Fixed the one pre-existing fixture that relied on the old (buggy)
  behavior. 22/22 passing in the file.
- Full `npm run test:db`: **1013/1013** (+7 from YR-25's 1006), verified on a fresh reset plus one
  more run without reset.
- `npm run build`, `npm run db:preflight` (142 migrations, no unsafe patterns), `npm run
  db:contract-check` (no drift — a trigger addition, no RPC/grant change) — all clean. No
  duplicate migration prefixes.
