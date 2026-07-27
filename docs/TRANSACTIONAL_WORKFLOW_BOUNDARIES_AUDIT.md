# Transactional workflow boundaries audit

Stage XR-7 (append-only queue). Audited `src/lib/queries/*.ts` for exported functions doing 2+
sequential client-side writes with no single atomic RPC boundary — the exact anti-pattern this
session has already converted repeatedly (`changeOpsRequestStatus`, `assignRequestToRoute`,
`claimModerationCase`, `convert_application_to_reservation`, `advance_transport_job_status`,
`claim_support_case`, `review_moderation_appeal`, `execute_account_deletion`).

## Found 6 real, currently-wired candidates

| Function | File | Writes | Partial-failure risk | Forgeable actor? |
|---|---|---|---|---|
| `respondToQuotation` | `transport.ts` | quotation status → request status → history insert | quotation "accepted" while request never advances | Yes — `changed_by` client-supplied |
| `sendQuotation` | `operations.ts` | quotation status → request status → history insert | quotation "sent" while request status/audit trail diverge | Yes — `actorId` client-supplied |
| `createTransportRequest` | `transport.ts` | request insert → history insert | a live request with no initial history row | Yes — `changed_by` from insert payload |
| `assignDriverToJob` | `dispatch.ts` | request update (driver assigned) → history insert | driver assigned with no audit event | Yes — `actorId` client-supplied |
| `approveRehomingReview` | `rehoming.ts` | review status → animal availability | review "approved" but listing never becomes visible | No |
| `escalateReportToCase` | `moderation.ts` | case insert → report status | a case exists but the source report stays "open," re-escalatable into a duplicate | No |

All 6 are real, live, currently-wired UI workflows — none are dead code.

## Fixed this stage: the actor-forgery half, for all four affected functions at once

Rather than converting each of the 4 forgeable-actor functions into its own bespoke RPC this
stage (a much larger undertaking — 4 new RPCs, 4 rewritten call sites, a wide test surface), found
a single, much smaller, more valuable fix that closes the *security-relevant* half of the problem
for **every current and future direct-insert path at once**: `transport_status_history.changed_by`
was never actually locked to the real caller — a genuine straggler Stage CJD's own "server-
controlled actor attribution audit" missed when it fixed the same shape for
`quotations.created_by`/`legal_requirements.created_by`. Added
`stamp_changed_by_actor()`/`stamp_transport_status_history_changed_by`
(`20260101013000_transport_status_history_actor_lock.sql`), the same unconditional
`before insert` trigger shape as the existing `stamp_created_by_actor()`. Confirmed safe against
every real existing caller (all 7 test-file insert sites, both already-atomic RPCs) before applying
— every one already passes the real calling actor's own id, so this is a no-op for every legitimate
path and only changes behaviour for a genuine forgery attempt. New test in
`tests/db/actor-attribution-stragglers.test.ts` proves a customer's attempt to credit a different
profile as `changed_by` is silently overridden to their own real id.

This closes 3 of the 4 forgeable-actor rows in the table above (`respondToQuotation`,
`sendQuotation`, `assignDriverToJob` all insert into `transport_status_history`, now protected
regardless of whether they're ever converted to a full RPC) and half of `createTransportRequest`'s
own gap (its `transport_status_history` insert is now protected; its
`transport_requests.insert(...)` write itself has no separate actor-forgery risk, since
`requester_profile_id` is already RLS-checked against `auth.uid()` at insert time).

## Not fixed this stage: full atomicity (the partial-write risk)

None of the 6 functions were converted into a single atomic RPC this stage — the actor-forgery fix
above is real, valuable, and low-risk on its own, but the *partial-write* risk (a second write
failing after the first succeeds, leaving the two tables inconsistent) remains open for all 6.
Converting all 6 into RPCs, updating their call sites, and building failure-injection tests for
each is a substantial enough scope to warrant its own dedicated follow-up pass rather than being
folded into this stage as a rushed, under-tested addition — the same judgment call this session has
made before (e.g. Stage IR-8 deferring a rushed partial fix in favour of a dedicated later stage).
Candidates for that follow-up, in priority order: `respondToQuotation` (customer-facing,
commercially critical), `sendQuotation` (its ops-side pair), `assignDriverToJob` (closest match to
already-fixed siblings), `createTransportRequest`, `approveRehomingReview`,
`escalateReportToCase`.

**Update — first follow-up pass complete**: the first 3 of the 6 (`respondToQuotation`,
`sendQuotation`, `assignDriverToJob`) were converted into atomic RPCs (`respond_to_quotation()`,
`send_quotation()`, `assign_driver_to_job()`,
`20260101013400_quotation_dispatch_atomic_rpcs.sql`) — see
`docs/TRANSACTIONAL_WORKFLOW_BOUNDARIES_FOLLOWUP_1.md` for full detail, including a real
previously-invisible bug the conversion's own tests surfaced and fixed (a customer accepting their
own quotation was silently rejected by a Stage CC trigger with no exemption for that transition).
`createTransportRequest`, `approveRehomingReview`, `escalateReportToCase` remain open.

## Also found and fixed: two silently-swallowed errors, while reading `respondToQuotation`

`respondToQuotation()`'s second and third writes (`transport_requests.update(...)` and
`transport_status_history.insert(...)`) never checked their own `error` result at all — worse than
just "not atomic," a failure there would return successfully to the caller with no indication
anything went wrong. Not fixed as part of this stage's own scope (fixing it properly means either
adding `if (error) throw` to a function this doc just recommended replacing entirely, or doing the
real RPC conversion) — flagged explicitly here rather than silently left for whoever does the
follow-up atomicity pass, so it isn't rediscovered from scratch.
