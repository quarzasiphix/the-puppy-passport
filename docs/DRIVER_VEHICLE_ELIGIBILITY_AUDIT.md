# Driver and vehicle eligibility consistency (Stage YR-9)

## The real gap: ops assigning a driver had zero eligibility visibility

`assign_driver_to_job()` deliberately only checks that a `drivers` row with the given id exists —
by design, ops staff (not the system) make the final assignment call, matching CLAUDE.md's own
rule ("AI may only produce recommendations... final transport approval stays human"). That design
is correct, but human judgment needs the relevant facts in front of it: `listDriverWorkloads()`
(the query behind the dispatch page's driver picker) never selected
`internal_verification_status` or `document_expiry_date` at all — ops had no way to see a driver
was unverified or had expired documents while assigning them, not because they made an informed
call to proceed anyway, but because the data was never shown.

Fixed: `listDriverWorkloads()` now selects both columns (no RLS change needed — "ops staff manage
drivers" already grants full read access to the whole table, `for all`, confirmed against the live
policy). `dashboard.operations.dispatch.tsx` now shows a real warning (`⚠ Not yet verified`, `⚠
Documents expired`, `⚠ Documents expiring soon`) both on each driver's workload card and inline in
the assignment dropdown, reusing the exact same `documentExpiryWarning()` pure function already
used for quotation/vehicle expiry elsewhere in the app — no new expiry-calculation logic invented.
This is advisory, not a hard block, matching the same deliberate human-in-the-loop design as
`assign_driver_to_job()` itself — ops can still assign an unverified driver if they judge it
appropriate, but now they can see what they're doing.

## Vehicle assignment: confirmed genuinely unwired, not a gap to fix here

`transport_requests.assigned_vehicle_id` is a real column — foreign-key-constrained, trigger-
protected (ops/admin-only, same lock as `assigned_driver_id`/`assigned_route_id`) — but grepped
every query/route file and found **zero** code anywhere that ever sets it. There is no
vehicle-assignment RPC, no UI, no workflow at all currently reachable that touches this column.
This is the same "schema exists and is correctly protected, but never wired to a real product
workflow" pattern this session has correctly identified and left alone before (e.g. Stage BG's
`evidence_url` prior to being wired) — building a new vehicle-assignment feature now, with no
real consumer, would be exactly the speculative infrastructure this session avoids. Left
undisturbed; a real audit target once a real vehicle-assignment workflow exists.

## "All assignment paths call one consistent eligibility contract" — already true by construction

There is exactly one path that can ever set `assigned_driver_id`: `assign_driver_to_job()`. A
direct raw `UPDATE transport_requests SET assigned_driver_id = ...` is already rejected for
non-ops by `prevent_non_staff_operational_field_changes()` (Stage CC), and ops staff themselves are
unrestricted (by design — they're the trusted actor). There is no second, inconsistent path to
reconcile.

## Verification

- `npx tsc --noEmit`, `npx eslint` on both changed files — clean.
- No RLS/migration change — `listDriverWorkloads()`'s new columns were already fully readable by
  ops staff under the existing `for all` policy; this is a pure query/UI exposure fix, verified by
  reading the live policy definition directly rather than assumed.
- Full `npm run test:db`: unaffected (no schema change), still passing at the same count as YR-8.
- `npm run build` — clean.
- **Attempted a real live browser check, did not complete it**: started `npm run dev`, wrote a
  throwaway Playwright spec signing in as `ops@anemalo.test` and asserting the dispatch page's new
  warning text renders. Hit the same pre-existing, already-documented frontend issue from
  `docs/E2E_TESTING.md` (2026-07-27 update) — sign-in never completes in this environment, the page
  stays on `/signin` with no navigation at all even after a multi-second wait, a deeper instance of
  the same class of bug (not one this change introduced or could have caused, since this change
  never touches auth/sign-in code). Did not sink further time working around a known, out-of-scope
  frontend issue for a minor visual-only change; removed the throwaway spec and stopped the dev
  server, worktree left clean. The change is a small, additive, purely conditional text render (no
  new interactive state, reuses an already-tested pure function) and `tsc`/`build` catch any type
  or JSX structural error, but a genuine interactive render was not confirmed — disclosed honestly
  rather than claimed.
