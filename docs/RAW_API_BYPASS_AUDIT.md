# Raw API bypass audit (Stage YR-15)

## The one real, closed gap: moderation_cases duplicate escalation via raw insert

`escalate_report_to_case()`'s own idempotent-retry logic only protects callers going through the
RPC — "moderators and admins manage all moderation cases" is a real, correct `for all` RLS policy
(moderators are fully trusted staff, the same tier as ops elsewhere in this schema), so a moderator
using the raw Data API directly (a plain `POST /moderation_cases`, bypassing the RPC entirely)
could still create a second case for the same `report_id` — the RPC's own duplicate-prevention
check has nothing enforcing it at the database level, only at the one call path.

Fixed in `20260101013900_moderation_case_report_unique.sql` with a real unique constraint
(`moderation_cases (report_id) where report_id is not null`) — the strongest possible enforcement,
correct regardless of which path (RPC or raw API) is used to write. Also hardened
`escalate_report_to_case()` itself for the resulting genuine-concurrency case (two moderators
escalating the same report at once): a `unique_violation` now resolves to returning the existing
case, matching `convert_application_to_reservation()`'s own established precedent for the identical
shape (Stage XR-9), rather than surfacing a raw, confusing constraint-violation error to the
losing caller.

## Everything else checked: the established "trusted staff, RPC exists for atomicity not security" model, confirmed intact

Spot-checked every RPC this session added or modified against whether its underlying table's RLS
policy would let the same trusted-staff actor bypass the RPC via a raw update — found the same
answer everywhere: **yes, ops/admin/moderator can always bypass their own RPCs via a raw call**,
and this is the established, deliberate, already-accepted design throughout this entire schema
(`change_ops_request_status()`, `assign_driver_to_job()`, `send_quotation()` all have this same
property — `prevent_non_staff_operational_field_changes()` explicitly exempts `is_ops_staff()` at
its very first check). This is not a security bypass: these actors already have full legitimate
access to the underlying rows either way. The RPCs exist for atomicity (all related writes succeed
or fail together) and consistency (a real audit trail, a real actor stamp), not to restrict access
below what the actor's role already legitimately grants. Re-confirming this for the newest RPCs
added this session (the quotation/dispatch/rehoming/report atomic-RPC follow-ups, Stage XR-7's
two follow-ups) found no deviation from this established pattern — nothing to fix.

**What genuinely would be a bypass, and was checked for specifically**: a *lower-trust* actor (a
customer, an org owner, a driver) reaching a protected field or an RPC-only transition via a raw
call. This is exactly the bug class this session has hunted and closed dozens of times already
(self-approval locks on `rehoming_reviews`/`buyer_applications`/`user_verifications`, the
actor-forgery locks on `transport_status_history`/`quotations`/`legal_requirements`, the terminal-
status/protected-field triggers) — re-swept for this stage's own new migrations specifically
(quotation dispatch, rehoming/report, admin command audit coverage, suspended-org application
lock, terminal-reopen-reason) and found each one's underlying RLS already correctly restricts the
lower-trust actor to exactly the transition its own RPC allows, with no wider raw-update escape
hatch.

## Feature-flag / Storage-path bypass

Checked: `maintenance_mode` (already RPC/config-gated, `tests/db/maintenance-mode.test.ts`
already proves direct-RPC-bypass resistance) and Storage bucket paths (already re-audited at Stage
IR-11/XR-4, `docs/STORAGE_PATH_CANONICALISATION_AUDIT.md`) — both pre-existing, dedicated audits;
not re-litigated here, cross-referenced instead.

## Verification

- `npx tsc --noEmit`, `npx eslint tests/db/rehoming-report-atomic-rpcs.test.ts` — clean.
- New test in `tests/db/rehoming-report-atomic-rpcs.test.ts` proves the raw-insert path
  specifically (not just the RPC path) is now rejected by the database itself — 18/18 passing in
  the file.
- Full `npm run test:db`: **1006/1006** (+4 from YR-14's 1002), verified on a fresh reset plus one
  more run without reset.
- `npm run build`, `npm run db:preflight` (141 migrations, no unsafe patterns), `npm run
  db:contract-check` (no drift — signature unchanged) — all clean. No duplicate migration prefixes.
