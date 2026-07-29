# High-finding closeout

Consolidated record of all 5 Bot 1 High findings, closed this session. Each row's pre-fix
reproduction was run live against this repo's own database before any fix was written — none
trusted from a report alone. Bot 1's own independent method (live Postgres catalog introspection:
`pg_policies`, `pg_proc.proacl`, `\sf` trigger bodies) reached the same root-cause diagnosis for
all 5 findings via a completely different technique, cross-validating this closeout
(`/p/the-puppy-passport-bot1-overnight-20260728-233809/docs/BOT1_LATEST_HIGH_FINDING_REGISTER.md`,
reviewed as of source snapshot `ac612690`).

## HF-4 / NEW-H1 — quotation-acceptance raw-forge

- **Effective migration**: `20260101014500_quotation_acceptance_raw_forge_lock.sql`
- **Fixing commit**: `66383af` (hash filled in: `82791e5`)
- **Test**: `tests/db/quotation-dispatch-atomic-rpcs.test.ts` — "transport_requests.status: a raw
  update cannot forge accepted_by_customer"
- **Real lower-trust actor**: `customer` persona, own row, `requester_profile_id = auth.uid()`
- **Pre-fix reproduction**: raw `PATCH transport_requests` with `status: accepted_by_customer`
  succeeded even when the attached quotation was expired; `quotations.status` never advanced to
  `accepted`.
- **Post-fix denial**: same raw update now rejected with `P0001`, unless a real, currently
  accepted, unexpired quotation already exists for the request.
- **Authorised workflow result**: `respond_to_quotation()` unaffected — still accepts a valid
  quotation and transitions the request correctly.

## HF-2 / §5.3 — notification phishing primitive

- **Effective migration**: `20260101014600_notification_producer_authorization_lock.sql`
- **Fixing commit**: `b05d527`
- **Test**: `tests/db/notification-preferences.test.ts` — "create_notification_if_enabled:
  authorization boundary"
- **Real lower-trust actor**: any `authenticated` user (EXECUTE was granted unconditionally)
- **Pre-fix reproduction**: an unrelated user called the RPC directly with an arbitrary
  `p_profile_id`, title, body, and `link_url` — succeeded, creating a notification indistinguishable
  from a real one.
- **Post-fix denial**: rejected with `P0001` unless self, `is_moderator()`, or a real org-owner /
  applicant relationship exists.
- **Authorised workflow result**: all 4 real call sites in `src/` (moderation decision × 2,
  admin-only rehoming review × 2, org-owner-notifies-applicant × 1) still work.

## HF-1 / §5.2 — account-deletion-request raw-write

- **Effective migration**: `20260101014700_account_deletion_request_field_lock.sql`
- **Fixing commit**: `6cff166`
- **Test**: `tests/db/account-deletion-execution.test.ts` — "account_deletion_requests:
  status/processed_by cannot be raw-forged by the requester"
- **Real lower-trust actor**: `customer` (disposable throwaway account), own row
- **Pre-fix reproduction**: raw `PATCH account_deletion_requests` setting
  `status: processed, processed_by: <any real admin's id>` succeeded, with no real anonymisation
  ever running via `execute_account_deletion()`.
- **Post-fix denial**: rejected with `P0001`; `processed_by`/`processed_at` are now always
  server-stamped from the real caller regardless of what the client sends.
- **Authorised workflow result**: `execute_account_deletion()` (admin-only RPC) unaffected; the
  admin-only "declined" raw-update path still works, now correctly server-stamped too.

## HF-3 / §5.4 — moderation self-resolution

- **Effective migration**: `20260101014800_moderation_case_self_conflict_lock.sql`
- **Fixing commit**: `1f8150b`
- **Test**: `tests/db/moderation-case-claim.test.ts` — "claim_moderation_case: a moderator cannot
  claim or decide a case about their own account"
- **Real lower-trust actor**: a profile holding the `moderator` role who is also the case's own
  `affected_profile_id`
- **Pre-fix reproduction**: the conflicted moderator both claimed (`claim_moderation_case()`) and
  fully decided (raw update: `status`, `decision`) their own case — no server-side check existed.
- **Post-fix denial**: both paths rejected with `P0001` — one trigger closes both, since
  `SECURITY DEFINER` bypasses RLS but never triggers.
- **Authorised workflow result**: an independent (non-conflicted) moderator can still claim and
  decide normally; the affected user's own legitimate appeal (`submit_moderation_appeal()`) is
  unaffected — a first, broader trigger version was found (via the full regression suite) to
  incorrectly block that path too, and was narrowed before committing.

## HF-5 / NEW-H3 — achievement self-verification

- **Effective migration**: `20260101014900_achievement_self_verification_lock.sql`
- **Fixing commit**: `55bc8de`
- **Test**: `tests/db/organisation-trust-state-consistency.test.ts` — "achievements: an organisation
  cannot self-verify its own achievement"
- **Real lower-trust actor**: `breeder1`, own kennel's achievement (`owns_org(kennel_id)`)
- **Pre-fix reproduction**: raw `PATCH achievements` with `verification_status: approved` succeeded
  — the exact status that makes the achievement publicly visible as a "verified" trust signal.
- **Post-fix denial**: rejected with `P0001` for non-admin changes to
  `verification_status`/`admin_notes`/`reviewed_at`.
- **Authorised workflow result**: ordinary content edits (`title`, `issuing_body`, `achieved_on`,
  `evidence_url`) remain freely owner-editable; genuine admin approval still works.

## Test counts across the closeout

| Stage | Tests before | Tests after | Migrations after |
|---|---|---|---|
| HF-4 | 1034 | 1040 | 147 |
| HF-2 | 1040 | 1045 | 148 |
| HF-1 | 1045 | 1050 | 149 |
| HF-3 | 1050 | 1056 | 150 |
| HF-5 | 1056 | 1062 | 151 |

Each stage verified with a fresh `db:reset` plus at least one repeat run without reset (HF-4 and
HF-3 got two repeat runs, being state-machine/concurrency-touching); `npx tsc --noEmit`,
`npm run build`, `npm run db:preflight`, and `npm run db:contract-check` all clean at every stage.

## Remaining risk

None of the 5 findings has a known residual gap after its fix. Two smaller, adjacent items were
noted but deliberately not bundled into these fixes (proportionate scope, matching this session's
established discipline): admin approval of a fundraising campaign's own audit trail was already
closed separately (`7926f8a`); an admin-only "declined" account-deletion path's forgeable actor
argument was closed in the same HF-1 commit since it shared the exact table and concern.

Bot 1's own independent register (see header) reached the same 5 findings via a different
verification method (live Postgres catalog introspection vs. this session's live empirical
reproduction), cross-validating both the diagnosis and, once Bot 1 next reviews `main` past this
closeout's commits, should independently confirm the fixes.
