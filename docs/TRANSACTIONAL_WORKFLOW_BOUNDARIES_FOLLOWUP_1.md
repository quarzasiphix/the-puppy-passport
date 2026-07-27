# Transactional workflow boundaries — follow-up 1

Post-XR-24 follow-up, picking up the top 3 of the 6 candidates `docs/TRANSACTIONAL_WORKFLOW_BOUNDARIES_AUDIT.md`
(Stage XR-7) explicitly deferred, in that stage's own priority order:
`respondToQuotation` (customer-facing, commercially critical), `sendQuotation` (its ops-side pair),
`assignDriverToJob` (closest match to already-fixed siblings like `change_ops_request_status`).

## What changed

New migration `20260101013400_quotation_dispatch_atomic_rpcs.sql` adds three `SECURITY DEFINER`
RPCs — `respond_to_quotation(p_quotation_id, p_response)`, `send_quotation(p_quotation_id)`,
`assign_driver_to_job(p_transport_request_id, p_driver_id)` — replacing the corresponding 2-3-step
client-side write sequences in `src/lib/queries/transport.ts`, `operations.ts`, `dispatch.ts`.
Same shape as every other atomic-RPC conversion this session has done (`change_ops_request_status`,
`convert_application_to_reservation`, etc.): one transaction per operation, `changed_by`/actor
always `auth.uid()` (the old code accepted a plain client-supplied `actorId`/`userId` argument —
closing the second of XR-7's two named problems, not just the partial-write risk), idempotent
retry for the case a client never learned whether its first call succeeded (a dropped response, a
double-click before a button disables).

Route files (`dashboard.buyer.quotations.tsx`, `dashboard.operations.quotations.tsx`,
`dashboard.operations.dispatch.tsx`) updated to call the simplified query functions — each lost a
now-unnecessary `transportRequestId`/`actorId` parameter since the RPC derives or stamps it
server-side; two files' now-unused `useAuth()`/`userId` were removed rather than left dead.

Also closes the specific gap XR-7's own audit flagged by name: `respondToQuotation()`'s 2nd and
3rd writes never checked their own `.error` result. Folding all three writes into one transaction
closes this by construction — a failure anywhere now rolls back the whole call and surfaces as a
real Postgres error to the caller, not a silently swallowed one.

## A real, previously-invisible bug found while writing the tests

Writing the "requester accepts it" test for `respond_to_quotation()` surfaced a genuine pre-existing
gap: `prevent_non_staff_operational_field_changes()` (Stage CC, `20260101011100`) already carves
out exactly two legitimate customer-initiated status transitions for a non-ops/non-driver caller
(`draft→submitted`, `→cancelled_by_customer`) but never added a third for accepting a quotation.
This means a real customer accepting their own quotation has been silently rejected by this
trigger since Stage CC shipped — for both the *old* raw multi-step client code (which never
checked this specific update's error at all, exactly the gap named above) and the new atomic RPC
alike. There is no deliberate design intent anywhere disallowing this; `respondToQuotation()`'s
own existence and the buyer-facing "Accept quotation" UI only make sense if this transition is
meant to succeed. Fixed in the same migration, the same way the existing two exemptions are
scoped — this trigger's job is only "is this a legal status transition for a non-staff actor,"
never "is this the right person" (that's RLS's job for a raw client path, and the RPC's own
explicit requester check for the new path), so no additional identity check was added.

This is a real, previously-shippable-but-broken feature fixed as a direct byproduct of doing the
atomicity conversion properly (writing a real test against the real trigger stack), not a
speculative addition.

## Remaining 3 of the original 6 candidates

`createTransportRequest`, `approveRehomingReview`, `escalateReportToCase` are still open,
per XR-7's own priority order (lowest of the six). Not picked up in this pass; a natural next
follow-up.

## Verification

- `npx tsc --noEmit` — clean (types regenerated via `npm run db:types` after the migration).
- `npx eslint` on every changed file — clean.
- New `tests/db/quotation-dispatch-atomic-rpcs.test.ts`: 29/29 passing, covering all 3 RPCs —
  happy path, non-owner/non-ops rejection, idempotent retry with no duplicate history row,
  invalid-input rejection, and (for `respond_to_quotation`) the expired-quotation and
  reject-only-touches-the-quotation cases.
- Full `npm run test:db`: **934/934** (+29 from XR-24's 905), verified on a fresh reset plus one
  more run without reset.
- `npm run build`, `npm run db:preflight` (136 migrations, no unsafe patterns) — clean.
- `npm run db:contract-check`: real drift correctly reported for the 3 new RPCs, baseline
  regenerated (`--write`) and re-verified clean — 70 tables, **39** RPCs (+3).
- `npm run db:schema-drift`: **could not run** in this session — its shadow-database provisioning
  failed with exit 139 (confirmed via `free -h`: this sandbox was down to ~150Mi free memory
  after the full local Supabase stack plus Docker's own overhead; `docker builder prune` reclaimed
  build cache but did not resolve it). This is an environment resource constraint in this specific
  session, not a code issue — the live database itself was verified correct through
  `db:contract-check` (which queries it directly, no shadow database needed) and the full
  passing test suite. Re-run `npm run db:schema-drift` in a future session with more headroom.
- No duplicate migration filename prefixes.
