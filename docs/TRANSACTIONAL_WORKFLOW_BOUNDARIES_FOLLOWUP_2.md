# Transactional workflow boundaries — follow-up 2

Continues `docs/TRANSACTIONAL_WORKFLOW_BOUNDARIES_FOLLOWUP_1.md`, converting the remaining 2 of
XR-7's 6 documented candidates that are a good fit for a straightforward atomic RPC:
`approveRehomingReview`, `escalateReportToCase`. `createTransportRequest` remains deliberately
open — see follow-up 1's own reasoning (its actor-forgery half is already closed by the
`stamp_changed_by_actor` trigger; its payload is a large, evolving multi-field form, not a good fit
for a rigid RPC signature right now).

## What changed

New migration `20260101013500_rehoming_report_atomic_rpcs.sql`:

**`approve_rehoming_review(p_review_id)`**: replaces `approveRehomingReview()`'s 2-write sequence
(`rehoming_reviews.admin_status`, `animals.availability_status`) with one transaction. Derives
`animal_id` from the review row itself instead of trusting a redundant second client argument.
Idempotent retry (already-approved returns success, not an error).

**`escalate_report_to_case(p_report_id)`**: replaces `escalateReportToCase()`'s 2-write sequence
(`moderation_cases` insert, `reports.status`) with one transaction, and closes a real gap that had
*no* DB-level protection at all: `moderation_cases.report_id` has no unique constraint, so a client
retry (or two admins clicking "escalate" near-simultaneously) could create two open cases for the
same report — the only existing duplicate-prevention was a client-side `Set` built from
`listOpenCaseReportIds()`. Idempotent by returning the existing case id on a repeat call, matching
this session's established idempotent-retry pattern (Stage XR-9), rather than either raising a
confusing error or silently creating a duplicate.

Both keep the exact same permission model as before (`is_admin()` for rehoming review approval,
`is_moderator()` for report escalation — the same functions the pre-existing RLS policies already
used), just checked explicitly inside the `SECURITY DEFINER` function rather than relying solely on
RLS for each of the two separate writes.

Query/route files updated: `src/lib/queries/rehoming.ts` (`approveRehomingReview` keeps its
existing 3-argument signature since `animalId`/`ownerProfileId` are still needed for the
notification call afterward — notifications stay outside the atomic core write, matching this
codebase's consistent existing pattern of always sending notifications as a separate best-effort
call after a core RPC succeeds, since notification title/body rendering happens in TypeScript, not
SQL), `src/lib/queries/moderation.ts` (`escalateReportToCase` now only needs the report id — the
target type/id are derived server-side from the report row), `src/routes/dashboard.admin.reports.tsx`
(call site simplified accordingly).

## Verification

- `npx tsc --noEmit` — clean (types regenerated via `npm run db:types`).
- `npx eslint` on every changed file — clean.
- New `tests/db/rehoming-report-atomic-rpcs.test.ts`: 14/14 passing — non-admin/non-moderator
  rejection, nonexistent-id rejection, atomic success (both rows updated together), and idempotent
  retry (including proving `escalate_report_to_case()`'s retry returns the *same* case id and never
  creates a duplicate row).
- Full `npm run test:db`: **948/948** (+14 from follow-up 1's 934), verified on a fresh reset plus
  one more run without reset.
- `npm run build`, `npm run db:preflight` (137 migrations, no unsafe patterns) — clean.
- `npm run db:contract-check`: drift correctly reported for the 2 new RPCs, baseline regenerated
  (`--write`) and re-verified clean — 70 tables, **41** RPCs (+2).
- `npm run db:schema-drift`: still could not run in this session — same shadow-database
  provisioning failure (exit 139) as follow-up 1, reproduced with more free memory available this
  time (814Mi vs ~150Mi previously), so this is a sandbox-specific Docker/shadow-container issue
  independent of memory pressure, not a code issue. The live database itself is verified correct
  through `db:contract-check` (queries it directly) and the passing test suite. Re-run
  `npm run db:schema-drift` in a future session/environment.
- No duplicate migration filename prefixes.
