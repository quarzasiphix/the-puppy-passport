# Admin command catalogue and step-up map (Stage YR-7)

Inventory of all 41 public RPCs (`docs/backend-api-contract-baseline.json`, Stage XR-18), the only
mutation surface reachable beyond plain RLS-scoped table access in this app. For each: who may call
it, what it touches, whether the actor is server-derived, whether it's audited, whether it's
idempotent on retry, and whether it requires recent step-up authentication
(`require_recent_auth()`, Stage CJN).

Building this table found and closed a real, demonstrated gap (see "What this stage fixed" below)
rather than just describing the status quo.

## Privileged commands (admin / ops / moderator only)

| RPC | Gate | Actor server-derived | Audited | Idempotent | Step-up |
|---|---|---|---|---|---|
| `execute_account_deletion` | admin | yes | yes | yes (terminal-state guard) | **yes** |
| `place_legal_hold` | admin | yes | yes | n/a (always creates new) | **yes** |
| `release_legal_hold` | admin | yes | yes | n/a (guarded by `released_at is null`) | **yes** |
| `approve_user_verification` | admin | yes | yes *(fixed this stage)* | yes (raises on repeat) | no |
| `approve_rehoming_review` | admin | yes | yes *(fixed this stage)* | yes | no |
| `change_ops_request_status` | ops | yes | yes | n/a (always applies new status) | no |
| `assign_driver_to_job` | ops | yes | yes *(fixed this stage)* | yes | no |
| `assign_request_to_route` | ops | yes | yes *(fixed this stage)* | no (unconditional insert) | no |
| `send_quotation` | ops | yes | yes *(fixed this stage)* | yes | no |
| `mark_risk_signal_reviewed` | ops | yes | yes *(fixed this stage)* | n/a (always applies review) | no |
| `claim_support_case` | ops | yes | yes | yes (same-claimant re-claim) | no |
| `claim_moderation_case` | moderator | yes | yes *(fixed this stage)* | yes (same-claimant re-claim) | no |
| `review_moderation_appeal` | moderator | yes | yes | terminal-state guarded | no |
| `escalate_report_to_case` | moderator | yes | yes *(fixed this stage)* | yes (returns existing case) | no |
| `review_welfare_case` | ops (`is_org_member`-adjacent, see migration) | yes | yes | terminal-state guarded (Stage XR-8) | no |
| `acknowledge_welfare_case` | org member | yes | yes | n/a | no |
| `convert_welfare_case_to_transport_draft` | org member | yes | yes | yes (Stage XR-9) | no |
| `review_transport_amendment` | ops | yes | yes | terminal-state guarded | no |

## Self-service commands (any authenticated user, scoped to their own resource)

| RPC | Scope check | Actor server-derived | Audited | Idempotent |
|---|---|---|---|---|
| `respond_to_quotation` | requester of the linked transport request | yes | no *(see note)* | yes |
| `convert_application_to_reservation` | org owner/admin of the application's target org | yes | yes *(fixed this stage)* | yes (Stage XR-9) |
| `request_transport_amendment` | requester/ops (checked inside) | yes | yes | n/a |
| `start_application_conversation` / `start_transport_conversation` | party to the resource | yes | no *(see note)* | yes (unique index) |
| `submit_moderation_appeal` | the case's own affected profile | yes | yes | terminal-state guarded |
| `accept_org_invitation` / `decline_org_invitation` | token ownership (email match) | yes | yes | yes (single-use token) |
| `invite_org_member` / `revoke_org_invitation` / `remove_org_member` / `change_org_member_role` / `set_org_member_status` | org manager (`can_manage_org_members`) | yes | yes | n/a |
| `leave_organisation` | the calling member's own row | yes | yes | n/a |
| `get_invitation_by_token` | token-scoped, read-only | n/a | n/a | n/a |
| `get_account_deletion_blockers` | admin-only, read-only | n/a | n/a | n/a |
| `create_transport_draft` | requester (called by `convert_welfare_case_to_transport_draft` internally, or directly) | yes | no *(see note)* | no |
| `create_notification_if_enabled` | internal primitive, not called with a forgeable actor (Stage CJR/CJS) | yes | n/a (notifications are not audit_logs entries) | yes (dedup_key) |
| `enforce_rate_limit` | internal primitive | yes | n/a | n/a |
| `get_my_profile` / `last_auth_at` / `require_recent_auth` | read-only / self-check primitives | n/a | n/a | n/a |

