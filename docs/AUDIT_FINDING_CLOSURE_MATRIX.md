# Audit finding closure matrix

Reconciles Bot 1's independent audit findings (isolated read-only clones, siblings of this repo —
see the correction note in `docs/AUTONOMOUS_BACKEND_PROGRESS.md`'s FA queue table) against this
repo's own current `main`. Every row below was independently re-verified live against this repo's
own database before any status was marked — a Bot 1 report's own claim was never trusted alone.

Latest source clone reconciled: `/p/the-puppy-passport-bot1-overnight-20260728-233809`
(`docs/BOT1_OVERNIGHT_REMEDIATION_MATRIX.md`, source snapshot `ac612690`).

| ID | Severity | Area | Status | Evidence | Fixing commit | Regression test |
|---|---|---|---|---|---|---|
| H-4 / NEW-H1 | High | `transport_requests.status` raw-forge to `accepted_by_customer` | **Fixed** | Reproduced live: a customer's raw update succeeded even with an expired quotation, bypassing `respond_to_quotation()`'s ownership/status/expiry checks entirely; `quotations.status` never advanced. | `66383af` | `tests/db/quotation-dispatch-atomic-rpcs.test.ts`: "transport_requests.status: a raw update cannot forge accepted_by_customer" |
| H-2 / §5.3 | High | `create_notification_if_enabled()` arbitrary-recipient/content phishing primitive | **Fixed** | Reproduced live: any authenticated user could notify any other user with arbitrary title/body/link_url; only the target's own category preference was checked, never the caller's relationship to them. | `b05d527` | `tests/db/notification-preferences.test.ts`: "create_notification_if_enabled: authorization boundary" |
| H-1 / §5.2 | High | `account_deletion_requests` RLS `ALL` self-policy raw-write | **Fixed** | Reproduced live: a customer could raw-mark their own pending request 'processed'/'declined' and forge `processed_by` to name any real admin, with no real anonymisation ever running. | `6cff166` | `tests/db/account-deletion-execution.test.ts`: "account_deletion_requests: status/processed_by cannot be raw-forged by the requester" |
| H-3 / §5.4 / VA-25-gap | High | `moderation_cases` moderator self-resolution | **Fixed** | Reproduced live: a moderator whose own account was the case's `affected_profile_id` could both claim it (`claim_moderation_case()`) and fully decide it (raw update) — no server-side conflict check existed. A first, broader trigger version was found (via the full regression suite, not assumed) to also incorrectly block the affected user's own legitimate appeal-status update; narrowed to only the decision-making columns. | `1f8150b` | `tests/db/moderation-case-claim.test.ts`: "claim_moderation_case: a moderator cannot claim or decide a case about their own account" |
| H-5 / NEW-H3 | High | `achievements.verification_status` self-verification | **Fixed** | Reproduced live: an org owner could raw-update their own achievement straight to `verification_status = 'approved'` (the status that makes it public), forging `reviewed_at`/`admin_notes` too. | `(pending — this commit)` | `tests/db/organisation-trust-state-consistency.test.ts`: "achievements: an organisation cannot self-verify its own achievement" |
| §5.1 | High (fixed, prior lineage) | Fundraising self-publication | Fixed | Matches this repo's own `52637b1` (Stage FA-3) | `52637b1` | `tests/db/fundraising.test.ts` |
| §6.2 | Medium (fixed, prior lineage) | `animal_ownership_history` immutability | Fixed (assumed from lineage, not independently re-verified this pass) | — | — | — |
| §7.5 | Low (fixed, prior lineage) | `getFriendlyErrorMessage` coverage | Fixed (matches this repo's own YR-16) | — | — | — |
| FA-4 | High (fixed, prior lineage) | Legal-hold propagation to self-delete paths | Fixed — matches this repo's own `58c1589` (Stage FA-4) | `58c1589` | `tests/db/legal-holds.test.ts` |

Rows marked "Not yet reconciled" are queued next in this same session (HF-1, HF-2, HF-3, HF-5 —
see `docs/AUTONOMOUS_BACKEND_PROGRESS.md`'s task list). This file will be updated as each closes,
not left stale.

## Candidate fixes from the finalisation clone — deliberately not cherry-picked

Two candidate fixes exist only in `/p/the-puppy-passport-bot1-finalisation-20260727-235034`
(never applied, merged, or pushed by any Bot 1 pass): `7ba7b32` (H-1, has a real migration-filename
collision with this repo's own `20260101013600_admin_command_audit_coverage.sql` and needs
renumbering before use) and `3f4db66` (H-5, reported collision-free). Per this session's own
standing discipline (never blindly cherry-pick from an audit clone; reimplement against current
main), both will be independently reimplemented against the current migration sequence when their
turn comes, using the clone's report only as evidence of the underlying gap — not as a diff to
apply directly.