**Note on the 3 "not audited" self-service commands**: `respond_to_quotation` and
`start_application_conversation`/`start_transport_conversation`/`create_transport_draft` are
ordinary customer self-service actions on the caller's own resource — each already leaves its own
domain-specific history (`transport_status_history` for quotation acceptance, the conversation/
request row's own existence and timestamps for the others). `audit_logs` in this schema is
consistently used for **staff acting on someone else's resource, or a significant cross-actor
trust decision** (verification, legal holds, moderation, reservations) — not for a user managing
their own data, which RLS already scopes and which the row's own history already documents. This
matches the existing convention (`accept_org_invitation`/`decline_org_invitation` — arguably also
self-service — are audited because they cross into a *different* organisation's membership data,
not because they're customer actions per se).

## Step-up authentication (`require_recent_auth`, Stage CJN)

Only 3 RPCs require step-up today: `execute_account_deletion`, `place_legal_hold`,
`release_legal_hold` — deliberately the highest-consequence, hardest-to-reverse admin actions in
the schema (irreversibly anonymising a real person's data; overriding someone's deletion rights
tied to litigation/investigation). Checked every other admin/ops/moderator command above against
"is this comparably irreversible or consequential" and found none that clearly warrant the same
bar: role changes, case claims, and status transitions are all either reversible (a role can be
changed back, a case can be reassigned) or already gated by a narrower terminal-state guard. Not
adding step-up speculatively to commands where no comparable risk was demonstrated.

## What this stage fixed: 9 RPCs with no audit trail at all

Cross-referencing the live database's actual function definitions (`pg_get_functiondef`, not just
migration file text — several functions are redefined across multiple migrations, so grepping
migration files alone is unreliable) against which functions insert into `audit_logs` found 9
staff-privileged RPCs with **zero** audit trail, inconsistent with sibling RPCs of the same
privilege tier that already have one. Four of the nine are this very session's own new RPCs
(`assign_driver_to_job`, `send_quotation`, `escalate_report_to_case`, `approve_rehoming_review`) —
closed now rather than left for a future session to rediscover in work just committed:

`assign_request_to_route`, `assign_driver_to_job`, `send_quotation`,
`convert_application_to_reservation`, `approve_user_verification`, `mark_risk_signal_reviewed`,
`claim_moderation_case`, `escalate_report_to_case`, `approve_rehoming_review`.

Fixed in `20260101013600_admin_command_audit_coverage.sql`: each now inserts a real
`audit_logs` row (`actor_profile_id` always `auth.uid()`, a `<entity>.<verb>` action name matching
this schema's existing naming convention) at the point of its real state change. Idempotent-retry
early-return paths (already-approved review, already-escalated report, already-assigned driver)
deliberately do **not** insert a second audit entry — an audit log should reflect the one real
state transition, not every client retry of it, and new tests prove this for every one of the 9.

## Verification

- `npx tsc --noEmit`, `npx eslint` on every changed test file — clean.
- New/extended tests across 7 files proving each of the 9 fixed RPCs writes a real, correctly-
  attributed audit entry, and that idempotent retries never duplicate it — 109/109 passing across
  the touched files in isolation.
- Full `npm run test:db`: **966/966** (+7 from YR-6's 959 — many assertions were added inside
  existing sub-tests rather than as brand-new top-level tests), verified on a fresh reset plus one
  more run without reset.
- `npm run build`, `npm run db:preflight` (138 migrations, no unsafe patterns), `npm run
  db:contract-check` (no drift — signatures unchanged, only bodies) — all clean.
- No duplicate migration filename prefixes.
